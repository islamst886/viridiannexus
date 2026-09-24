import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../../firebase';
import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ArrowLeft, Save, CheckSquare, Plus, Trash2, FileText, Tag, X, ChevronDown, AlertTriangle } from 'lucide-react';
import { usePropertyTypes } from '../../hooks/usePropertyTypes';
import { useGlobalState } from '../../context/GlobalState';
import { AVAILABLE_ICONS } from '../../utils/iconLibrary';
import { deleteCloudinaryMedia, deleteCloudinaryMediaBeacon } from '../../utils/cloudinary';

const AVAILABLE_AMENITIES = [
  '24/7 Security', 'Smart Home Ready', 'Dedicated Parking', 'Green Spaces',
  'Infinity Pool', 'Fitness Center', 'Rooftop Garden', 'High-Speed Elevators',
  'Concierge Service', 'Backup Generator', 'Solar Power', 'CCTV Surveillance',
  'Fire Safety System', 'Water Purification', 'Spa & Sauna', "Children's Play Area",
  'Business Lounge', 'EV Charging Station', 'Helipad', "Servant's Quarters",
  'Pet-Friendly Areas', 'Waste Management', 'Home Theater', 'Jacuzzi'
];

export default function PropertyForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const { types: propertyTypes, loading: typesLoading } = usePropertyTypes();
  const [customTypeInput, setCustomTypeInput] = useState('');
  
  const [localPropertyTypes, setLocalPropertyTypes] = useState([]);
  const { adminUnsavedChanges: isDirty, setAdminUnsavedChanges: setIsDirty, setBypassUnsavedGuard } = useGlobalState();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(null);
  const [openIconPicker, setOpenIconPicker] = useState(null);
  
  // Collapsible UI state
  const [isUnitTypesOpen, setIsUnitTypesOpen] = useState(false);
  const [isUnitInventoryOpen, setIsUnitInventoryOpen] = useState(false);
  const [isParkingInventoryOpen, setIsParkingInventoryOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    location: '',
    price: '',
    status: 'Ready',
    propertyType: [],
    beds: 0,
    baths: 0,
    sqft: '',
    buildingType: '',
    unitsPerFloor: '',
    totalUnits: '',
    landArea: '',
    architect: '',
    parkingAvailable: '',
    parkingPrice: '',
    frontRoadSize: '',
    totalShare: '',
    landmarks: '',
    googleMapLink: '',
    completionDate: '',
    overview: '',
    brochureUrl: '',
    availableUnits: [],
    inventory: [],
    parkingInventory: [],
    amenities: [],
    customAmenities: [],
    images: {
      hero: '',
      map: '',
      floorPlan: '',
      video: '',
      gallery: []
    }
  });

  // Cloudinary GC State
  const [mediaToDelete, setMediaToDelete] = useState([]);
  const [newlyUploadedMedia, setNewlyUploadedMedia] = useState([]);
  
  // Refs for unmount cleanup
  const bypassRef = useRef(false);
  const newlyUploadedRef = useRef(newlyUploadedMedia);
  
  // We use this to track if we successfully saved so we don't GC newly uploaded media
  const [saveSuccess, setSaveSuccess] = useState(false);
  useEffect(() => { bypassRef.current = saveSuccess; }, [saveSuccess]);
  useEffect(() => { newlyUploadedRef.current = newlyUploadedMedia; }, [newlyUploadedMedia]);

  useEffect(() => {
    return () => {
      // If component unmounts and we didn't save, delete newly uploaded media to prevent orphans
      if (!bypassRef.current && newlyUploadedRef.current.length > 0) {
        newlyUploadedRef.current.forEach(url => deleteCloudinaryMediaBeacon(url));
      }
    };
  }, []);

  useEffect(() => {
    if (!typesLoading && localPropertyTypes.length === 0 && !isDirty) {
      setLocalPropertyTypes([...propertyTypes]);
    }
  }, [propertyTypes, typesLoading]);
  useEffect(() => {
    if (isEditing) {
      fetchProperty();
    }
  }, [id]);
  const fetchProperty = async () => {
    try {
      const docRef = doc(db, 'properties', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFormData({ 
          id: docSnap.id, 
          ...data, 
          amenities: data.amenities || [],
          customAmenities: data.customAmenities || [],
          availableUnits: data.availableUnits || [],
          inventory: data.inventory || [],
          parkingInventory: data.parkingInventory || [],
          propertyType: Array.isArray(data.propertyType) ? data.propertyType : (data.propertyType ? [data.propertyType] : []),
          buildingType: data.buildingType || '',
          unitsPerFloor: data.unitsPerFloor || '',
          totalUnits: data.totalUnits || '',
          landArea: data.landArea || '',
          architect: data.architect || '',
          parkingAvailable: data.parkingAvailable || '',
          parkingPrice: data.parkingPrice || '',
          passengerLifts: data.passengerLifts || '',
          frontRoadSize: data.frontRoadSize || '',
          totalShare: data.totalShare || '',
          landmarks: data.landmarks || '',
          googleMapLink: data.googleMapLink || '',
          completionDate: data.completionDate || '',
          overview: data.overview || '',
          brochureUrl: data.brochureUrl || '',
          images: {
            hero: data.images?.hero || '',
            map: data.images?.map || '',
            floorPlan: data.images?.floorPlan || '',
            video: data.images?.video || '',
            gallery: data.images?.gallery || [],
          }
        });
      } else {
        toast.error("Property not found");
        navigate('/admin/dashboard');
      }
    } catch (error) {
      toast.error("Error fetching property details");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setIsDirty(true);
  };

  const handleImageChange = (e) => {
    const { name, value } = e.target;
    
    let formattedValue = value;
    if (formattedValue.includes('drive.google.com/file/d/')) {
      toast.error("Google Drive blocks website image hosting. Please use ImgBB.com instead for a reliable, free image link!");
      return; // Do not save the Google Drive link
    }

    setFormData(prev => ({
      ...prev,
      images: { ...prev.images, [name]: formattedValue }
    }));
    setIsDirty(true);
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setUploadingImage('gallery');
    toast.info(`Uploading ${files.length} image(s) to gallery...`);

    const newGalleryUrls = [];

    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
      
      if (!cloudName || !uploadPreset) {
        throw new Error("Cloudinary keys are missing in the .env file!");
      }

      const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

      for (const file of files) {
        const uploadData = new FormData();
        uploadData.append('file', file);
        uploadData.append('upload_preset', uploadPreset);

        const res = await fetch(url, { method: 'POST', body: uploadData });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error?.message || 'Upload failed');
        
        setNewlyUploadedMedia(prev => [...prev, data.secure_url]);
        newGalleryUrls.push(data.secure_url);
      }

      setFormData(prev => ({
        ...prev,
        images: {
          ...prev.images,
          gallery: [...(prev.images?.gallery || []), ...newGalleryUrls]
        }
      }));
      setIsDirty(true);
      toast.success(`Gallery uploaded successfully!`);
    } catch (error) {
      toast.error(`Error uploading gallery: ${error.message}`);
      console.error(error);
    } finally {
      setUploadingImage(null);
    }
  };

  const removeGalleryImage = (urlToRemove) => {
    if (!window.confirm("Are you sure you want to remove this gallery image?")) return;
    if (urlToRemove?.includes('cloudinary.com')) {
      setMediaToDelete(prev => [...prev, urlToRemove]);
    }
    setFormData(prev => ({
      ...prev,
      images: {
        ...prev.images,
        gallery: (prev.images?.gallery || []).filter(url => url !== urlToRemove)
      }
    }));
    setIsDirty(true);
  };

  const handleFileUpload = async (e, mediaType) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(mediaType);
    toast.info(`Uploading ${mediaType}...`);
    try {
      // Use Firebase Storage for brochure to bypass Cloudinary PDF delivery restrictions on free accounts
      if (mediaType === 'brochure') {
        const storageRef = ref(storage, `brochures/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        
        const oldBrochure = formData.brochureUrl;
        if (oldBrochure) {
          if (oldBrochure.includes('cloudinary.com')) {
            setMediaToDelete(prev => [...prev, oldBrochure]);
          } else if (oldBrochure.includes('firebasestorage')) {
            try {
              const oldRef = ref(storage, oldBrochure);
              await deleteObject(oldRef);
            } catch (err) {
              console.error("Failed to delete old brochure from Firebase", err);
            }
          }
        }
        
        setFormData(prev => ({ ...prev, brochureUrl: url }));
        setIsDirty(true);
        toast.success(`Brochure uploaded successfully!`);
        return;
      }

      // Default Cloudinary Upload
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
      
      if (!cloudName || !uploadPreset) {
        throw new Error("Cloudinary keys are missing in the .env file!");
      }

      // 'auto' safely handles images, videos
      const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('upload_preset', uploadPreset);

      const res = await fetch(url, { method: 'POST', body: uploadData });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error?.message || 'Upload failed');
      
      const oldUrl = formData.images[mediaType];
      if (oldUrl && oldUrl.includes('cloudinary.com')) {
        setMediaToDelete(prev => [...prev, oldUrl]);
      }
      setNewlyUploadedMedia(prev => [...prev, data.secure_url]);

      setFormData(prev => ({
        ...prev,
        images: { ...prev.images, [mediaType]: data.secure_url }
      }));
      setIsDirty(true);
      toast.success(`${mediaType} uploaded successfully!`);
    } catch (error) {
      toast.error(`Error uploading: ${error.message}`);
      console.error(error);
    } finally {
      setUploadingImage(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setBypassUnsavedGuard(true);

    try {
      const propId = formData.id || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const docRef = doc(db, 'properties', propId);
      
      await setDoc(docRef, {
        name: formData.name,
        location: formData.location,
        price: formData.price,
        status: formData.status,
        propertyType: formData.propertyType,
        beds: Number(formData.beds),
        baths: Number(formData.baths),
        sqft: formData.sqft,
        buildingType: formData.buildingType,
        unitsPerFloor: formData.unitsPerFloor,
        totalUnits: formData.totalUnits,
        landArea: formData.landArea,
        architect: formData.architect,
        parkingAvailable: formData.parkingAvailable,
        parkingPrice: formData.parkingPrice,
        passengerLifts: formData.passengerLifts,
        frontRoadSize: formData.frontRoadSize,
        totalShare: formData.totalShare,
        landmarks: formData.landmarks,
        completionDate: formData.completionDate,
        overview: formData.overview,
        brochureUrl: formData.brochureUrl,
        availableUnits: formData.availableUnits,
        inventory: formData.inventory,
        parkingInventory: formData.parkingInventory || [],
        amenities: formData.amenities,
        customAmenities: formData.customAmenities || [],
        images: formData.images
      }, { merge: true });

      // Save custom property types if dirty
      await setDoc(doc(db, 'settings', 'propertyTypes'), { types: localPropertyTypes });

      // GC: Successfully saved to DB, so we can now safely delete the old replaced media
      if (mediaToDelete.length > 0) {
        toast.info("Cleaning up old media...");
        await Promise.all(mediaToDelete.map(url => deleteCloudinaryMedia(url)));
        setMediaToDelete([]);
      }
      
      // Clear newly uploaded tracking so unmount doesn't delete them
      setNewlyUploadedMedia([]);

      setIsDirty(false);
      toast.success(`Property ${isEditing ? 'updated' : 'created'} successfully!`);
      navigate('/admin/dashboard');
    } catch (error) {
      console.error(error);
      toast.error("Error saving property");
      setBypassUnsavedGuard(false);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (isDirty) {
      if (!window.confirm("You have unsaved changes. Are you sure you want to leave this page?")) return;
    }
    navigate('/admin/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button type="button" onClick={handleBack} className="p-2 bg-white rounded-full shadow hover:bg-gray-100 transition">
              <ArrowLeft size={24} className="text-brand-dark" />
            </button>
            <h1 className="text-3xl font-serif text-brand-dark">{isEditing ? 'Edit Property' : 'Create New Property'}</h1>
          </div>
          
          <button 
            type="submit" 
            form="property-form"
            disabled={loading}
            className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2 rounded-lg font-bold hover:bg-brand-dark transition-colors shadow-sm disabled:opacity-50"
          >
            <Save size={18} />
            {loading ? 'Saving...' : 'Save Property'}
          </button>
        </div>

        <form id="property-form" onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Property ID (URL Slug)</label>
              <input type="text" name="id" value={formData.id} onChange={handleInputChange} disabled={isEditing} placeholder="e.g. the-sapphire-penthouse" className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary disabled:opacity-50" />
              <p className="text-xs text-gray-400 mt-1">Leave blank to auto-generate from name. Cannot be changed later.</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Property Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleInputChange} required className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Location</label>
              <input type="text" name="location" value={formData.location} onChange={handleInputChange} required className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Google Map Link (Optional)</label>
              <input type="url" name="googleMapLink" value={formData.googleMapLink || ''} onChange={handleInputChange} placeholder="https://maps.google.com/..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary" />
              <p className="text-xs text-gray-400 mt-1">If provided, the 'View on Google Map' button on the project details page will link here.</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Property Overview (Description)</label>
              <textarea name="overview" value={formData.overview} onChange={handleInputChange} rows="5" placeholder="Write a captivating description of this property..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary"></textarea>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Base Price (৳) <span className="text-gray-400 font-normal normal-case">(Fallback)</span></label>
              <input type="text" name="price" value={formData.price} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary" />
              <p className="text-xs text-gray-400 mt-1">Used if no specific floor plan prices are added.</p>
            </div>

            <div className="md:col-span-2 space-y-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Property Types</label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 bg-gray-50 p-4 rounded border border-gray-200">
                  {localPropertyTypes.map(type => (
                    <label key={type} className="flex items-center space-x-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={(formData.propertyType || []).includes(type)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFormData(prev => {
                            const prevTypes = prev.propertyType || [];
                            return {
                              ...prev,
                              propertyType: checked 
                                ? [...prevTypes, type] 
                                : prevTypes.filter(t => t !== type)
                            };
                          });
                          setIsDirty(true);
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary cursor-pointer"
                      />
                      <span className="text-sm font-semibold text-gray-700 group-hover:text-brand-primary transition-colors">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Tentative Completion Date</label>
                <input 
                  type="text"
                  name="completionDate"
                  value={formData.completionDate}
                  onChange={handleInputChange}
                  placeholder="e.g. Q4 2026 or Dec 2026"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary"
                />
              </div>

              {/* Custom type creator */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Tag size={12} /> Manage Custom Types
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {localPropertyTypes.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 bg-white border border-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
                      {t}
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm("Are you sure you want to remove this custom type?")) return;
                          setLocalPropertyTypes(prev => prev.filter(type => type !== t));
                          setIsDirty(true);
                        }}
                        className="text-gray-400 hover:text-red-500 transition-colors ml-0.5"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add new type, e.g. Studio"
                    value={customTypeInput}
                    onChange={e => setCustomTypeInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { 
                        e.preventDefault(); 
                        if (customTypeInput.trim()) {
                          const newType = customTypeInput.trim();
                          setLocalPropertyTypes(prev => [...new Set([...prev, newType])].sort());
                          setFormData(prev => {
                            const prevTypes = prev.propertyType || [];
                            return {
                              ...prev,
                              propertyType: prevTypes.includes(newType) ? prevTypes : [...prevTypes, newType]
                            };
                          });
                          setIsDirty(true);
                          setCustomTypeInput('');
                        }
                      }
                    }}
                    className="flex-1 p-2 text-sm bg-white border border-gray-200 rounded outline-none focus:border-brand-primary"
                  />
                  <button
                    type="button"
                    disabled={!customTypeInput.trim()}
                    onClick={() => {
                      if (!customTypeInput.trim()) return;
                      const newType = customTypeInput.trim();
                      setLocalPropertyTypes(prev => [...new Set([...prev, newType])].sort());
                      setFormData(prev => {
                        const prevTypes = prev.propertyType || [];
                        return {
                          ...prev,
                          propertyType: prevTypes.includes(newType) ? prevTypes : [...prevTypes, newType]
                        };
                      });
                      setIsDirty(true);
                      setCustomTypeInput('');
                    }}
                    className="flex items-center gap-1 bg-brand-primary text-white px-3 py-2 rounded text-xs font-bold hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Status</label>
              <select name="status" value={formData.status} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary">
                <option value="Ready">Ready</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Under Construction">Under Construction</option>
                <option value="On Sale">On Sale</option>
                <option value="Sold Out">Sold Out</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Base Beds <span className="text-gray-400 font-normal normal-case">(Fallback)</span></label>
              <input type="number" name="beds" value={formData.beds} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary" />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Base Baths <span className="text-gray-400 font-normal normal-case">(Fallback)</span></label>
              <input type="number" name="baths" value={formData.baths} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Base Square Feet <span className="text-gray-400 font-normal normal-case">(Fallback)</span></label>
              <input type="text" name="sqft" value={formData.sqft} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary" />
              <p className="text-xs text-gray-400 mt-1">If you add specific "Unit Types (Floor Plans)" below, these base values are ignored, and ranges are auto-calculated instead.</p>
            </div>
          </div>

          <hr className="border-gray-100" />
          
          <h3 className="text-xl font-serif text-brand-dark mb-4">Technical Specifications</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-6 rounded-xl border border-gray-200">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Building Blueprint (Floor Structure)</label>
              <input type="text" name="buildingType" value={formData.buildingType} onChange={handleInputChange} placeholder="e.g. 4B+LG+UG+P4+M+40+MEP+20+PH+R" className="w-full p-3 bg-white border border-gray-200 rounded outline-none focus:border-brand-primary" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Land Area</label>
              <input type="text" name="landArea" value={formData.landArea} onChange={handleInputChange} placeholder="e.g. 10 Katha" className="w-full p-3 bg-white border border-gray-200 rounded outline-none focus:border-brand-primary" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Architect</label>
              <input type="text" name="architect" value={formData.architect} onChange={handleInputChange} placeholder="e.g. Inspace Architects Limited" className="w-full p-3 bg-white border border-gray-200 rounded outline-none focus:border-brand-primary" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Total Units in Project</label>
              <input type="number" name="totalUnits" value={formData.totalUnits} onChange={handleInputChange} placeholder="e.g. 120" className="w-full p-3 bg-white border border-gray-200 rounded outline-none focus:border-brand-primary" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Units Per Floor</label>
              <input type="number" name="unitsPerFloor" value={formData.unitsPerFloor} onChange={handleInputChange} placeholder="e.g. 4" className="w-full p-3 bg-white border border-gray-200 rounded outline-none focus:border-brand-primary" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Total Parking Available</label>
              <input type="number" name="parkingAvailable" value={formData.parkingAvailable} onChange={handleInputChange} placeholder="e.g. 150" className="w-full p-3 bg-white border border-gray-200 rounded outline-none focus:border-brand-primary" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Price Per Parking (৳)</label>
              <input type="number" name="parkingPrice" value={formData.parkingPrice} onChange={handleInputChange} placeholder="e.g. 3000000" className="w-full p-3 bg-white border border-gray-200 rounded outline-none focus:border-brand-primary" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Total Share</label>
              <input type="number" name="totalShare" value={formData.totalShare} onChange={handleInputChange} placeholder="e.g. 68" className="w-full p-3 bg-white border border-gray-200 rounded outline-none focus:border-brand-primary" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Passenger Lifts</label>
              <input type="number" name="passengerLifts" value={formData.passengerLifts} onChange={handleInputChange} placeholder="e.g. 4" className="w-full p-3 bg-white border border-gray-200 rounded outline-none focus:border-brand-primary" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Front Road Size</label>
              <input type="text" name="frontRoadSize" value={formData.frontRoadSize} onChange={handleInputChange} placeholder="e.g. 25 Ft" className="w-full p-3 bg-white border border-gray-200 rounded outline-none focus:border-brand-primary" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Nearby Landmarks (Comma Separated)</label>
              <input type="text" name="landmarks" value={formData.landmarks} onChange={handleInputChange} placeholder="e.g. Jamuna Future Park, Bashundhara City, 300 Feet Road" className="w-full p-3 bg-white border border-gray-200 rounded outline-none focus:border-brand-primary" />
            </div>
          </div>

          <hr className="border-gray-100" />
          
          <div>
            <div className="flex justify-between items-center mb-4">
              <div 
                className="flex flex-col cursor-pointer flex-1"
                onClick={() => setIsUnitTypesOpen(!isUnitTypesOpen)}
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-serif text-brand-dark hover:text-brand-primary transition-colors">Unit Types (Floor Plans)</h3>
                  <ChevronDown className={`text-gray-400 transition-transform ${isUnitTypesOpen ? 'rotate-180' : ''}`} size={20} />
                </div>
                <p className="text-sm text-gray-500 mt-1">Define the structural floor plans available in this property (e.g. Unit A, Unit B).</p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    availableUnits: [...prev.availableUnits, { name: '', size: '', beds: 0, baths: 0, balconies: 0, price: '' }]
                  }));
                  setIsUnitTypesOpen(true);
                  setIsDirty(true);
                }}
                className="bg-brand-primary text-white px-3 py-1 text-sm font-bold rounded flex items-center gap-1 hover:bg-brand-dark"
              >
                <Plus size={16} /> Add Unit
              </button>
            </div>
            
            {isUnitTypesOpen && (
            <div className="space-y-4">
              {formData.availableUnits.map((unit, idx) => (
                <div key={idx} className="flex flex-wrap md:flex-nowrap gap-3 bg-gray-50 p-4 rounded border border-gray-200 relative">
                  <button 
                    type="button" 
                    onClick={() => {
                      if (!window.confirm("Are you sure you want to remove this unit type?")) return;
                      setFormData(prev => ({ ...prev, availableUnits: prev.availableUnits.filter((_, i) => i !== idx) }));
                      setIsDirty(true);
                    }} 
                    className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={18} />
                  </button>
                  <div className="w-full md:w-1/5">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type Name</label>
                    <input type="text" value={unit.name} onChange={(e) => {
                      const newUnits = [...formData.availableUnits];
                      newUnits[idx].name = e.target.value;
                      setFormData(p => ({ ...p, availableUnits: newUnits }));
                      setIsDirty(true);
                    }} placeholder="e.g. Unit A" className="w-full p-2 border rounded" />
                  </div>
                  <div className="w-full md:w-1/5">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Size (SqFt)</label>
                    <input type="text" value={unit.size} onChange={(e) => {
                      const newUnits = [...formData.availableUnits];
                      newUnits[idx].size = e.target.value;
                      setFormData(p => ({ ...p, availableUnits: newUnits }));
                      setIsDirty(true);
                    }} placeholder="2705" className="w-full p-2 border rounded" />
                  </div>
                  <div className="w-full md:w-1/5">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Beds</label>
                    <input type="number" value={unit.beds} onChange={(e) => {
                      const newUnits = [...formData.availableUnits];
                      newUnits[idx].beds = e.target.value;
                      setFormData(p => ({ ...p, availableUnits: newUnits }));
                      setIsDirty(true);
                    }} className="w-full p-2 border rounded" />
                  </div>
                  <div className="w-full md:w-1/5">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Baths</label>
                    <input type="number" value={unit.baths} onChange={(e) => {
                      const newUnits = [...formData.availableUnits];
                      newUnits[idx].baths = e.target.value;
                      setFormData(p => ({ ...p, availableUnits: newUnits }));
                      setIsDirty(true);
                    }} className="w-full p-2 border rounded" />
                  </div>
                  <div className="w-full md:w-1/5">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Balconies</label>
                    <input type="number" value={unit.balconies} onChange={(e) => {
                      const newUnits = [...formData.availableUnits];
                      newUnits[idx].balconies = e.target.value;
                      setFormData(p => ({ ...p, availableUnits: newUnits }));
                      setIsDirty(true);
                    }} className="w-full p-2 border rounded" />
                  </div>
                  <div className="w-full md:w-1/5">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Price (৳)</label>
                    <input type="text" value={unit.price || ''} onChange={(e) => {
                      const newUnits = [...formData.availableUnits];
                      newUnits[idx].price = e.target.value;
                      setFormData(p => ({ ...p, availableUnits: newUnits }));
                      setIsDirty(true);
                    }} placeholder="e.g. 35000000" className="w-full p-2 border rounded" />
                  </div>
                </div>
              ))}
              {formData.availableUnits.length === 0 && (
                <p className="text-gray-400 text-sm italic">No specific units added yet.</p>
              )}
            </div>
            )}
          </div>

          <hr className="border-gray-100" />
          
          <div>
            <div className="flex justify-between items-center mb-4">
              <div 
                className="flex flex-col cursor-pointer flex-1"
                onClick={() => setIsUnitInventoryOpen(!isUnitInventoryOpen)}
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-serif text-brand-dark hover:text-brand-primary transition-colors">Exact Unit Inventory</h3>
                  <ChevronDown className={`text-gray-400 transition-transform ${isUnitInventoryOpen ? 'rotate-180' : ''}`} size={20} />
                </div>
                <p className="text-sm text-gray-500 mt-1">Define the actual physical units in the building. Admins select these when making a booking.</p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    inventory: [...(prev.inventory || []), { id: Math.random().toString(36).substr(2, 9), floor: '', unitName: '', unitType: '', status: 'Available' }]
                  }));
                  setIsUnitInventoryOpen(true);
                  setIsDirty(true);
                }}
                className="bg-brand-primary text-white px-3 py-1 text-sm font-bold rounded flex items-center gap-1 hover:bg-brand-dark"
              >
                <Plus size={16} /> Add Inventory Unit
              </button>
            </div>
            
            {isUnitInventoryOpen && (
            <div className="space-y-4">
              {(formData.inventory || []).map((unit, idx) => (
                <div key={unit.id} className="flex flex-wrap md:flex-nowrap gap-3 bg-gray-50 p-4 rounded border border-gray-200 relative">
                  <button 
                    type="button" 
                    onClick={() => {
                      if (!window.confirm("Are you sure you want to remove this inventory unit?")) return;
                      setFormData(prev => ({ ...prev, inventory: prev.inventory.filter((_, i) => i !== idx) }));
                      setIsDirty(true);
                    }} 
                    className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={18} />
                  </button>
                  <div className="w-full md:w-1/4">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Floor Number</label>
                    <input type="text" value={unit.floor} onChange={(e) => {
                      const newUnits = [...formData.inventory];
                      newUnits[idx].floor = e.target.value;
                      setFormData(p => ({ ...p, inventory: newUnits }));
                      setIsDirty(true);
                    }} placeholder="e.g. 12" className="w-full p-2 border rounded" />
                  </div>
                  <div className="w-full md:w-1/4">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Unit Name</label>
                    <input type="text" value={unit.unitName} onChange={(e) => {
                      const newUnits = [...formData.inventory];
                      newUnits[idx].unitName = e.target.value;
                      setFormData(p => ({ ...p, inventory: newUnits }));
                      setIsDirty(true);
                    }} placeholder="e.g. A" className="w-full p-2 border rounded" />
                  </div>
                  <div className="w-full md:w-1/4">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Unit Type</label>
                    <select value={unit.unitType} onChange={(e) => {
                      const newUnits = [...formData.inventory];
                      newUnits[idx].unitType = e.target.value;
                      setFormData(p => ({ ...p, inventory: newUnits }));
                      setIsDirty(true);
                    }} className="w-full p-2 border rounded bg-white">
                      <option value="">Select Type</option>
                      {formData.availableUnits.map(u => (
                        <option key={u.name} value={`${u.name} - ${u.size} sqft`}>{u.name} - {u.size} sqft</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full md:w-1/4">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                    <select value={unit.status} onChange={(e) => {
                      const newUnits = [...formData.inventory];
                      newUnits[idx].status = e.target.value;
                      setFormData(p => ({ ...p, inventory: newUnits }));
                      setIsDirty(true);
                    }} className="w-full p-2 border rounded bg-white">
                      <option value="Available">Available</option>
                      <option value="Booked">Booked</option>
                      <option value="On Hold">On Hold</option>
                    </select>
                  </div>
                </div>
              ))}
              {(!formData.inventory || formData.inventory.length === 0) && (
                <p className="text-gray-400 text-sm italic">No specific units defined yet. You can pre-define them here so admins can select them when booking.</p>
              )}
            </div>
            )}
          </div>

          <hr className="border-gray-100" />
          
          <div>
            <div className="flex justify-between items-center mb-4">
              <div 
                className="flex flex-col cursor-pointer flex-1"
                onClick={() => setIsParkingInventoryOpen(!isParkingInventoryOpen)}
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-serif text-brand-dark hover:text-brand-primary transition-colors">Parking Inventory</h3>
                  <ChevronDown className={`text-gray-400 transition-transform ${isParkingInventoryOpen ? 'rotate-180' : ''}`} size={20} />
                </div>
                <p className="text-sm text-gray-500 mt-1">Define individual parking spots so they can be tracked and assigned to clients without duplication. Each spot gets a unique ID.</p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    parkingInventory: [...(prev.parkingInventory || []), { 
                      id: `PKG-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                      label: '',
                      level: '',
                      zone: '',
                      status: 'Available',
                      assignedBookingId: null
                    }]
                  }));
                  setIsParkingInventoryOpen(true);
                  setIsDirty(true);
                }}
                className="bg-brand-primary text-white px-3 py-1 text-sm font-bold rounded flex items-center gap-1 hover:bg-brand-dark"
              >
                <Plus size={16} /> Add Parking Spot
              </button>
            </div>
            
            {isParkingInventoryOpen && (
            <div className="space-y-3">
              {(formData.parkingInventory || []).map((spot, idx) => (
                <div key={spot.id} className={`flex flex-wrap md:flex-nowrap gap-3 p-4 rounded border relative ${spot.status === 'Assigned' ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                  <button 
                    type="button" 
                    onClick={() => {
                      if (spot.status === 'Assigned') {
                        alert(`Cannot delete spot "${spot.label}" — it is currently assigned to a booking (${spot.assignedBookingId}). Release it from that booking first.`);
                        return;
                      }
                      if (!window.confirm("Are you sure you want to remove this parking spot?")) return;
                      setFormData(prev => ({ ...prev, parkingInventory: prev.parkingInventory.filter((_, i) => i !== idx) }));
                      setIsDirty(true);
                    }} 
                    className="absolute top-2 right-2 text-red-500 hover:text-red-700 disabled:opacity-30"
                  >
                    <Trash2 size={18} />
                  </button>
                  <div className="w-full md:w-1/5">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Spot ID</label>
                    <input type="text" value={spot.id} readOnly className="w-full p-2 border rounded bg-white/60 text-xs text-gray-500 font-mono cursor-not-allowed" />
                  </div>
                  <div className="w-full md:w-1/5">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Spot Label *</label>
                    <input type="text" value={spot.label} onChange={(e) => {
                      const updated = [...(formData.parkingInventory || [])];
                      updated[idx].label = e.target.value;
                      setFormData(p => ({ ...p, parkingInventory: updated }));
                      setIsDirty(true);
                    }} placeholder="e.g. B1-Spot A3" className="w-full p-2 border rounded bg-white" />
                  </div>
                  <div className="w-full md:w-1/5">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Level / Floor</label>
                    <input type="text" value={spot.level} onChange={(e) => {
                      const updated = [...(formData.parkingInventory || [])];
                      updated[idx].level = e.target.value;
                      setFormData(p => ({ ...p, parkingInventory: updated }));
                      setIsDirty(true);
                    }} placeholder="e.g. Basement 2" className="w-full p-2 border rounded bg-white" />
                  </div>
                  <div className="w-full md:w-1/5">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Zone / Section</label>
                    <input type="text" value={spot.zone} onChange={(e) => {
                      const updated = [...(formData.parkingInventory || [])];
                      updated[idx].zone = e.target.value;
                      setFormData(p => ({ ...p, parkingInventory: updated }));
                      setIsDirty(true);
                    }} placeholder="e.g. Section A" className="w-full p-2 border rounded bg-white" />
                  </div>
                  <div className="w-full md:w-1/5">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                    <span className={`inline-flex items-center gap-1 px-3 py-2 rounded text-xs font-bold w-full justify-center ${spot.status === 'Assigned' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-green-100 text-green-800 border border-green-300'}`}>
                      {spot.status === 'Assigned' ? `🔒 Assigned` : '✅ Available'}
                    </span>
                  </div>
                </div>
              ))}
              {(!formData.parkingInventory || formData.parkingInventory.length === 0) && (
                <p className="text-gray-400 text-sm italic">No parking spots defined yet. Click "Add Parking Spot" to define individual spots that can be tracked and assigned.</p>
              )}
            </div>
            )}
          </div>

          <hr className="border-gray-100" />
          
          <div>
            <h3 className="text-xl font-serif text-brand-dark mb-4 flex items-center gap-2"><CheckSquare className="text-brand-primary" /> Premium Amenities</h3>
            <p className="text-sm text-gray-500 mb-4">Select all amenities available at this property. They will automatically be displayed with beautiful icons on the details page.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-gray-50 p-6 rounded-xl border border-gray-200">
              {AVAILABLE_AMENITIES.map(amenity => (
                <label key={amenity} className="flex items-center space-x-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={formData.amenities.includes(amenity)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormData(prev => {
                        const hasAmenity = prev.amenities.includes(amenity);
                        return {
                          ...prev,
                          amenities: hasAmenity
                            ? prev.amenities.filter(a => a !== amenity)
                            : [...prev.amenities, amenity]
                        };
                      });
                      setIsDirty(true);
                    }}
                    className="w-5 h-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-brand-dark group-hover:text-brand-primary transition-colors">{amenity}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <div className="flex flex-col">
                <h4 className="text-lg font-serif text-brand-dark">Custom Amenities</h4>
                <p className="text-sm text-gray-500">Need something that isn't in the list? Add it here with a custom icon!</p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    customAmenities: [...(prev.customAmenities || []), { name: '', icon: 'CheckCircle' }]
                  }));
                  setIsDirty(true);
                }}
                className="bg-brand-primary text-white px-3 py-1 text-sm font-bold rounded flex items-center gap-1 hover:bg-brand-dark"
              >
                <Plus size={16} /> Add Custom
              </button>
            </div>
            <div className="space-y-4">
              {(formData.customAmenities || []).map((amenity, idx) => (
                <div key={idx} className="flex flex-wrap md:flex-nowrap gap-3 bg-gray-50 p-4 rounded border border-gray-200 relative items-center pr-12">
                  <button 
                    type="button" 
                    onClick={() => {
                      if (!window.confirm("Are you sure you want to remove this custom amenity?")) return;
                      setFormData(prev => ({ ...prev, customAmenities: prev.customAmenities.filter((_, i) => i !== idx) }));
                      setIsDirty(true);
                    }} 
                    className="absolute top-1/2 -translate-y-1/2 right-4 text-red-500 hover:text-red-700 p-2 bg-white rounded-full shadow-sm"
                  >
                    <Trash2 size={18} />
                  </button>
                  <div className="w-full md:w-1/2">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Amenity Name</label>
                    <input type="text" value={amenity.name} onChange={(e) => {
                      const newAms = [...formData.customAmenities];
                      newAms[idx].name = e.target.value;
                      setFormData(p => ({ ...p, customAmenities: newAms }));
                      setIsDirty(true);
                    }} placeholder="e.g. Infinity Edge Pool" className="w-full p-2 border rounded bg-white" />
                  </div>
                  <div className="w-full md:w-1/2 relative">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Select Icon</label>
                    <button 
                      type="button"
                      onClick={() => setOpenIconPicker(openIconPicker === idx ? null : idx)}
                      className="w-full flex items-center justify-between p-2.5 border border-gray-200 rounded bg-white hover:bg-gray-50 focus:border-brand-primary outline-none transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-brand-primary">
                          {(() => {
                             const IconComp = AVAILABLE_ICONS[amenity.icon] || AVAILABLE_ICONS['CheckCircle'];
                             return <IconComp size={20} />;
                          })()}
                        </div>
                        <span className="text-sm font-medium text-gray-700">{amenity.icon}</span>
                      </div>
                      <ChevronDown size={16} className={`text-gray-400 transition-transform ${openIconPicker === idx ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {openIconPicker === idx && (
                      <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl p-3 grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-60 overflow-y-auto">
                        {Object.entries(AVAILABLE_ICONS).map(([key, Icon]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              const newAms = [...formData.customAmenities];
                              newAms[idx].icon = key;
                              setFormData(p => ({ ...p, customAmenities: newAms }));
                              setIsDirty(true);
                              setOpenIconPicker(null);
                            }}
                            className={`p-2 flex justify-center items-center rounded hover:bg-brand-primary/10 hover:text-brand-primary transition-colors ${amenity.icon === key ? 'bg-brand-primary/10 text-brand-primary ring-1 ring-brand-primary' : 'text-gray-500'}`}
                            title={key}
                          >
                            <Icon size={20} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <hr className="border-gray-100" />
          
          <h3 className="text-xl font-serif text-brand-dark mb-4">Media Upload</h3>
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Hero Image</label>
              
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md bg-gray-50 hover:bg-gray-100 transition-colors relative">
                <div className="space-y-1 text-center">
                  {formData.images.hero ? (
                    <div className="flex flex-col items-center">
                      <img src={formData.images.hero} alt="Hero Preview" className="h-32 object-cover rounded-md mb-2 shadow-sm" />
                      <button type="button" onClick={() => {
                        if (window.confirm("Are you sure you want to remove this hero image?")) {
                          if (formData.images.hero?.includes('cloudinary.com')) setMediaToDelete(prev => [...prev, formData.images.hero]);
                          setFormData(p => ({...p, images: {...p.images, hero: ''}}));
                          setIsDirty(true);
                        }
                      }} className="text-xs text-red-500 hover:text-red-700 font-bold">Remove Image</button>
                    </div>
                  ) : uploadingImage === 'hero' ? (
                    <div className="flex flex-col items-center py-4">
                      <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                      <p className="text-sm text-brand-primary font-bold">Uploading...</p>
                    </div>
                  ) : (
                    <>
                      <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="flex text-sm text-gray-600 justify-center">
                        <label className="relative cursor-pointer bg-white rounded-md font-medium text-brand-primary hover:text-brand-dark focus-within:outline-none px-2 py-1">
                          <span>Upload a file</span>
                          <input type="file" className="sr-only" accept="image/*" disabled={uploadingImage !== null} onChange={(e) => handleFileUpload(e, 'hero')} />
                        </label>
                        <p className="pl-1 pt-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, WEBP up to 10MB</p>
                    </>
                  )}
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Or Paste Image URL Manually</label>
                <input type="url" name="hero" value={formData.images.hero} onChange={handleImageChange} placeholder="https://..." className="w-full p-2 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary text-sm" />
              </div>
              
              {formData.images.hero && formData.images.hero.includes('firebase') && (
                <div className="mt-2">
                  <p className="text-xs text-green-600 mb-1 font-bold">✓ Image Uploaded Successfully</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Map Image</label>
              
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md bg-gray-50 hover:bg-gray-100 transition-colors relative">
                <div className="space-y-1 text-center">
                  {formData.images.map ? (
                    <div className="flex flex-col items-center">
                      <img src={formData.images.map} alt="Map Preview" className="h-32 object-cover rounded-md mb-2 shadow-sm" />
                      <button type="button" onClick={() => {
                        if (window.confirm("Are you sure you want to remove this map image?")) {
                          if (formData.images.map?.includes('cloudinary.com')) setMediaToDelete(prev => [...prev, formData.images.map]);
                          setFormData(p => ({...p, images: {...p.images, map: ''}}));
                          setIsDirty(true);
                        }
                      }} className="text-xs text-red-500 hover:text-red-700 font-bold">Remove Image</button>
                    </div>
                  ) : uploadingImage === 'map' ? (
                    <div className="flex flex-col items-center py-4">
                      <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                      <p className="text-sm text-brand-primary font-bold">Uploading...</p>
                    </div>
                  ) : (
                    <>
                      <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="flex text-sm text-gray-600 justify-center">
                        <label className="relative cursor-pointer bg-white rounded-md font-medium text-brand-primary hover:text-brand-dark focus-within:outline-none px-2 py-1">
                          <span>Upload a file</span>
                          <input type="file" className="sr-only" accept="image/*" disabled={uploadingImage !== null} onChange={(e) => handleFileUpload(e, 'map')} />
                        </label>
                        <p className="pl-1 pt-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, WEBP up to 10MB</p>
                    </>
                  )}
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Or Paste Image URL Manually</label>
                <input type="url" name="map" value={formData.images.map} onChange={handleImageChange} placeholder="https://..." className="w-full p-2 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary text-sm" />
              </div>
              
              {formData.images.map && !formData.images.map.includes('drive.google.com') && (
                <div className="mt-2">
                  <p className="text-xs text-green-600 mb-1 font-bold">✓ Image Uploaded Successfully</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Floor Plan / Layout</label>
              
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md bg-gray-50 hover:bg-gray-100 transition-colors relative">
                <div className="space-y-1 text-center">
                  {formData.images.floorPlan ? (
                    <div className="flex flex-col items-center">
                      <img src={formData.images.floorPlan} alt="Floor Plan Preview" className="h-32 object-contain rounded-md mb-2 shadow-sm bg-white p-2" />
                      <button type="button" onClick={() => {
                        if (window.confirm("Are you sure you want to remove this floor plan image?")) {
                          if (formData.images.floorPlan?.includes('cloudinary.com')) setMediaToDelete(prev => [...prev, formData.images.floorPlan]);
                          setFormData(p => ({...p, images: {...p.images, floorPlan: ''}}));
                          setIsDirty(true);
                        }
                      }} className="text-xs text-red-500 hover:text-red-700 font-bold">Remove Image</button>
                    </div>
                  ) : uploadingImage === 'floorPlan' ? (
                    <div className="flex flex-col items-center py-4">
                      <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                      <p className="text-sm text-brand-primary font-bold">Uploading...</p>
                    </div>
                  ) : (
                    <>
                      <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="flex text-sm text-gray-600 justify-center">
                        <label className="relative cursor-pointer bg-white rounded-md font-medium text-brand-primary hover:text-brand-dark focus-within:outline-none px-2 py-1">
                          <span>Upload a file</span>
                          <input type="file" className="sr-only" accept="image/*" disabled={uploadingImage !== null} onChange={(e) => handleFileUpload(e, 'floorPlan')} />
                        </label>
                        <p className="pl-1 pt-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, WEBP up to 10MB</p>
                    </>
                  )}
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Or Paste Image URL Manually</label>
                <input type="url" name="floorPlan" value={formData.images.floorPlan || ''} onChange={handleImageChange} placeholder="https://..." className="w-full p-2 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary text-sm" />
              </div>
              
              {formData.images.floorPlan && !formData.images.floorPlan.includes('drive.google.com') && (
                <div className="mt-2">
                  <p className="text-xs text-green-600 mb-1 font-bold">✓ Image Uploaded Successfully</p>
                </div>
              )}
            </div>
            
            {/* GALLERY SECTION */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <label className="block text-sm font-bold text-brand-primary uppercase tracking-wider mb-4 border-b pb-3">Image Gallery</label>
              
              <div className="mb-4">
                <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md bg-gray-50 hover:bg-gray-100 transition-colors relative">
                  <div className="space-y-1 text-center">
                    {uploadingImage === 'gallery' ? (
                      <div className="flex flex-col items-center py-4">
                        <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                        <p className="text-sm text-brand-primary font-bold">Uploading...</p>
                      </div>
                    ) : (
                      <>
                        <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className="flex text-sm text-gray-600 justify-center">
                          <label className="relative cursor-pointer bg-white rounded-md font-medium text-brand-primary hover:text-brand-dark focus-within:outline-none px-2 py-1">
                            <span>Upload multiple images</span>
                            <input type="file" className="sr-only" accept="image/*" multiple disabled={uploadingImage !== null} onChange={handleGalleryUpload} />
                          </label>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">PNG, JPG, WEBP up to 10MB each</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {formData.images.gallery && formData.images.gallery.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {formData.images.gallery.map((url, idx) => (
                    <div key={idx} className="relative group rounded-md overflow-hidden border border-gray-200 aspect-square">
                      <img src={url} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => removeGalleryImage(url)}
                          className="bg-red-500 hover:bg-red-600 text-white rounded-full p-2"
                          title="Remove Image"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* VIDEO SECTION */}
            <div>
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Property Video (YouTube URL)</label>
              <div className="mt-1">
                <input 
                  type="url" 
                  name="video" 
                  value={formData.images.video || ''} 
                  onChange={handleImageChange} 
                  placeholder="https://www.youtube.com/watch?v=..." 
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary text-sm transition-colors" 
                />
                <p className="text-xs text-gray-500 mt-2">Paste a YouTube video link to feature on the property details page.</p>
              </div>
            </div>

            {/* BROCHURE SECTION */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <label className="block text-sm font-bold text-brand-primary uppercase tracking-wider mb-4 border-b pb-3">Property Brochure</label>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Option 1: External Link</label>
                  <p className="text-xs text-gray-500 mb-3">Paste a public Google Drive or Dropbox link here.</p>
                  
                  {formData.brochureUrl && (formData.brochureUrl.includes('cloudinary') || formData.brochureUrl.includes('firebasestorage')) ? (
                    <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-md">
                       <div className="flex items-center gap-3">
                         <FileText size={24} className="text-indigo-500" />
                         <div className="flex flex-col">
                           <span className="text-sm text-indigo-900 font-bold">Uploaded Document</span>
                           <a href={formData.brochureUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 underline">View PDF</a>
                         </div>
                       </div>
                       <button 
                         type="button"
                         onClick={() => {
                           if (window.confirm("Are you sure you want to remove this brochure file?")) {
                             if (formData.brochureUrl?.includes('cloudinary.com')) {
                               setMediaToDelete(prev => [...prev, formData.brochureUrl]);
                             } else if (formData.brochureUrl?.includes('firebasestorage')) {
                               try {
                                 const oldRef = ref(storage, formData.brochureUrl);
                                 deleteObject(oldRef).catch(console.error);
                               } catch (e) {
                                 console.error("Firebase deletion error:", e);
                               }
                             }
                             setFormData(p => ({...p, brochureUrl: ''}));
                             setIsDirty(true);
                           }
                         }}
                         className="text-xs font-bold text-red-600 hover:text-red-800 px-4 py-2 bg-red-100 rounded-md transition-colors"
                       >
                         Remove File
                       </button>
                    </div>
                  ) : (
                    <input 
                      type="url" 
                      value={formData.brochureUrl || ''} 
                      onChange={(e) => {
                        setFormData(p => ({...p, brochureUrl: e.target.value}));
                        setIsDirty(true);
                      }} 
                      placeholder="https://drive.google.com/..." 
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary" 
                    />
                  )}
                </div>

                {!formData.brochureUrl?.includes('cloudinary') && !formData.brochureUrl?.includes('firebasestorage') && (
                  <>
                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-gray-200"></div>
                      <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-bold uppercase">Or</span>
                      <div className="flex-grow border-t border-gray-200"></div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Option 2: Direct Upload (Firebase Storage)</label>
                      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="space-y-1 text-center">
                          {uploadingImage === 'brochure' ? (
                            <div className="flex flex-col items-center py-4">
                              <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                              <p className="text-sm text-brand-primary font-bold">Uploading...</p>
                            </div>
                          ) : (
                            <>
                              <FileText className="mx-auto h-12 w-12 text-gray-400" />
                              <div className="flex text-sm text-gray-600 justify-center mt-2">
                                <label className="relative cursor-pointer bg-white rounded-md font-medium text-brand-primary hover:text-brand-dark focus-within:outline-none px-2 py-1 shadow-sm border border-gray-200">
                                  <span>Select PDF File</span>
                                  <input type="file" className="sr-only" accept=".pdf" disabled={uploadingImage !== null} onChange={(e) => handleFileUpload(e, 'brochure')} />
                                </label>
                              </div>
                              <p className="text-xs text-gray-500 mt-2">Any size PDF supported</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button type="submit" disabled={loading} className="w-full bg-brand-primary text-white font-bold py-4 rounded hover:bg-brand-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              <Save size={20} /> {loading ? 'Saving...' : 'Save Property'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
