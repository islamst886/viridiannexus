import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useGlobalState } from '../context/GlobalState';
import UnsavedChangesGuard from './UnsavedChangesGuard';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { authLoading, isLoggedIn, isAdmin, sessionExpiredReason } = useGlobalState();

  useEffect(() => {
    if (!authLoading && isLoggedIn && !isAdmin) {
      toast.error('You are not authorized to access this area.');
    }
  }, [authLoading, isLoggedIn, isAdmin]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-neutral">
        <Loader2 className="animate-spin text-brand-primary" size={48} />
      </div>
    );
  }

  if (!isLoggedIn) {
    const loginPath = sessionExpiredReason ? `/admin?reason=${sessionExpiredReason}` : '/admin';
    return <Navigate to={loginPath} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <UnsavedChangesGuard>{children}</UnsavedChangesGuard>;
}
