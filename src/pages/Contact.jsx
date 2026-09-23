import React, { useState } from 'react';
import { MapPin, Phone, Mail, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { useGlobalState } from '../context/GlobalState';
import { Link, useLocation } from 'react-router-dom';

export default function Contact() {
  const { isLoggedIn, userProfile } = useGlobalState();
  const location = useLocation();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    inquiryType: 'Domestic Investment',
    message: ''
  });
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isLoggedIn && userProfile) {
      setFormData(prev => ({
        ...prev,
        name: userProfile.displayName || '',
        phone: userProfile.phone || '',
        email: userProfile.email || ''
      }));
    }
  }, [isLoggedIn, userProfile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone || !formData.email || !formData.message) {
      toast.error("Please fill out all fields.");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'inquiries'), {
        ...formData,
        status: 'Unread',
        source: 'Corporate Contact Page',
        createdAt: serverTimestamp()
      });
      
      toast.success("Thank you! Your inquiry has been submitted successfully.");
      setFormData({
        name: '',
        phone: '',
        email: '',
        inquiryType: 'Domestic Investment',
        message: ''
      });
    } catch (error) {
      console.error("Error submitting inquiry:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="w-full bg-brand-neutral">
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[80vh]">
        {/* Left Side - Vision & Info */}
        <div className="bg-brand-dark text-brand-neutral p-12 lg:p-24 flex flex-col justify-center">
          <h1 className="text-4xl md:text-5xl font-serif text-brand-accent mb-6">Corporate Profile</h1>
          <p className="text-lg opacity-90 mb-12 leading-relaxed">
            Viridian Nexus was founded on a singular vision: to elevate Bangladesh's real estate sector to uncompromising global standards. We are not standard contractors; we are visionary developers committed to architectural mastery and structural integrity.
          </p>

          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <MapPin className="text-brand-accent shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-brand-accent">Corporate Office</h4>
                <p className="opacity-80">Level 8, Nexus Tower, Gulshan Avenue<br/>Dhaka 1212, Bangladesh</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <Phone className="text-brand-accent shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-brand-accent">Direct Lines</h4>
                <p className="opacity-80">Domestic: +880 96 0000 0000<br/>International: +1 (800) 123-4567</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Mail className="text-brand-accent shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-brand-accent">Electronic Mail</h4>
                <p className="opacity-80">investors@viridiannexus.com</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="bg-white p-12 lg:p-24 flex flex-col justify-center">
          <h2 className="text-3xl font-serif text-brand-dark mb-2">Request an Executive Briefing</h2>
          <p className="text-brand-text mb-8">Secure your private consultation with our investment advisory team.</p>

          {!isLoggedIn && (
            <div className="bg-brand-primary/10 border border-brand-primary/20 p-4 mb-8 rounded text-sm text-brand-dark">
              <span className="font-semibold text-brand-primary">Have an account? </span>
              <Link to={`/auth?redirect=${encodeURIComponent(location.pathname)}`} className="font-bold text-brand-primary hover:underline underline-offset-2">
                Sign in
              </Link>
              <span> to automatically link this inquiry to your profile.</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-brand-dark mb-2 uppercase tracking-wider">Full Name *</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} readOnly={isLoggedIn} className={`w-full border-b-2 border-brand-primary/20 p-2 focus:outline-none focus:border-brand-primary bg-transparent transition-colors ${isLoggedIn ? 'opacity-70 cursor-not-allowed' : ''}`} />
              </div>
              <div>
                <label className="block text-sm font-bold text-brand-dark mb-2 uppercase tracking-wider">Phone / WhatsApp *</label>
                <input type="tel" required value={formData.phone} onChange={(e) => setFormData(p => ({...p, phone: e.target.value}))} readOnly={isLoggedIn} className={`w-full border-b-2 border-brand-primary/20 p-2 focus:outline-none focus:border-brand-primary bg-transparent transition-colors ${isLoggedIn ? 'opacity-70 cursor-not-allowed' : ''}`} />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-brand-dark mb-2 uppercase tracking-wider">Email Address *</label>
              <input type="email" required value={formData.email} onChange={(e) => setFormData(p => ({...p, email: e.target.value}))} readOnly={isLoggedIn} className={`w-full border-b-2 border-brand-primary/20 p-2 focus:outline-none focus:border-brand-primary bg-transparent transition-colors ${isLoggedIn ? 'opacity-70 cursor-not-allowed' : ''}`} />
            </div>

            <div>
              <label className="block text-sm font-bold text-brand-dark mb-2 uppercase tracking-wider">Inquiry Type</label>
              <select value={formData.inquiryType} onChange={(e) => setFormData(p => ({...p, inquiryType: e.target.value}))} className="w-full border-b-2 border-brand-primary/20 p-2 focus:outline-none focus:border-brand-primary bg-transparent transition-colors">
                <option>Domestic Investment</option>
                <option>NRB / International Purchase</option>
                <option>Virtual Tour Request</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-brand-dark mb-2 uppercase tracking-wider">Message *</label>
              <textarea rows="4" required value={formData.message} onChange={(e) => setFormData(p => ({...p, message: e.target.value}))} className="w-full border-b-2 border-brand-primary/20 p-2 focus:outline-none focus:border-brand-primary bg-transparent transition-colors resize-none"></textarea>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-brand-primary flex items-center justify-center gap-2 text-white py-4 font-bold uppercase tracking-widest hover:bg-brand-dark transition-colors mt-8 disabled:opacity-70">
              {loading && <Loader2 className="animate-spin" size={20} />}
              {loading ? 'Submitting...' : 'Submit Inquiry'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
