import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Phone, Mail, Loader2, ChevronDown } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { useGlobalState } from '../context/GlobalState';
import { Link, useLocation } from 'react-router-dom';

export default function Contact() {
  const { isLoggedIn, userProfile } = useGlobalState();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const propertyParam = searchParams.get('property');

  const formatPropertyName = (id) => {
    if (!id) return '';
    return id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const initialInquiry = propertyParam ? 'Brochure Request' : 'Domestic Investment';

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    inquiryType: initialInquiry,
    message: ''
  });
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const inquiryOptions = [
    'Domestic Investment',
    'NRB / International Purchase',
    'Brochure Request',
    'Virtual Tour Request',
    'Private Consultation'
  ];

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
    if (!agreed) {
      toast.error("You must agree to the Privacy Policy to submit.");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'inquiries'), {
        ...formData,
        propertyName: propertyParam ? formatPropertyName(propertyParam) : null,
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
      setAgreed(false);
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
            Viridian Nexus Development Ltd. was founded on a singular vision: to elevate Bangladesh's real estate sector to uncompromising global standards. We are not standard contractors; we are visionary developers committed to architectural mastery and structural integrity.
          </p>

          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <MapPin className="text-brand-accent shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-brand-accent">Corporate Office</h4>
                <p className="opacity-80">House # 85, Road # 07, Sector # 04<br/>Uttara, Dhaka-1230.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <Phone className="text-brand-accent shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-brand-accent">Direct Lines</h4>
                <p className="opacity-80">+8802-58953042<br/>01577740874</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Mail className="text-brand-accent shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-brand-accent">Electronic Mail</h4>
                <p className="opacity-80">veridiannexusdev@gmail.com</p>
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

            <div className="relative" ref={dropdownRef}>
              <label className="block text-sm font-bold text-brand-dark mb-2 uppercase tracking-wider">Inquiry Type</label>
              <div 
                className="w-full border-b-2 border-brand-primary/20 p-2 flex justify-between items-center cursor-pointer hover:border-brand-primary transition-colors"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span className="text-brand-dark font-medium">{formData.inquiryType}</span>
                <ChevronDown size={18} className={`text-brand-primary transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
              
              {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-100 shadow-2xl rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                  {inquiryOptions.map((option) => (
                    <div 
                      key={option}
                      className={`p-4 cursor-pointer text-sm transition-colors border-b border-gray-50 last:border-0 ${formData.inquiryType === option ? 'bg-brand-primary/10 text-brand-primary font-bold' : 'text-brand-dark hover:bg-brand-primary/5 hover:text-brand-primary'}`}
                      onClick={() => {
                        setFormData(p => ({...p, inquiryType: option}));
                        setIsDropdownOpen(false);
                      }}
                    >
                      {option}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-brand-dark mb-2 uppercase tracking-wider">Message *</label>
              <textarea rows="4" required value={formData.message} onChange={(e) => setFormData(p => ({...p, message: e.target.value}))} className="w-full border-b-2 border-brand-primary/20 p-2 focus:outline-none focus:border-brand-primary bg-transparent transition-colors resize-none"></textarea>
            </div>

            <div className="flex items-start gap-3 mt-4">
              <input 
                type="checkbox" 
                id="privacy"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
              />
              <label htmlFor="privacy" className="text-sm text-gray-600 leading-relaxed">
                I agree to the processing of my personal data in accordance with the <a href="/privacy" className="text-brand-primary font-bold hover:underline">Privacy Policy</a>. I understand that Viridian Nexus Development Ltd. will use this information to contact me regarding my inquiry.
              </label>
            </div>

            <button type="submit" disabled={loading || !agreed} className="w-full bg-brand-primary flex items-center justify-center gap-2 text-white py-4 font-bold uppercase tracking-widest hover:bg-brand-dark transition-colors mt-8 disabled:opacity-70 disabled:cursor-not-allowed">
              {loading && <Loader2 className="animate-spin" size={20} />}
              {loading ? 'Submitting...' : 'Submit Inquiry'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
