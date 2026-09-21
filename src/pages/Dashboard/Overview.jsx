import React from 'react';
import { useGlobalState } from '../../context/GlobalState';

export default function Overview() {
  const { user } = useGlobalState();

  return (
    <div className="min-h-screen bg-viridian-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-pine-900 mb-8">Dashboard Overview</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User Profile Card */}
          <div className="bg-white rounded-2xl shadow p-6 border border-viridian-100 flex items-center space-x-6">
            <img src={user.avatar} alt="Avatar" className="w-20 h-20 rounded-full bg-viridian-100" />
            <div>
              <h2 className="text-2xl font-bold text-pine-900">{user.name}</h2>
              <p className="text-pine-600">{user.email}</p>
              <button className="mt-2 text-sm text-viridian-600 font-semibold hover:underline">Edit Profile</button>
            </div>
          </div>

          {/* Wallet Card */}
          <div className="bg-gradient-to-br from-pine-900 to-pine-800 rounded-2xl shadow p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-20">
              <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"></path><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"></path></svg>
            </div>
            <h3 className="text-viridian-200 text-sm font-medium mb-1 relative z-10">Digital Wallet Balance</h3>
            <p className="text-4xl font-bold mb-4 relative z-10">৳ {user.walletBalance.toLocaleString()}</p>
            <div className="flex space-x-3 relative z-10">
              <button className="bg-viridian-500 hover:bg-viridian-400 text-white px-4 py-2 rounded text-sm font-semibold transition-colors">Add Funds</button>
              <button className="bg-pine-700 hover:bg-pine-600 text-white px-4 py-2 rounded text-sm font-semibold transition-colors">History</button>
            </div>
          </div>

          {/* Referral Card */}
          <div className="bg-white rounded-2xl shadow p-6 border border-viridian-100">
            <h3 className="text-lg font-bold text-pine-900 mb-2">Refer & Earn</h3>
            <p className="text-sm text-pine-600 mb-4">Invite friends and earn up to ৳100,000 on their first successful booking.</p>
            <div className="bg-viridian-50 p-3 rounded flex justify-between items-center border border-viridian-200">
              <span className="font-mono text-pine-900 font-bold tracking-wider">{user.referralCode}</span>
              <button className="text-viridian-600 hover:text-viridian-800" title="Copy Code">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Owned Assets section */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-pine-900 mb-6">My Assets</h2>
          <div className="bg-white rounded-2xl shadow border border-viridian-100 p-8 text-center">
            <div className="w-20 h-20 bg-viridian-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-viridian-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
            </div>
            <h3 className="text-lg font-bold text-pine-900 mb-2">No active assets</h3>
            <p className="text-pine-600 max-w-md mx-auto mb-6">You haven't purchased or booked any properties yet. Explore our projects to start your real estate journey.</p>
            <a href="/projects" className="inline-block bg-viridian-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-viridian-700 transition-colors">Explore Projects</a>
          </div>
        </div>
      </div>
    </div>
  );
}
