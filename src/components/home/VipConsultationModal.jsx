import React, { useState, useEffect } from 'react';
import { X, Calendar, Building2, Phone, Mail, User, ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '../../supabase';
import { toast } from 'react-toastify';
import { useGlobalState } from '../../context/GlobalState';

export default function VipConsultationModal({ isOpen, onClose, defaultProperty = '' }) {
  const { isLoggedIn, userProfile } = useGlobalState();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    preferredType: 'In-Person VIP Site Visit',
    targetProperty: defaultProperty || 'Jolshiri Abashon Flagship',
    preferredDate: '',
    notes: ''
  });

  useEffect(() => {
    if (defaultProperty) {
      setFormData(prev => ({ ...prev, targetProperty: defaultProperty }));
    }
  }, [defaultProperty]);

  useEffect(() => {
    if (isLoggedIn && userProfile) {
      setFormData(prev => ({
        ...prev,
        name: userProfile.displayName || '',
        phone: userProfile.phone || '',
        email: userProfile.email || ''
      }));
    }
  }, [isLoggedIn, userProfile]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.email) {
      toast.error('Please provide your name, phone number, and email.');
      return;
    }

    setLoading(true);
    try {
      const messageBody = `[VIP Consultation Request]\nType: ${formData.preferredType}\nTarget Property: ${formData.targetProperty}\nPreferred Date: ${formData.preferredDate || 'Earliest Available'}\nClient Notes: ${formData.notes || 'None'}`;

      const { error } = await supabase.from('inquiries').insert({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        inquiry_type: 'Private Consultation',
        message: messageBody,
        property_name: formData.targetProperty,
        status: 'Unread',
        source: 'VIP Consultation Modal'
      });

      if (error) throw error;

      toast.success('Your VIP consultation request has been received. Our Private Client Advisor will contact you shortly.');
      onClose();
    } catch (err) {
      console.error('Error submitting consultation:', err);
      toast.error('Unable to send request right now. Please try again or reach out on WhatsApp.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-brand-accent/30 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-brand-dark via-brand-primary to-brand-dark px-6 py-5 text-white flex justify-between items-center border-b border-brand-accent/20">
          <div>
            <span className="text-[10px] tracking-[0.25em] uppercase text-brand-accent font-bold block mb-1">
              Private Client Advisory
            </span>
            <h3 className="font-serif text-2xl text-white">Schedule Private Viewing</h3>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-brand-accent flex items-center justify-center transition-colors"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-4">
          <p className="text-xs text-brand-text/70 leading-relaxed pb-1">
            Experience our flagship residences with an exclusive, chauffeured site visit or an international private video walkthrough tailored to your timezone.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-dark mb-1">
                Full Name *
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-3 text-brand-primary/60" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Barrister Tariq Rahman"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-brand-neutral border border-gray-200 rounded-lg focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-dark mb-1">
                Phone Number (with country code) *
              </label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-3 text-brand-primary/60" />
                <input
                  type="tel"
                  required
                  placeholder="+880 1711-000000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-brand-neutral border border-gray-200 rounded-lg focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-dark mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3 text-brand-primary/60" />
                <input
                  type="email"
                  required
                  placeholder="client@luxury.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-brand-neutral border border-gray-200 rounded-lg focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-dark mb-1">
                Consultation Type
              </label>
              <select
                value={formData.preferredType}
                onChange={(e) => setFormData({ ...formData, preferredType: e.target.value })}
                className="w-full px-3 py-2.5 text-sm bg-brand-neutral border border-gray-200 rounded-lg focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none"
              >
                <option value="In-Person VIP Site Visit">In-Person VIP Site Visit (Dhaka)</option>
                <option value="Virtual Video Consultation (NRB/Overseas)">Virtual Video Consultation (NRB/Overseas)</option>
                <option value="Corporate Office Presentation">Corporate Office Presentation</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-dark mb-1">
                Property of Interest
              </label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-3 text-brand-primary/60" />
                <input
                  type="text"
                  placeholder="e.g. Jolshiri Oasis, Sapphire Penthouse"
                  value={formData.targetProperty}
                  onChange={(e) => setFormData({ ...formData, targetProperty: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-brand-neutral border border-gray-200 rounded-lg focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-dark mb-1">
                Preferred Date / Timeframe
              </label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-3 text-brand-primary/60" />
                <input
                  type="date"
                  value={formData.preferredDate}
                  onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-brand-neutral border border-gray-200 rounded-lg focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-dark mb-1">
              Bespoke Requirements / Notes
            </label>
            <textarea
              rows={2}
              placeholder="Specific bedroom requirements, budget range, or preferred viewing hours..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-brand-neutral border border-gray-200 rounded-lg focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-between gap-4 border-t border-gray-100">
            <div className="flex items-center gap-1.5 text-[11px] text-brand-dark/70">
              <ShieldCheck size={14} className="text-brand-primary shrink-0" />
              <span>Strictly confidential advisory</span>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-brand-primary hover:bg-brand-dark text-white px-6 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                'Confirm Consultation'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
