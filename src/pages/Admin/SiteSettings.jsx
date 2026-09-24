import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Save, Loader2, MessageCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import AdminSidebar from '../../components/AdminSidebar';
import { useGlobalState } from '../../context/GlobalState';

export default function SiteSettings() {
  const { userProfile, isSuperAdmin } = useGlobalState();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    facebookUrl: '',
    youtubeUrl: '',
    linkedinUrl: '',
    whatsappNumber: ''
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'site');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setFormData(prev => ({ ...prev, ...snap.data() }));
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load site settings.");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      toast.error("Only Super Admins can update global site settings.");
      return;
    }
    
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'site'), {
        ...formData,
        lastUpdatedAt: serverTimestamp(),
        lastUpdatedBy: userProfile?.uid
      }, { merge: true });
      toast.success("Site settings updated successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update site settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <AdminSidebar />
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="animate-spin text-brand-primary" size={48} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <AdminSidebar />
      <div className="flex-1 overflow-auto flex flex-col">
        <header className="bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 font-serif">Site Settings</h1>
            <p className="text-gray-500 mt-1">Manage global website configurations like social media and contact links.</p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving || !isSuperAdmin}
            className="px-6 py-3 bg-brand-primary text-white font-bold rounded-lg flex items-center gap-2 hover:bg-brand-dark transition-colors disabled:opacity-50 shadow-md"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            Save Settings
          </button>
        </header>

        <main className="flex-1 p-8">
          <div className="max-w-3xl bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
            {!isSuperAdmin && (
              <div className="mb-6 p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-sm font-bold">
                You are viewing in read-only mode. Only Super Admins can modify these settings.
              </div>
            )}
            
            <h2 className="text-xl font-bold font-serif mb-6 border-b pb-2">Social Media & Contact Links</h2>
            
            <form className="space-y-6" onSubmit={handleSubmit}>
              
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-blue-600">
                    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/>
                  </svg>
                  Facebook Page URL
                </label>
                <input
                  type="url"
                  name="facebookUrl"
                  value={formData.facebookUrl}
                  onChange={handleChange}
                  placeholder="https://facebook.com/viridiannexus"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary/50 outline-none"
                  disabled={!isSuperAdmin}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-blue-700">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn Page URL
                </label>
                <input
                  type="url"
                  name="linkedinUrl"
                  value={formData.linkedinUrl}
                  onChange={handleChange}
                  placeholder="https://linkedin.com/company/viridiannexus"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary/50 outline-none"
                  disabled={!isSuperAdmin}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-red-600">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.377.55a3.016 3.016 0 0 0-2.122 2.136C0 8.07 0 12 0 12s0 3.93.498 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.55 9.377.55 9.377.55s7.505 0 9.377-.55a3.016 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  YouTube Channel URL
                </label>
                <input
                  type="url"
                  name="youtubeUrl"
                  value={formData.youtubeUrl}
                  onChange={handleChange}
                  placeholder="https://youtube.com/@viridiannexus"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary/50 outline-none"
                  disabled={!isSuperAdmin}
                />
              </div>

              <div className="pt-4 border-t border-gray-100">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                  <MessageCircle size={18} className="text-green-500" /> WhatsApp Number
                </label>
                <p className="text-xs text-gray-500 mb-2">Include country code without the plus sign (e.g., 8801712345678). This powers the floating WhatsApp button.</p>
                <input
                  type="text"
                  name="whatsappNumber"
                  value={formData.whatsappNumber}
                  onChange={handleChange}
                  placeholder="88017XXXXXXXX"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary/50 outline-none"
                  disabled={!isSuperAdmin}
                />
              </div>

            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
