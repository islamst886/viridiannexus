import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useGlobalState } from '../context/GlobalState';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import UnsavedChangesGuard from './UnsavedChangesGuard';

export default function ProtectedRoute({ children }) {
  const { authLoading, isLoggedIn, isAdmin } = useGlobalState();

  useEffect(() => {
    if (!authLoading && isLoggedIn && !isAdmin) {
      toast.error("You are not authorized to access this area.");
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
    return <Navigate to="/admin" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <UnsavedChangesGuard>
      {children}
    </UnsavedChangesGuard>
  );
}
