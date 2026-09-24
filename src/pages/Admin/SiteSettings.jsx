import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Save, Loader2, Facebook, Youtube, Linkedin, MessageCircle } from 'lucide-react';
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
                  <Facebook size={18} className="text-blue-600" /> Facebook Page URL
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
                  <Linkedin size={18} className="text-blue-700" /> LinkedIn Page URL
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
                  <Youtube size={18} className="text-red-600" /> YouTube Channel URL
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
