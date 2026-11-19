import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent, CSSProperties, FormEvent } from 'react';
import { supabase } from '../../supabase';
import { uploadMedia, deleteMedia, deleteMediaBeacon } from '../../utils/supabaseStorage';
import { normalizeExternalUrl } from '../../utils/urlHelpers';
import type { Milestone, MilestoneStatus } from '../../types';
import { toast } from 'react-toastify';
import {
  CheckSquare, Clock, AlertCircle, Plus, Trash2, Save, X,
  Edit2, Upload, Loader2, ChevronDown, Building
} from 'lucide-react';
import { useGlobalState } from '../../context/GlobalState';
import AdminSidebar from '../../components/AdminSidebar';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableImageItemProps {
  url: string;
  idx: number;
  removeImage: (url: string) => void;
}

const SortableImageItem = ({ url, idx, removeImage }: SortableImageItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  const safeSrc = normalizeExternalUrl(url) || undefined;

  return (
    <div ref={setNodeRef} style={style} className="relative inline-block group">
      <div {...attributes} {...listeners} className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing"></div>
      <img src={safeSrc} alt={`img ${idx}`} className="h-24 w-24 rounded-lg border shadow-sm object-cover" />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm('Are you sure you want to remove this attached image?')) {
            removeImage(url);
          }
        }}
        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow z-10"
      >
        <X size={14} />
      </button>
    </div>
  );
};

interface MilestoneFormState {
  id: string;
  date: string;
  title: string;
  description: string;
  status: MilestoneStatus;
  percentage: number;
  images: string[];
}

const INITIAL_MILESTONE_FORM: MilestoneFormState = {
  id: '',
  date: '',
  title: '',
  description: '',
  status: 'upcoming',
  percentage: 0,
  images: [],
};

const generateId = (): string => crypto.randomUUID();

