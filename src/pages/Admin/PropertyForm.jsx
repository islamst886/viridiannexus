import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ArrowLeft, Save, CheckSquare, Plus, Trash2, FileText, Tag, X } from 'lucide-react';
import { usePropertyTypes } from '../../hooks/usePropertyTypes';
import { useGlobalState } from '../../context/GlobalState';

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
  const { adminUnsavedChanges: isDirty, setAdminUnsavedChanges: setIsDirty } = useGlobalState();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    location: '',
    price: '',
    status: 'Ready',
    propertyType: '',
    beds: 0,
    baths: 0,
    sqft: '',
    buildingType: '',
    unitsPerFloor: '',
    frontRoadSize: '',
    totalShare: '',
    landmarks: '',
    completionDate: '',
    overview: '',
    brochureUrl: '',
    availableUnits: [],
    inventory: [],
    amenities: [],
    images: {
      hero: '',
      map: '',
      video: '',
    }
  });

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

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

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
          availableUnits: data.availableUnits || [],
          inventory: data.inventory || [],
          propertyType: data.propertyType || '',
          buildingType: data.buildingType || '',
          unitsPerFloor: data.unitsPerFloor || '',
          passengerLifts: data.passengerLifts || '',
          frontRoadSize: data.frontRoadSize || '',
          totalShare: data.totalShare || '',
          landmarks: data.landmarks || '',
          completionDate: data.completionDate || '',
          overview: data.overview || '',
          brochureUrl: data.brochureUrl || ''
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

  const deleteCloudinaryMedia = async (url) => {
    if (!url || !url.includes('cloudinary.com')) return;
    try {
      const res = await fetch('/api/deleteMedia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!res.ok) {
        console.warn("Media deletion skipped. Note: /api/deleteMedia requires Wrangler for local testing or a deployed Cloudflare environment.");
      }
    } catch (err) {
      console.error("Deletion API error:", err);
    }
  };

  const handleFileUpload = async (e, mediaType) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(mediaType);
    toast.info(`Uploading ${mediaType}...`);
    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
      
      if (!cloudName || !uploadPreset) {
        throw new Error("Cloudinary keys are missing in the .env file!");
      }

      // 'auto' safely handles images, videos, and PDFs
      const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('upload_preset', uploadPreset);

      const res = await fetch(url, { method: 'POST', body: uploadData });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error?.message || 'Upload failed');
      
      // Handle brochure specifically
      if (mediaType === 'brochure') {
        const oldBrochure = formData.brochureUrl;
        if (oldBrochure && oldBrochure.includes('cloudinary.com')) {
          toast.info("Cleaning up old brochure...");
          await deleteCloudinaryMedia(oldBrochure);
        }
        setFormData(prev => ({ ...prev, brochureUrl: data.secure_url }));
        toast.success(`Brochure uploaded successfully!`);
        return;
      }

      // If replacing an existing Cloudinary image, delete the old one securely via backend
      const oldUrl = formData.images[mediaType];
      if (oldUrl && oldUrl.includes('cloudinary.com')) {
        toast.info(`Cleaning up old ${mediaType}...`);
        await deleteCloudinaryMedia(oldUrl);
      }

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
        passengerLifts: formData.passengerLifts,
        frontRoadSize: formData.frontRoadSize,
        totalShare: formData.totalShare,
        landmarks: formData.landmarks,
        completionDate: formData.completionDate,
        overview: formData.overview,
        brochureUrl: formData.brochureUrl,
        availableUnits: formData.availableUnits,
        inventory: formData.inventory,
        amenities: formData.amenities,
        images: formData.images
      }, { merge: true });

      // Save custom property types if dirty
      await setDoc(doc(db, 'settings', 'propertyTypes'), { types: localPropertyTypes });

      setIsDirty(false);
      toast.success(`Property ${isEditing ? 'updated' : 'created'} successfully!`);
      navigate('/admin/dashboard');
    } catch (error) {
      console.error(error);
      toast.error("Error saving property");
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
            <button onClick={handleBack} className="p-2 bg-white rounded-full shadow hover:bg-gray-100 transition">
              <ArrowLeft size={24} className="text-brand-dark" />
            </button>
            <h1 className="text-3xl font-serif text-brand-dark">{isEditing ? 'Edit Property' : 'Create New Property'}</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-8">
          
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
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Property Overview (Description)</label>
              <textarea name="overview" value={formData.overview} onChange={handleInputChange} rows="5" placeholder="Write a captivating description of this property..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary"></textarea>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Price (৳)</label>
              <input type="text" name="price" value={formData.price} onChange={handleInputChange} required className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary" />
            </div>

            <div className="md:col-span-2 space-y-6">
              <div>
                <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Status</label>
                <select 
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary"
                >
                  <option value="Ready">Ready</option>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Upcoming">Upcoming</option>
                  <option value="Under Construction">Under Construction</option>
                  <option value="On Sale">On Sale</option>
                  <option value="Sold Out">Sold Out</option>
                </select>
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
                          setFormData(prev => ({ ...prev, propertyType: newType }));
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
                      setFormData(prev => ({ ...prev, propertyType: newType }));
                      setIsDirty(true);
                      setCustomTypeInput('');
                    }}
                    className="flex items-center gap-1 bg-brand-primary text-white px-3 py-2 rounded text-xs font-bold hover:bg-brand-dark transition-colors disabled:opacity-50"
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
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Beds</label>
              <input type="number" name="beds" value={formData.beds} onChange={handleInputChange} required className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary" />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Baths</label>
              <input type="number" name="baths" value={formData.baths} onChange={handleInputChange} required className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Square Feet</label>
              <input type="text" name="sqft" value={formData.sqft} onChange={handleInputChange} required className="w-full p-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary" />
            </div>
          </div>

          <hr className="border-gray-100" />
          
          <h3 className="text-xl font-serif text-brand-dark mb-4">Technical Specifications</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-6 rounded-xl border border-gray-200">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Building Type</label>
              <input type="text" name="buildingType" value={formData.buildingType} onChange={handleInputChange} placeholder="e.g. B+G+M+17" className="w-full p-3 bg-white border border-gray-200 rounded outline-none focus:border-brand-primary" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Units Per Floor</label>
              <input type="number" name="unitsPerFloor" value={formData.unitsPerFloor} onChange={handleInputChange} placeholder="e.g. 4" className="w-full p-3 bg-white border border-gray-200 rounded outline-none focus:border-brand-primary" />
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
              <div className="flex flex-col">
                <h3 className="text-xl font-serif text-brand-dark">Unit Types (Floor Plans)</h3>
                <p className="text-sm text-gray-500 mt-1">Define the structural floor plans available in this property (e.g. Unit A, Unit B).</p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    availableUnits: [...prev.availableUnits, { name: '', size: '', beds: 0, baths: 0, balconies: 0 }]
                  }));
                  setIsDirty(true);
                }}
                className="bg-brand-primary text-white px-3 py-1 text-sm font-bold rounded flex items-center gap-1 hover:bg-brand-dark"
              >
                <Plus size={16} /> Add Unit
              </button>
            </div>
            <div className="space-y-4">
              {formData.availableUnits.map((unit, idx) => (
                <div key={idx} className="flex flex-wrap md:flex-nowrap gap-3 bg-gray-50 p-4 rounded border border-gray-200 relative">
                  <button 
                    type="button" 
                    onClick={() => {
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
                </div>
              ))}
              {formData.availableUnits.length === 0 && (
                <p className="text-gray-400 text-sm italic">No specific units added yet.</p>
              )}
            </div>
          </div>

          <hr className="border-gray-100" />
          
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex flex-col">
                <h3 className="text-xl font-serif text-brand-dark">Exact Unit Inventory</h3>
                <p className="text-sm text-gray-500 mt-1">Define the actual physical units in the building. Admins select these when making a booking.</p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    inventory: [...(prev.inventory || []), { id: Math.random().toString(36).substr(2, 9), floor: '', unitName: '', unitType: '', status: 'Available' }]
                  }));
                  setIsDirty(true);
                }}
                className="bg-brand-primary text-white px-3 py-1 text-sm font-bold rounded flex items-center gap-1 hover:bg-brand-dark"
              >
                <Plus size={16} /> Add Inventory Unit
              </button>
            </div>
            <div className="space-y-4">
              {(formData.inventory || []).map((unit, idx) => (
                <div key={unit.id} className="flex flex-wrap md:flex-nowrap gap-3 bg-gray-50 p-4 rounded border border-gray-200 relative">
                  <button 
                    type="button" 
                    onClick={() => {
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
                      <button type="button" onClick={() => setFormData(p => ({...p, images: {...p.images, hero: ''}}))} className="text-xs text-red-500 hover:text-red-700 font-bold">Remove Image</button>
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
                      <button type="button" onClick={() => setFormData(p => ({...p, images: {...p.images, map: ''}}))} className="text-xs text-red-500 hover:text-red-700 font-bold">Remove Image</button>
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
            <div>
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Property Brochure (PDF)</label>
              
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md bg-gray-50 hover:bg-gray-100 transition-colors relative">
                <div className="space-y-1 text-center">
                  {formData.brochureUrl ? (
                    <div className="flex flex-col items-center">
                      <FileText size={48} className="text-brand-primary mb-2" />
                      <a href={formData.brochureUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 underline mb-2">View Uploaded PDF</a>
                      <button 
                        type="button" 
                        onClick={() => {
                          if (formData.brochureUrl.includes('cloudinary')) {
                            toast.info("Deleting brochure securely...");
                            deleteCloudinaryMedia(formData.brochureUrl);
                          }
                          setFormData(p => ({...p, brochureUrl: ''}));
                        }} 
                        className="text-xs text-red-500 hover:text-red-700 font-bold"
                      >
                        Remove Brochure
                      </button>
                    </div>
                  ) : uploadingImage === 'brochure' ? (
                    <div className="flex flex-col items-center py-4">
                      <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                      <p className="text-sm text-brand-primary font-bold">Uploading Brochure...</p>
                    </div>
                  ) : (
                    <>
                      <FileText className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600 justify-center mt-2">
                        <label className="relative cursor-pointer bg-white rounded-md font-medium text-brand-primary hover:text-brand-dark focus-within:outline-none px-2 py-1">
                          <span>Upload a PDF</span>
                          <input type="file" className="sr-only" accept=".pdf" disabled={uploadingImage !== null} onChange={(e) => handleFileUpload(e, 'brochure')} />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">PDF up to 10MB</p>
                    </>
                  )}
                </div>
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
