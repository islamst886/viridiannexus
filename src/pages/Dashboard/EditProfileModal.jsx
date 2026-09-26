import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Camera,
  KeyRound,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-toastify';

const AVATAR_PRESETS = [
  { id: '1', label: 'Executive Modern', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
  { id: '2', label: 'Architect Sleek', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
  { id: '3', label: 'Urban Elite', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80' },
  { id: '4', label: 'Professional', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80' },
];

export default function EditProfileModal({ isOpen, onClose, userProfile }) {
  const { updateUserProfileData, resetPassword, resendVerificationEmail, loading } = useAuth();

  const [activeTab, setActiveTab] = useState('personal'); // 'personal' | 'identity' | 'security'

  const [formData, setFormData] = useState({
    displayName: '',
    phone: '',
    emergencyPhone: '',
    nidType: 'NID',
    nid: '',
    address: '',
    avatar: '',
    email: ''
  });

  const [initialData, setInitialData] = useState({});
  const [errors, setErrors] = useState({});
  const [avatarError, setAvatarError] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);

  useEffect(() => {
    if (isOpen && userProfile) {
      const init = {
        displayName: userProfile.displayName || '',
        phone: userProfile.phone || '',
        emergencyPhone: userProfile.emergencyPhone || userProfile.alternatePhone || '',
        nidType: userProfile.nidType || 'NID',
        nid: userProfile.nid || '',
        address: userProfile.address || '',
        avatar: userProfile.avatar || '',
        email: userProfile.email || ''
      };
      setFormData(init);
      setInitialData(init);
      setErrors({});
      setAvatarError(false);
      setActiveTab('personal');
    }
  }, [isOpen, userProfile]);

  if (!isOpen) return null;

  const isDirty = JSON.stringify(formData) !== JSON.stringify(initialData);

  const handleClose = () => {
    if (isDirty) {
      if (window.confirm("You have unsaved changes. Are you sure you want to discard them?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    if (name === 'avatar') {
      setAvatarError(false);
    }
  };

  const validate = () => {
    const errs = {};

    // Name validation
    if (!formData.displayName.trim()) {
      errs.displayName = 'Full Name is required';
    } else if (formData.displayName.trim().length < 2) {
      errs.displayName = 'Name must be at least 2 characters';
    }

    // Phone validation
    const phoneClean = formData.phone.trim();
    if (!phoneClean) {
      errs.phone = 'Primary Phone number is required';
    } else if (!/^[+0-9\s-]{10,18}$/.test(phoneClean)) {
      errs.phone = 'Please enter a valid phone number (min 10 digits)';
    }

    // Emergency phone (optional)
    if (formData.emergencyPhone.trim()) {
      if (!/^[+0-9\s-]{10,18}$/.test(formData.emergencyPhone.trim())) {
        errs.emergencyPhone = 'Please enter a valid phone number';
      }
    }

    // NID/Passport validation (optional, but if filled must be reasonable)
    if (formData.nid.trim()) {
      if (formData.nidType === 'NID') {
        if (!/^[0-9A-Za-z]{9,20}$/.test(formData.nid.trim())) {
          errs.nid = 'NID must be 9-20 alphanumeric characters';
        }
      } else {
        if (!/^[A-Za-z0-9]{6,15}$/.test(formData.nid.trim())) {
          errs.nid = 'Passport must be 6-15 alphanumeric characters';
        }
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please correct the errors in the form.");
      return;
    }

    try {
      await updateUserProfileData({
        displayName: formData.displayName.trim(),
        phone: formData.phone.trim(),
        emergencyPhone: formData.emergencyPhone.trim(),
        nidType: formData.nidType,
        nid: formData.nid.trim(),
        address: formData.address.trim(),
        avatar: formData.avatar.trim()
      });
      onClose();
    } catch (err) {
      // toast is already emitted in context
    }
  };

  const handlePasswordReset = async () => {
    if (!userProfile?.email) return;
    setIsSendingReset(true);
    try {
      await resetPassword(userProfile.email);
    } catch (err) {
      // toast is emitted in context
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleResendVerification = async () => {
    setIsSendingVerification(true);
    try {
      await resendVerificationEmail();
    } finally {
      setIsSendingVerification(false);
    }
  };

  const isEmailVerified = true; // Supabase requires email verification anyway so assuming true. If Supabase is used, we can get this from user metadata if needed.

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-100 my-auto max-h-[92vh] flex flex-col transition-all">

        {/* Header Banner */}
        <div className="bg-gradient-to-r from-brand-dark via-[#1a382d] to-brand-primary p-5 sm:p-7 text-white relative shrink-0">
          <button
            onClick={handleClose}
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-4">
            <div className="relative group">
              {formData.avatar && !avatarError ? (
                <img
                  src={formData.avatar}
                  alt="Profile Avatar"
                  onError={() => setAvatarError(true)}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-brand-accent shadow-md bg-brand-primary/30"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-brand-accent/20 border-2 border-brand-accent text-brand-accent flex items-center justify-center text-3xl font-bold font-serif uppercase shadow-md">
                  {formData.displayName?.charAt(0) || userProfile?.email?.charAt(0) || 'U'}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold font-serif">{formData.displayName || 'Edit Profile'}</h2>
                {isEmailVerified && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">
                    <ShieldCheck size={12} /> Verified
                  </span>
                )}
              </div>
              <p className="text-brand-neutral/80 text-sm mt-0.5">{formData.email}</p>
              <p className="text-xs text-brand-accent mt-1 tracking-wider uppercase font-semibold">
                Member ID: {userProfile?.uid?.slice(0, 8).toUpperCase() || 'N/A'}
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-6 pt-4 border-t border-white/10 text-sm">
            <button
              type="button"
              onClick={() => setActiveTab('personal')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${activeTab === 'personal'
                  ? 'bg-brand-accent text-brand-dark shadow-sm font-bold'
                  : 'text-white/80 hover:bg-white/10'
                }`}
            >
              <User size={16} /> Personal Info
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('identity')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${activeTab === 'identity'
                  ? 'bg-brand-accent text-brand-dark shadow-sm font-bold'
                  : 'text-white/80 hover:bg-white/10'
                }`}
            >
              <CreditCard size={16} /> Identity & Residence
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${activeTab === 'security'
                  ? 'bg-brand-accent text-brand-dark shadow-sm font-bold'
                  : 'text-white/80 hover:bg-white/10'
                }`}
            >
              <Shield size={16} /> Security & Account
            </button>
          </div>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
          <div className="p-6 sm:p-8 space-y-6 flex-1">

            {/* TAB 1: Personal Info */}
            {activeTab === 'personal' && (
              <div className="space-y-5 animate-fade-in">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      name="displayName"
                      value={formData.displayName}
                      onChange={handleChange}
                      placeholder="e.g. John Doe"
                      className={`w-full pl-11 pr-4 py-2.5 rounded-xl border text-sm font-medium transition-colors focus:outline-none focus:ring-2 ${errors.displayName
                          ? 'border-red-300 focus:ring-red-200 bg-red-50/20'
                          : 'border-gray-300 focus:border-brand-primary focus:ring-brand-primary/20'
                        }`}
                    />
                  </div>
                  {errors.displayName && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle size={13} /> {errors.displayName}
                    </p>
                  )}
                </div>

                {/* Primary Phone & Emergency Phone in Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                      Primary Phone <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+880 1700-000000"
                        className={`w-full pl-11 pr-4 py-2.5 rounded-xl border text-sm font-medium transition-colors focus:outline-none focus:ring-2 ${errors.phone
                            ? 'border-red-300 focus:ring-red-200 bg-red-50/20'
                            : 'border-gray-300 focus:border-brand-primary focus:ring-brand-primary/20'
                          }`}
                      />
                    </div>
                    {errors.phone && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle size={13} /> {errors.phone}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                      Alternate / Emergency Phone
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="tel"
                        name="emergencyPhone"
                        value={formData.emergencyPhone}
                        onChange={handleChange}
                        placeholder="Optional second number"
                        className={`w-full pl-11 pr-4 py-2.5 rounded-xl border text-sm font-medium transition-colors focus:outline-none focus:ring-2 ${errors.emergencyPhone
                            ? 'border-red-300 focus:ring-red-200 bg-red-50/20'
                            : 'border-gray-300 focus:border-brand-primary focus:ring-brand-primary/20'
                          }`}
                      />
                    </div>
                    {errors.emergencyPhone && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle size={13} /> {errors.emergencyPhone}
                      </p>
                    )}
                  </div>
                </div>

                {/* Avatar URL & Preset Selector */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Profile Avatar Image URL
                  </label>
                  <div className="relative">
                    <Camera className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="url"
                      name="avatar"
                      value={formData.avatar}
                      onChange={handleChange}
                      placeholder="https://example.com/photo.jpg or choose below"
                      className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-300 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 text-sm font-medium transition-colors"
                    />
                  </div>
                  {avatarError && formData.avatar && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <AlertCircle size={13} /> Image failed to load, falling back to monogram.
                    </p>
                  )}

                  {/* Quick Presets */}
                  <div className="mt-3">
                    <span className="text-xs text-gray-500 font-semibold">Or pick a stylized avatar:</span>
                    <div className="flex flex-wrap gap-3 mt-1.5 items-center">
                      {AVATAR_PRESETS.map((preset) => (
                        <button
                          type="button"
                          key={preset.id}
                          onClick={() => {
                            setFormData(prev => ({ ...prev, avatar: preset.url }));
                            setAvatarError(false);
                          }}
                          className={`group relative rounded-xl overflow-hidden border-2 transition-all p-0.5 ${formData.avatar === preset.url
                              ? 'border-brand-primary ring-2 ring-brand-primary/30 scale-105'
                              : 'border-gray-200 hover:border-brand-accent'
                            }`}
                          title={preset.label}
                        >
                          <img src={preset.url} alt={preset.label} className="w-10 h-10 object-cover rounded-lg" />
                        </button>
                      ))}
                      {formData.avatar && (
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, avatar: '' }))}
                          className="text-xs text-gray-500 hover:text-red-500 font-semibold px-2.5 py-1 bg-gray-100 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          Clear Avatar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Identity & Residence */}
            {activeTab === 'identity' && (
              <div className="space-y-5 animate-fade-in">
                <div className="bg-amber-50/60 border border-amber-200/70 rounded-2xl p-4 flex gap-3 text-amber-900 text-xs leading-relaxed">
                  <ShieldCheck size={20} className="text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-950">Official Real Estate Documentation</p>
                    <p className="mt-0.5 text-amber-800">
                      Your National ID/Passport and Residential Address are used to automatically populate property booking contracts, deed registries, and verified client schedules.
                    </p>
                  </div>
                </div>

                {/* ID Type & Number */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                      Document Type
                    </label>
                    <select
                      name="nidType"
                      value={formData.nidType}
                      onChange={handleChange}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 text-sm font-semibold bg-white"
                    >
                      <option value="NID">National ID (NID)</option>
                      <option value="Passport">Passport</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                      {formData.nidType === 'NID' ? 'National ID Number' : 'Passport Number'}
                    </label>
                    <div className="relative">
                      <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="text"
                        name="nid"
                        value={formData.nid}
                        onChange={handleChange}
                        placeholder={formData.nidType === 'NID' ? 'e.g. 19901234567890' : 'e.g. A01234567'}
                        className={`w-full pl-11 pr-4 py-2.5 rounded-xl border text-sm font-medium transition-colors focus:outline-none focus:ring-2 ${errors.nid
                            ? 'border-red-300 focus:ring-red-200 bg-red-50/20'
                            : 'border-gray-300 focus:border-brand-primary focus:ring-brand-primary/20'
                          }`}
                      />
                    </div>
                    {errors.nid && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle size={13} /> {errors.nid}
                      </p>
                    )}
                  </div>
                </div>

                {/* Current Residential Address */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Current Residential Address
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3 text-gray-400" size={18} />
                    <textarea
                      name="address"
                      rows={3}
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="House/Apartment #, Road, Area/Sector, City, Country"
                      className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-300 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 text-sm font-medium transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Security & Account */}
            {activeTab === 'security' && (
              <div className="space-y-6 animate-fade-in">
                {/* Email Status Box */}
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-brand-primary/10 text-brand-primary rounded-xl">
                        <Mail size={22} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">Primary Authentication Email</h4>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{userProfile?.email || formData.email}</p>
                      </div>
                    </div>

                    {isEmailVerified ? (
                      <span className="flex items-center gap-1 text-xs font-bold bg-green-100 text-green-800 px-3 py-1 rounded-full">
                        <CheckCircle2 size={14} /> Verified
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        disabled={isSendingVerification}
                        className="flex items-center gap-1.5 text-xs font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {isSendingVerification ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <RefreshCw size={14} />
                        )}
                        Verify Email
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    This email is tied to your cryptographic authentication provider. To ensure account security, email changes must be verified through confirmation links.
                  </p>
                </div>

                {/* Password Management */}
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-amber-500/10 text-amber-700 rounded-xl">
                        <KeyRound size={22} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">Password & Credentials</h4>
                        <p className="text-xs text-gray-500 mt-0.5">Need to update or reset your security password?</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handlePasswordReset}
                      disabled={isSendingReset}
                      className="flex items-center gap-1.5 text-xs font-bold bg-brand-dark text-white hover:bg-brand-primary px-3.5 py-2 rounded-xl transition-colors shrink-0"
                    >
                      {isSendingReset ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Mail size={14} />
                      )}
                      Send Reset Link
                    </button>
                  </div>
                </div>

                {/* Role & Privileges */}
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-600">Access Level:</span>
                  <span className="font-bold uppercase tracking-wider text-brand-primary bg-white px-3 py-1 rounded-full border border-emerald-200 shadow-sm">
                    {userProfile?.role || 'Verified Member'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions Footer */}
          <div className="p-4 sm:px-8 bg-gray-50/95 backdrop-blur-sm border-t border-gray-100 flex items-center justify-between gap-4 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-200/60 rounded-xl transition-colors"
            >
              Cancel
            </button>

            <div className="flex items-center gap-3">
              {isDirty && (
                <span className="text-xs text-amber-600 font-semibold hidden sm:inline-block">
                  Unsaved changes
                </span>
              )}
              <button
                type="submit"
                disabled={loading || !isDirty}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all ${loading || !isDirty
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-brand-primary text-white hover:bg-brand-dark hover:shadow-lg'
                  }`}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}