export default function ProgressManager() {
  const { properties, adminUnsavedChanges, setAdminUnsavedChanges, fetchProperties } = useGlobalState();
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);

  const [milestoneForm, setMilestoneForm] = useState<MilestoneFormState>(INITIAL_MILESTONE_FORM);

  // GC State
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  const [newlyUploadedImages, setNewlyUploadedImages] = useState<string[]>([]);
  const newImagesRef = useRef<string[]>(newlyUploadedImages);
  useEffect(() => {
    newImagesRef.current = newlyUploadedImages;
  }, [newlyUploadedImages]);

  // Cleanup orphans on unmount
  useEffect(() => {
    return () => {
      if (newImagesRef.current.length > 0) {
        newImagesRef.current.forEach((url) => deleteMediaBeacon(url));
      }
    };
  }, []);

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);
  const milestones: Milestone[] = selectedProperty?.milestones || [];

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setMilestoneForm((prev) => {
      switch (name) {
        case 'title':
          return { ...prev, title: value };
        case 'date':
          return { ...prev, date: value };
        case 'description':
          return { ...prev, description: value };
        case 'status':
          return { ...prev, status: value as MilestoneStatus };
        case 'percentage':
          return { ...prev, percentage: Number(value) };
        default:
          return prev;
      }
    });
    setAdminUnsavedChanges(true);
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length) return;

    // Check individual file size limit (Supabase Storage max 50MB per file)
    const MAX_SIZE_BYTES = 50 * 1024 * 1024;
    const oversizedFiles = files.filter((f) => f.size > MAX_SIZE_BYTES);
    if (oversizedFiles.length > 0) {
      toast.error(`${oversizedFiles.length} file(s) exceed the 50MB limit per image.`);
      e.target.value = '';
      return;
    }

    setUploadingImage(true);
    toast.info(`Uploading ${files.length} image(s)...`);
    try {
      const urls = await Promise.all(files.map((file) => uploadMedia(file, 'milestone', selectedPropertyId)));
      setMilestoneForm((prev) => ({ ...prev, images: [...(prev.images || []), ...urls] }));
      setNewlyUploadedImages((prev) => [...prev, ...urls]);
      setAdminUnsavedChanges(true);
      toast.success('Images uploaded successfully!');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error uploading: ${message}`);
      console.error(error);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = (urlToRemove: string) => {
    setMilestoneForm((prev) => ({
      ...prev,
      images: prev.images.filter((url) => url !== urlToRemove),
    }));
    // Queue for deletion (works for any storage URL)
    setImagesToDelete((prev) => [...prev, urlToRemove]);
    setAdminUnsavedChanges(true);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setMilestoneForm((prev) => {
        const oldIndex = prev.images.indexOf(String(active.id));
        const newIndex = prev.images.indexOf(String(over.id));
        if (oldIndex === -1 || newIndex === -1) return prev;
        return {
          ...prev,
          images: arrayMove(prev.images, oldIndex, newIndex),
        };
      });
      setAdminUnsavedChanges(true);
    }
  };

  const handleSaveMilestone = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPropertyId) return;

    if (!milestoneForm.title || !milestoneForm.date || !milestoneForm.description) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setIsSaving(true);
    try {
      let newMilestones: Milestone[] = [...milestones];

      if (editingMilestoneId) {
        newMilestones = newMilestones.map((m) => (m.id === editingMilestoneId ? { ...milestoneForm } : m));
      } else {
        newMilestones.push({ ...milestoneForm, id: generateId() });
      }

      const { error } = await supabase
        .from('properties')
        .update({ milestones: newMilestones })
        .eq('id', selectedPropertyId);
      if (error) throw error;

      // Mark newly uploaded images as committed synchronously so unmount beacon won't delete them
      newImagesRef.current = [];
      setNewlyUploadedImages([]);

      // Execute GC
      if (imagesToDelete.length > 0) {
        await Promise.all(imagesToDelete.map((url) => deleteMedia(url)));
        setImagesToDelete([]);
      }

      if (fetchProperties) await fetchProperties(); // Instantly update UI

      toast.success(`Milestone ${editingMilestoneId ? 'updated' : 'added'} successfully!`);
      setEditingMilestoneId(null);
      setMilestoneForm(INITIAL_MILESTONE_FORM);
      setAdminUnsavedChanges(false);
    } catch (error: unknown) {
      console.error(error);
      toast.error('Failed to save milestone.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMilestone = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this milestone?')) return;

    setIsSaving(true);
    try {
      const milestoneToDelete = milestones.find((m) => m.id === id);

      const urlsToDelete = milestoneToDelete?.images || (milestoneToDelete?.imageUrl ? [milestoneToDelete.imageUrl] : []);
      await Promise.all(urlsToDelete.map((url) => deleteMedia(url)));

      const newMilestones = milestones.filter((m) => m.id !== id);
      const { error } = await supabase
        .from('properties')
        .update({ milestones: newMilestones })
        .eq('id', selectedPropertyId);
      if (error) throw error;

      if (fetchProperties) await fetchProperties(); // Instantly update UI
      toast.success('Milestone deleted.');
    } catch (error: unknown) {
      console.error(error);
      toast.error('Failed to delete milestone.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditMilestone = (milestone: Milestone) => {
    if (adminUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to discard them?')) return;
    }
    setEditingMilestoneId(milestone.id);
    const existingImages = milestone.images || (milestone.imageUrl ? [milestone.imageUrl] : []);
    setMilestoneForm({
      id: milestone.id,
      date: milestone.date,
      title: milestone.title,
      description: milestone.description,
      status: milestone.status,
      percentage: milestone.percentage,
      images: existingImages,
    });
    setAdminUnsavedChanges(false);
  };

  const cancelEdit = () => {
    if (adminUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to discard them?')) return;
    }

    // Discarding form, cleanup new uploads
    if (newlyUploadedImages.length > 0) {
      const toCleanup = [...newlyUploadedImages];
      newImagesRef.current = [];
      setNewlyUploadedImages([]);
      toCleanup.forEach((url) => {
        void deleteMedia(url);
      });
    }
    setImagesToDelete([]); // reset queue

    setEditingMilestoneId(null);
    setMilestoneForm(INITIAL_MILESTONE_FORM);
    setAdminUnsavedChanges(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar />
      <div className="flex-1 p-10 h-screen overflow-y-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif text-brand-dark mb-2">Project Progress Manager</h1>
            <p className="text-brand-neutral/70">Update construction timelines and milestones for public viewing.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-gray-100">
          <label className="block text-sm font-bold text-gray-700 mb-2">Select Project</label>

          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-primary font-bold text-gray-700 text-left flex items-center justify-between cursor-pointer hover:border-brand-primary/50 transition-colors"
            >
              <span className="flex items-center gap-3 truncate">
                {selectedPropertyId ? (
                  <>
                    <Building size={18} className="text-brand-primary flex-shrink-0" />
                    <span className="truncate">
                      {selectedProperty?.name} ({selectedProperty?.status})
                    </span>
                  </>
                ) : (
                  <span className="text-gray-400 font-normal">— Select a Property —</span>
                )}
              </span>
              <ChevronDown
                size={18}
                className={`text-gray-400 transition-transform duration-300 flex-shrink-0 ${dropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)}></div>
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
                  <div className="max-h-[300px] overflow-y-auto">
                    {properties.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => {
                          if (adminUnsavedChanges && p.id !== selectedPropertyId) {
                            if (!window.confirm('You have unsaved changes. Are you sure you want to discard them?')) {
                              setDropdownOpen(false);
                              return;
                            }
                          }
                          if (p.id !== selectedPropertyId) {
                            setSelectedPropertyId(p.id);
                            setEditingMilestoneId(null);
                            setMilestoneForm(INITIAL_MILESTONE_FORM);
                            setAdminUnsavedChanges(false);
                          }
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between group border-b border-gray-50 last:border-0 ${
                          selectedPropertyId === p.id
                            ? 'bg-brand-primary/10 text-brand-primary font-bold'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="truncate pr-4">
                          {p.name} <span className="text-xs text-gray-400 font-normal ml-2">({p.status})</span>
                        </span>
                        {selectedPropertyId === p.id && <CheckSquare size={16} className="text-brand-primary flex-shrink-0" />}
                      </button>
                    ))}
                    {properties.length === 0 && (
                      <div className="p-4 text-center text-gray-400 text-sm">No properties available</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {selectedPropertyId && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Milestone Form */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-xl font-bold text-brand-dark mb-6 flex items-center gap-2">
                {editingMilestoneId ? (
                  <Edit2 size={20} className="text-brand-primary" />
                ) : (
                  <Plus size={20} className="text-brand-primary" />
                )}
                {editingMilestoneId ? 'Edit Milestone' : 'Add New Milestone'}
              </h2>
              <form onSubmit={handleSaveMilestone} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    name="title"
                    value={milestoneForm.title}
                    onChange={handleInputChange}
                    placeholder="e.g. Foundation Completed"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Date *</label>
                    <input
                      type="text"
                      name="date"
                      value={milestoneForm.date}
                      onChange={handleInputChange}
                      placeholder="e.g. October 2025"
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Status</label>
                    <select
                      name="status"
                      value={milestoneForm.status}
                      onChange={handleInputChange}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary"
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="current">Current (In Progress)</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                {milestoneForm.status === 'current' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Completion Percentage (%)</label>
                    <input
                      type="number"
                      name="percentage"
                      min="0"
                      max="100"
                      value={milestoneForm.percentage}
                      onChange={handleInputChange}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Description *</label>
                  <textarea
                    name="description"
                    value={milestoneForm.description}
                    onChange={handleInputChange}
                    rows={4}
                    placeholder="Describe the milestone updates..."
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary"
                    required
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Attached Images</label>
                  <div className="flex flex-wrap gap-4 mb-4">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={milestoneForm.images || []} strategy={rectSortingStrategy}>
                        {(milestoneForm.images || []).map((url, idx) => (
                          <SortableImageItem key={url} url={url} idx={idx} removeImage={handleRemoveImage} />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                  {milestoneForm.images && milestoneForm.images.length > 1 && (
                    <p className="text-xs text-gray-500 mb-4 -mt-2">Drag and drop images to reorder them.</p>
                  )}

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded cursor-pointer transition-colors font-bold text-sm">
                      {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      {uploadingImage ? 'Uploading...' : 'Upload Image'}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={uploadingImage}
                      />
                    </label>
                    <span className="text-xs text-gray-500">Supports JPG, PNG, WEBP. You can upload multiple.</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 bg-brand-primary text-white py-3 rounded font-bold hover:bg-brand-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Save size={18} />{' '}
                    {isSaving ? 'Saving...' : editingMilestoneId ? 'Update Milestone' : 'Save Milestone'}
                  </button>
                  {editingMilestoneId && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={isSaving}
                      className="px-4 bg-gray-200 text-gray-700 rounded font-bold hover:bg-gray-300 transition-colors flex items-center justify-center"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Timeline View */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 h-[600px] overflow-y-auto">
              <h2 className="text-xl font-bold text-brand-dark mb-6 flex items-center gap-2">
                <Clock size={20} className="text-brand-primary" /> Current Timeline
              </h2>

              {milestones.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <AlertCircle size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No milestones added yet.</p>
                </div>
              ) : (
                <div className="relative border-l-2 border-gray-200 ml-4">
                  {milestones.map((milestone) => (
                    <div key={milestone.id} className="mb-8 ml-6 relative group">
                      <span
                        className={`absolute -left-9 flex items-center justify-center w-6 h-6 rounded-full -ml-[1px] ring-4 ring-white ${
                          milestone.status === 'completed'
                            ? 'bg-brand-dark'
                            : milestone.status === 'current'
                              ? 'bg-brand-primary animate-pulse'
                              : 'bg-gray-300'
                        }`}
                      >
                        {milestone.status === 'completed' && <CheckSquare size={12} className="text-white" />}
                      </span>

                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 hover:border-brand-primary/30 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-bold text-brand-primary uppercase">{milestone.date}</span>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditMilestone(milestone)}
                              className="text-blue-500 hover:text-blue-700"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMilestone(milestone.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <h3 className="font-bold text-brand-dark mb-1">{milestone.title}</h3>
                        <p className="text-sm text-gray-600 mb-2">{milestone.description}</p>
                        {(() => {
                          const imgs = milestone.images || (milestone.imageUrl ? [milestone.imageUrl] : []);
                          if (imgs.length === 0) return null;
                          return (
                            <div className="mb-3 mt-2 flex flex-wrap gap-2">
                              {imgs.map((url, idx) => (
                                <img
                                  key={idx}
                                  src={normalizeExternalUrl(url) || undefined}
                                  alt={`milestone img ${idx}`}
                                  className="h-16 w-16 rounded border border-gray-200 shadow-sm object-cover"
                                />
                              ))}
                            </div>
                          );
                        })()}

                        {milestone.status === 'current' && (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                              <span>Progress</span>
                              <span>{milestone.percentage}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-brand-primary h-1.5 rounded-full"
                                style={{ width: `${milestone.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
