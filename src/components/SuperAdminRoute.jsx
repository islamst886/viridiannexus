import React from 'react';
import { Navigate } from 'react-router-dom';
import { useGlobalState } from '../context/GlobalState';
import { Loader2, ShieldAlert } from 'lucide-react';
import UnsavedChangesGuard from './UnsavedChangesGuard';

export default function SuperAdminRoute({ children }) {
  const { authLoading, isLoggedIn, isSuperAdmin } = useGlobalState();

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

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-neutral text-center p-6">
        <ShieldAlert size={64} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-bold font-serif text-brand-dark mb-2">Permission Denied</h1>
        <p className="text-gray-500 max-w-md">You need Super Admin privileges to access this page.</p>
        <button 
          onClick={() => window.history.back()}
          className="mt-6 px-6 py-2 bg-brand-primary text-white rounded font-bold hover:bg-brand-dark transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <UnsavedChangesGuard>
      {children}
    </UnsavedChangesGuard>
  );
}
