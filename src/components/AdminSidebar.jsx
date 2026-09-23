import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Home, MessageSquare, ExternalLink, CalendarCheck, Clock, Users, Mail } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useGlobalState } from '../context/GlobalState';

export default function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { adminUnsavedChanges, setAdminUnsavedChanges, isSuperAdmin } = useGlobalState();

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleLogout = async () => {
    if (adminUnsavedChanges && !window.confirm("You have unsaved changes. Are you sure you want to logout?")) {
      return;
    }
    setAdminUnsavedChanges(false);
    await signOut(auth);
    navigate('/admin');
  };

  const isActive = (path) => {
    if (path === '/admin' || path === '/admin/dashboard') return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="w-64 bg-brand-dark text-white p-6 flex flex-col h-screen sticky top-0">
      <h2 className="text-2xl font-serif text-brand-accent mb-12">Admin Portal</h2>
      <nav className="flex-1 space-y-4">
        <button 
          onClick={() => handleNavigation('/admin/dashboard')}
          className={`w-full text-left flex items-center gap-3 p-3 rounded font-bold transition-colors ${isActive('/admin/dashboard') ? 'bg-brand-primary text-brand-neutral' : 'text-brand-neutral/70 hover:bg-brand-primary/20 hover:text-white'}`}
        >
          <Home size={20} /> Properties
        </button>
        <button 
          onClick={() => handleNavigation('/admin/messages')}
          className={`w-full text-left flex items-center gap-3 p-3 rounded font-bold transition-colors ${isActive('/admin/messages') ? 'bg-brand-primary text-brand-neutral' : 'text-brand-neutral/70 hover:bg-brand-primary/20 hover:text-white'}`}
        >
          <MessageSquare size={20} /> Messages
        </button>
        <button 
          onClick={() => handleNavigation('/admin/bookings')}
          className={`w-full text-left flex items-center gap-3 p-3 rounded font-bold transition-colors ${isActive('/admin/bookings') ? 'bg-brand-primary text-brand-neutral' : 'text-brand-neutral/70 hover:bg-brand-primary/20 hover:text-white'}`}
        >
          <CalendarCheck size={20} /> Bookings
        </button>

        <button 
          onClick={() => handleNavigation('/admin/progress')}
          className={`w-full text-left flex items-center gap-3 p-3 rounded font-bold transition-colors ${isActive('/admin/progress') ? 'bg-brand-primary text-brand-neutral' : 'text-brand-neutral/70 hover:bg-brand-primary/20 hover:text-white'}`}
        >
          <Clock size={20} /> Progress
        </button>
        <button 
          onClick={() => handleNavigation('/admin/newsletter')}
          className={`w-full text-left flex items-center gap-3 p-3 rounded font-bold transition-colors ${isActive('/admin/newsletter') ? 'bg-brand-primary text-brand-neutral' : 'text-brand-neutral/70 hover:bg-brand-primary/20 hover:text-white'}`}
        >
          <Mail size={20} /> Newsletter
        </button>
        {isSuperAdmin && (
          <button 
            onClick={() => handleNavigation('/admin/users')}
            className={`w-full text-left flex items-center gap-3 p-3 rounded font-bold transition-colors mt-4 bg-brand-primary/10 ${isActive('/admin/users') ? 'bg-brand-primary text-brand-neutral' : 'text-brand-primary hover:bg-brand-primary hover:text-white'}`}
          >
            <Users size={20} /> User Management
          </button>
        )}
        
        <div className="pt-8 mt-8 border-t border-white/10">
          <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-brand-neutral/70 hover:text-white p-3 transition-colors">
            <ExternalLink size={20} /> View Live Site
          </a>
        </div>
      </nav>
      <button onClick={handleLogout} className="flex items-center gap-2 text-red-400 hover:text-red-300 p-3 transition-colors mt-auto font-bold">
        <LogOut size={20} /> Logout
      </button>
    </div>
  );
}
