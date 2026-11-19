import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ShieldCheck } from 'lucide-react';
import { getSessionExpirationMessage } from '../../utils/sessionManager';

export default function AdminLogin() {
  const { signIn, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const expirationReason = new URLSearchParams(location.search).get('reason');
  const expirationNotice =
    expirationReason === 'idle' || expirationReason === 'max_age' || expirationReason === 'revoked'
      ? getSessionExpirationMessage(expirationReason, true)
      : null;

  const handleLogin = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    try {
      await signIn(email, password);
      toast.success('Admin login successful!');
      navigate('/admin/dashboard');
    } catch {
      // Error already toasted by signIn
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-2xl border border-gray-100">
        <div className="text-center">
          <ShieldCheck size={48} className="mx-auto text-brand-primary mb-4" />
          <h2 className="text-3xl font-serif text-brand-dark">Secure Admin Portal</h2>
          <p className="mt-2 text-sm text-gray-600">Authorized personnel only</p>
        </div>
        {expirationNotice && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
            {expirationNotice}
          </div>
        )}
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Admin Email</label>
              <input
                type="email"
                required
                className="appearance-none rounded relative block w-full px-3 py-3 border border-gray-300 text-gray-900 focus:outline-none focus:ring-brand-primary focus:border-brand-primary focus:z-10 sm:text-sm"
                placeholder="admin@viridiannexus.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                required
                className="appearance-none rounded relative block w-full px-3 py-3 border border-gray-300 text-gray-900 focus:outline-none focus:ring-brand-primary focus:border-brand-primary focus:z-10 sm:text-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded text-white bg-brand-primary hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
