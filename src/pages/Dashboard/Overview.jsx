import React, { useState, useEffect } from 'react';
import { useGlobalState } from '../../context/GlobalState';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Building, Loader2, ChevronRight, CheckCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Overview() {
  const { userProfile } = useGlobalState();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userProfile?.uid) return;
    
    const q = query(collection(db, 'bookings'), where('linkedUserId', '==', userProfile.uid));
    const unsub = onSnapshot(q, (snap) => {
      setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => unsub();
  }, [userProfile]);

  const formatMoney = (amount) => {
    if (amount === undefined || amount === null) return '৳0';
    return '৳ ' + amount.toLocaleString('en-IN');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold font-serif text-gray-900 mb-8">Dashboard Overview</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User Profile Card */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200 flex items-center gap-6 col-span-1 lg:col-span-2">
            <div className="w-20 h-20 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center text-3xl font-bold uppercase shrink-0">
              {userProfile?.displayName?.charAt(0) || 'U'}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{userProfile?.displayName || 'User'}</h2>
              <p className="text-gray-500">{userProfile?.email}</p>
              {userProfile?.phone && <p className="text-gray-500 text-sm mt-1">{userProfile.phone}</p>}
              <button className="mt-3 px-4 py-1.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-full hover:bg-gray-200 transition-colors">
                Edit Profile
              </button>
            </div>
          </div>

          {/* Referral Card */}
          <div className="bg-brand-dark rounded-2xl shadow-sm p-6 border border-brand-dark text-white relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-10">
              <CheckCircle size={120} />
            </div>
            <h3 className="text-lg font-bold font-serif mb-2 relative z-10 text-brand-accent">Refer & Earn</h3>
            <p className="text-sm text-gray-300 mb-4 relative z-10">Invite friends and earn up to ৳100,000 on their first successful booking.</p>
            <div className="bg-black/30 p-3 rounded-lg flex justify-between items-center border border-white/10 relative z-10">
              <span className="font-mono font-bold tracking-wider">{userProfile?.uid?.slice(0, 8).toUpperCase() || 'REF123'}</span>
              <button className="text-brand-accent hover:text-white transition-colors" title="Copy Code">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
              </button>
            </div>
          </div>
        </div>

        {/* My Bookings Section */}
        <div className="mt-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold font-serif text-gray-900">My Bookings</h2>
          </div>
          
          {loading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 flex justify-center">
              <Loader2 className="animate-spin text-brand-primary" size={32} />
            </div>
          ) : bookings.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">No active bookings</h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">You haven't purchased or booked any properties yet. Explore our projects to start your real estate journey.</p>
              <a href="/projects" className="inline-block bg-brand-primary text-white px-6 py-3 rounded-lg font-bold hover:bg-brand-dark transition-colors">
                Explore Projects
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bookings.map((booking) => {
                const completionPct = Math.min(100, Math.round(((booking.totalPaid || 0) / booking.totalPrice) * 100));
                
                return (
                  <div key={booking.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group cursor-pointer" onClick={() => navigate(`/dashboard/booking/${booking.id}`)}>
                    <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                      <div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${booking.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {booking.status}
                        </span>
                        <h3 className="text-lg font-bold text-gray-900 mt-3">{booking.propertyName}</h3>
                        <p className="text-sm text-gray-500">{booking.unitType} {booking.unitNumber ? `- ${booking.unitNumber}` : ''}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-brand-primary/10 group-hover:text-brand-primary transition-colors">
                        <ChevronRight size={20} />
                      </div>
                    </div>
                    
                    <div className="p-6 bg-gray-50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-gray-500 uppercase">Stage</span>
                        <span className="text-sm font-bold text-brand-dark">{booking.stage}</span>
                      </div>
                      
                      <div className="mt-4">
                        <div className="flex justify-between text-xs font-bold mb-1.5">
                          <span className="text-gray-500">Paid: {formatMoney(booking.totalPaid)}</span>
                          <span className="text-brand-primary">{completionPct}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className="bg-brand-primary h-1.5 rounded-full" style={{ width: `${completionPct}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
