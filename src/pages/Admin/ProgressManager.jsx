import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, Clock, AlertCircle, Plus, Trash2, Save, X, Edit2, Upload, Loader2, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { useGlobalState } from '../../context/GlobalState';
import AdminSidebar from '../../components/AdminSidebar';
import { deleteCloudinaryMedia, deleteCloudinaryMediaBeacon } from '../../utils/cloudinary';

// Helper for simple unique ID since we don't want to rely on uuid package if not installed
const generateId = () => Math.random().toString(36).substring(2, 15);

export default function ProgressManager() {
  const navigate = useNavigate();
  const { properties, loadingProperties, adminUnsavedChanges, setAdminUnsavedChanges } = useGlobalState();
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState(null);

  const [milestoneForm, setMilestoneForm] = useState({
    id: '',
    date: '',
    title: '',
    description: '',
    status: 'upcoming', // upcoming, current, completed
    percentage: 0,
    images: []
  });
  
  // GC State
  const [imagesToDelete, setImagesToDelete] = useState([]);
  const [newlyUploadedImages, setNewlyUploadedImages] = useState([]);
  const newImagesRef = useRef(newlyUploadedImages);
  useEffect(() => { newImagesRef.current = newlyUploadedImages; }, [newlyUploadedImages]);

  // Cleanup orphans on unmount
  useEffect(() => {
    return () => {
      if (newImagesRef.current.length > 0) {
        newImagesRef.current.forEach(url => deleteCloudinaryMediaBeacon(url));
      }
    };
  }, []);

  const selectedProperty = properties.find(p => p.id === selectedPropertyId);
  const milestones = selectedProperty?.milestones || [];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setMilestoneForm(prev => ({
      ...prev,
      [name]: name === 'percentage' ? Number(value) : value
    }));
    setAdminUnsavedChanges(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    toast.info("Uploading milestone image...");
    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
      
      if (!cloudName || !uploadPreset) throw new Error("Cloudinary keys missing!");

      const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('upload_preset', uploadPreset);

      const res = await fetch(url, { method: 'POST', body: uploadData });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error?.message || 'Upload failed');
      
      setMilestoneForm(prev => ({ 
        ...prev, 
        images: [...(prev.images || []), data.secure_url] 
      }));
      setNewlyUploadedImages(prev => [...prev, data.secure_url]);
      setAdminUnsavedChanges(true);
      toast.success("Image uploaded successfully!");
    } catch (error) {
      toast.error(`Error uploading: ${error.message}`);
      console.error(error);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = (urlToRemove) => {
    setMilestoneForm(prev => ({
      ...prev,
      images: prev.images.filter(url => url !== urlToRemove)
    }));
    if (urlToRemove.includes('cloudinary.com')) {
      setImagesToDelete(prev => [...prev, urlToRemove]);
    }
    setAdminUnsavedChanges(true);
  };

  const handleSaveMilestone = async (e) => {
    e.preventDefault();
    if (!selectedPropertyId) return;
    
    if (!milestoneForm.title || !milestoneForm.date || !milestoneForm.description) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSaving(true);
    try {
      const propertyRef = doc(db, 'properties', selectedPropertyId);
      
      let newMilestones = [...milestones];
      
      if (editingMilestoneId) {
        // Edit existing
        newMilestones = newMilestones.map(m => m.id === editingMilestoneId ? { ...milestoneForm } : m);
      } else {
        // Add new
        newMilestones.push({ ...milestoneForm, id: generateId() });
      }

      await updateDoc(propertyRef, { milestones: newMilestones });
      
      // Execute GC
      if (imagesToDelete.length > 0) {
        await Promise.all(imagesToDelete.map(url => deleteCloudinaryMedia(url)));
        setImagesToDelete([]);
      }
      setNewlyUploadedImages([]); // committed successfully, prevent unmount deletion
      
      toast.success(`Milestone ${editingMilestoneId ? 'updated' : 'added'} successfully!`);
      
      // Reset form
      setEditingMilestoneId(null);
      setMilestoneForm({ id: '', date: '', title: '', description: '', status: 'upcoming', percentage: 0, images: [] });
      setAdminUnsavedChanges(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save milestone.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMilestone = async (id) => {
    if (!window.confirm("Are you sure you want to delete this milestone?")) return;
    
    setIsSaving(true);
    try {
      const propertyRef = doc(db, 'properties', selectedPropertyId);
      const milestoneToDelete = milestones.find(m => m.id === id);
      
      const imagesToDelete = milestoneToDelete?.images || (milestoneToDelete?.imageUrl ? [milestoneToDelete.imageUrl] : []);
      for (const url of imagesToDelete) {
        await deleteCloudinaryMedia(url);
      }

      const newMilestones = milestones.filter(m => m.id !== id);
      await updateDoc(propertyRef, { milestones: newMilestones });
      toast.success("Milestone deleted.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete milestone.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditMilestone = (milestone) => {
    if (adminUnsavedChanges) {
      if (!window.confirm("You have unsaved changes. Are you sure you want to discard them?")) return;
    }
    setEditingMilestoneId(milestone.id);
    const existingImages = milestone.images || (milestone.imageUrl ? [milestone.imageUrl] : []);
    setMilestoneForm({ ...milestone, images: existingImages });
    setAdminUnsavedChanges(false);
  };

  const cancelEdit = () => {
    if (adminUnsavedChanges) {
      if (!window.confirm("You have unsaved changes. Are you sure you want to discard them?")) return;
    }
    
    // Discarding form, cleanup new uploads
    if (newlyUploadedImages.length > 0) {
      newlyUploadedImages.forEach(url => deleteCloudinaryMedia(url));
      setNewlyUploadedImages([]);
    }
    setImagesToDelete([]); // reset queue
    
    setEditingMilestoneId(null);
    setMilestoneForm({ id: '', date: '', title: '', description: '', status: 'upcoming', percentage: 0, images: [] });
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
        <select
          value={selectedPropertyId}
          onChange={(e) => {
            if (adminUnsavedChanges) {
              if (!window.confirm("You have unsaved changes. Are you sure you want to discard them?")) return;
            }
            setSelectedPropertyId(e.target.value);
            setEditingMilestoneId(null);
            setMilestoneForm({ id: '', date: '', title: '', description: '', status: 'upcoming', percentage: 0, images: [] });
            setAdminUnsavedChanges(false);
          }}
          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-primary"
        >
          <option value="">— Select a Property —</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.status})</option>
          ))}
        </select>
      </div>

      {selectedPropertyId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Milestone Form */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-bold text-brand-dark mb-6 flex items-center gap-2">
              {editingMilestoneId ? <Edit2 size={20} className="text-brand-primary" /> : <Plus size={20} className="text-brand-primary" />}
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
                  rows="4"
                  placeholder="Describe the milestone updates..."
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary"
                  required
                ></textarea>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Attached Images</label>
                <div className="flex flex-wrap gap-4 mb-4">
                  {(milestoneForm.images || []).map((url, idx) => (
                    <div key={idx} className="relative inline-block">
                      <img src={url} alt={`Milestone img ${idx}`} className="h-24 w-24 rounded-lg border shadow-sm object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("Are you sure you want to remove this attached image?")) {
                            handleRemoveImage(url);
                          }
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded cursor-pointer transition-colors font-bold text-sm">
                    {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {uploadingImage ? 'Uploading...' : 'Upload Image'}
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
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
                  <Save size={18} /> {isSaving ? 'Saving...' : (editingMilestoneId ? 'Update Milestone' : 'Save Milestone')}
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
                    <span className={`absolute -left-9 flex items-center justify-center w-6 h-6 rounded-full -ml-[1px] ring-4 ring-white ${
                      milestone.status === 'completed' ? 'bg-brand-dark' : 
                      milestone.status === 'current' ? 'bg-brand-primary animate-pulse' : 'bg-gray-300'
                    }`}>
                      {milestone.status === 'completed' && <CheckSquare size={12} className="text-white" />}
                    </span>
                    
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 hover:border-brand-primary/30 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-brand-primary uppercase">{milestone.date}</span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                          <button onClick={() => handleEditMilestone(milestone)} className="text-blue-500 hover:text-blue-700"><Edit2 size={14} /></button>
                          <button onClick={() => handleDeleteMilestone(milestone.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
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
                              <img key={idx} src={url} alt={`milestone img ${idx}`} className="h-16 w-16 rounded border border-gray-200 shadow-sm object-cover" />
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
                            <div className="bg-brand-primary h-1.5 rounded-full" style={{ width: `${milestone.percentage}%` }}></div>
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
