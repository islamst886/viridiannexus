import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useGlobalState } from '../context/GlobalState';
import { Loader2, AlertTriangle } from 'lucide-react';

export default function ProtectedUserRoute({ children }) {
  const { authLoading, isLoggedIn, userProfile } = useGlobalState();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-neutral">
        <Loader2 className="animate-spin text-brand-primary" size={48} />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to={`/auth?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (userProfile?.isBanned) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-neutral text-center p-6">
        <AlertTriangle size={64} className="text-red-500 mb-4" />
        <h1 className="text-3xl font-bold font-serif text-brand-dark mb-2">Account Suspended</h1>
        <p className="text-gray-600 max-w-md mb-6">
          Your account has been suspended by an administrator. If you believe this is a mistake, please contact support.
        </p>
        <a href="mailto:support@viridiannexus.com" className="text-brand-primary font-bold hover:underline">
          Contact Support
        </a>
      </div>
    );
  }

  return children;
}
