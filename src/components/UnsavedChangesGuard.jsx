import React, { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useGlobalState } from '../context/GlobalState';

export default function UnsavedChangesGuard({ children }) {
  const { adminUnsavedChanges, setAdminUnsavedChanges, bypassUnsavedGuard, setBypassUnsavedGuard } = useGlobalState();

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      adminUnsavedChanges && !bypassUnsavedGuard && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (adminUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [adminUnsavedChanges]);

  return (
    <>
      {children}
      
      {/* Unsaved Changes Warning Modal */}
      {blocker.state === "blocked" && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4 text-brand-dark mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-1">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-serif font-bold text-gray-900">Unsaved Changes</h3>
                <p className="text-sm text-gray-500 mt-2">You have unsaved changes. Are you sure you want to leave this page? Your changes will be permanently lost.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={() => blocker.reset()}
                className="px-5 py-2.5 text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Stay on Page
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminUnsavedChanges(false);
                  setBypassUnsavedGuard(false);
                  blocker.proceed();
                }}
                className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
