import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGlobalState } from '../../context/GlobalState';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Loader2, Eye, EyeOff, ShieldCheck, X } from 'lucide-react';
import { toast } from 'react-toastify';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp, resetPassword, loading: authLoading } = useAuth();
  const { userProfile, authLoading: globalLoading } = useGlobalState();
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const redirectUrl = queryParams.get('redirect') || '/dashboard';

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [agreed, setAgreed] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // Handle redirect if already logged in
  useEffect(() => {
    if (!globalLoading && userProfile) {
      if (userProfile.role === 'admin' || userProfile.role === 'super_admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate(redirectUrl, { replace: true });
      }
    }
  }, [globalLoading, userProfile, navigate, redirectUrl]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!isLogin) {
      if (!form.name.trim()) newErrors.name = 'Name is required';
      if (!form.phone.trim() || form.phone.trim().length < 10) newErrors.phone = 'Valid phone number is required';
      if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
      if (!agreed) newErrors.agreed = 'You must agree to the Terms & Conditions';
    }
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Valid email is required';
    if (!form.password || form.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (isLogin) {
        await signIn(form.email, form.password);
        // Navigation is handled by the useEffect above once userProfile resolves
      } else {
        await signUp(form.email, form.password, form.name, form.phone);
        // Navigation is handled by useEffect
      }
    } catch (error) {
      // Error handled by context
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim() || !/\S+@\S+\.\S+/.test(resetEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }
    try {
      await resetPassword(resetEmail);
      setShowForgot(false);
      setResetEmail('');
    } catch (error) {
      // Error handled by context
    }
  };

  if (globalLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-neutral">
        <Loader2 className="animate-spin text-brand-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] flex bg-brand-neutral">
      {/* Left side - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-brand-dark">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=1200')" }}></div>
        <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/80 to-transparent"></div>
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <h1 className="text-4xl font-serif font-bold leading-tight mb-4 text-brand-neutral">
            {isLogin 
              ? "Welcome Back to Viridian Nexus." 
              : "Redefining Elite Living across Bangladesh."}
          </h1>
          <p className="text-lg text-brand-neutral/80 max-w-lg mb-6">
            {isLogin 
              ? "Access your exclusive dashboard to monitor your properties, track project progress in real-time, and manage your financial installments."
              : "Join our exclusive community to secure your premium property, manage wishlists, and experience absolute transparency in real estate."}
          </p>
          <div className="flex items-center gap-2 text-sm font-bold text-brand-accent uppercase tracking-wider">
            <ShieldCheck size={18} /> Bank-Grade Security
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex items-start justify-center p-6 py-8 lg:p-12 relative overflow-y-auto max-h-[calc(100vh-80px)]">
        <Link to="/" className="absolute top-6 left-6 lg:hidden flex items-center gap-2">
           <div className="w-8 h-8 bg-brand-primary rounded-sm flex items-center justify-center border border-brand-accent/50">
             <span className="text-brand-accent font-serif font-bold text-lg">V</span>
           </div>
        </Link>
        
        <div className="max-w-md w-full my-auto pb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-serif font-bold text-brand-dark mb-3">
              {isLogin ? 'Secure Client Portal' : 'Exclusive Membership'}
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              {isLogin 
                ? 'Access your encrypted portfolio, track property progress, and manage your real estate investments with industry-leading security.' 
                : 'Join Viridian Nexus. Your data is encrypted and stored with bank-grade security standards. Experience real estate management redefined.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 bg-white border ${errors.name ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary`}
                    placeholder="John Doe"
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Phone Number *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 bg-white border ${errors.phone ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary`}
                    placeholder="+880 1700 000000"
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Email Address *</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className={`w-full px-4 py-3 bg-white border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary`}
                placeholder="you@example.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider">Password *</label>
                {isLogin && (
                  <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-brand-primary hover:underline font-semibold">
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-white border ${errors.password ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Confirm Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 bg-white border ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary`}
                    placeholder="••••••••"
                  />
                </div>
                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
              </div>
            )}

            {!isLogin && (
              <div className="flex items-start gap-2 mt-4">
                <input
                  type="checkbox"
                  id="agreed"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1"
                />
                <label htmlFor="agreed" className="text-sm text-gray-600">
                  I agree to the <Link to="/legal" target="_blank" rel="noopener noreferrer" className="text-brand-primary hover:underline">Terms & Conditions</Link> and Privacy Policy.
                </label>
              </div>
            )}
            {!isLogin && errors.agreed && <p className="text-red-500 text-xs mt-1">{errors.agreed}</p>}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-4 mt-6 bg-brand-primary text-white rounded-lg font-bold uppercase tracking-wider hover:bg-brand-dark transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {authLoading ? <Loader2 size={20} className="animate-spin" /> : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-600">
            {isLogin ? (
              <p>Don't have an account? <button onClick={() => { setIsLogin(false); setErrors({}); }} className="text-brand-primary font-bold hover:underline">Register here</button></p>
            ) : (
              <p>Already have an account? <button onClick={() => { setIsLogin(true); setErrors({}); }} className="text-brand-primary font-bold hover:underline">Sign in</button></p>
            )}
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl relative">
            <button onClick={() => setShowForgot(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
            <ShieldCheck size={48} className="text-brand-primary mx-auto mb-4" />
            <h3 className="text-2xl font-serif font-bold text-center text-brand-dark mb-2">Reset Password</h3>
            <p className="text-gray-500 text-center text-sm mb-6">Enter your email address and we'll send you a link to reset your password.</p>
            <form onSubmit={handleResetPassword}>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg mb-4 focus:outline-none focus:border-brand-primary"
                placeholder="Email address"
              />
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-brand-primary text-white rounded-lg font-bold hover:bg-brand-dark transition-colors flex items-center justify-center disabled:opacity-70"
              >
                {authLoading ? <Loader2 size={20} className="animate-spin" /> : 'Send Reset Link'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
