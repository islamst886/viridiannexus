import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useGlobalState } from '../context/GlobalState';
import { COMPANY_INFO } from '../data/companyInfo';

export default function ProtectedUserRoute({ children }: { children: React.ReactNode }) {
  const { authLoading, isLoggedIn, userProfile, sessionExpiredReason } = useGlobalState();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-neutral">
        <Loader2 className="animate-spin text-brand-primary" size={48} />
      </div>
    );
  }

  if (!isLoggedIn) {
    const reasonParam = sessionExpiredReason ? `&reason=${sessionExpiredReason}` : '';
    return (
      <Navigate
        to={`/auth?redirect=${encodeURIComponent(location.pathname + location.search)}${reasonParam}`}
        replace
      />
    );
  }

  if (userProfile?.isBanned) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-neutral text-center p-6">
        <AlertTriangle size={64} className="text-red-500 mb-4" />
        <h1 className="text-3xl font-bold font-serif text-brand-dark mb-2">Account Suspended</h1>
        <p className="text-gray-600 max-w-md mb-6">
          Your account has been suspended by an administrator. If you believe this is a mistake,
          please contact support.
        </p>
        <a
          href={COMPANY_INFO.emailHref}
          className="text-brand-primary font-bold hover:underline"
        >
          Contact Support
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
