import React, { useState, useEffect } from 'react';

export default function Bidding() {
  const [timeLeft, setTimeLeft] = useState(3600); // 1 hour in seconds

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-viridian-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-pine-900">Live Auctions</h1>
            <p className="text-pine-600 mt-2">Bid on premium properties at exclusive starting prices.</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center space-x-2 bg-red-100 text-red-700 px-4 py-2 rounded-full shadow-inner border border-red-200">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="font-bold tracking-wider">LIVE NOW</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl border border-viridian-200 overflow-hidden flex flex-col lg:flex-row">
          <div className="lg:w-1/2 relative min-h-[300px]">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=1200')" }}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-pine-900 via-transparent to-transparent"></div>
            <div className="absolute bottom-6 left-6 text-white">
              <span className="bg-viridian-500 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2 inline-block">Auction #VN-492</span>
              <h2 className="text-3xl font-bold">The Sapphire Penthouse</h2>
              <p className="opacity-90 flex items-center mt-1">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                Gulshan 2, Dhaka
              </p>
            </div>
          </div>
          
          <div className="lg:w-1/2 p-8 lg:p-12 flex flex-col justify-center bg-gray-50">
            <div className="text-center mb-8">
              <p className="text-pine-600 text-sm font-semibold uppercase tracking-wider mb-2">Time Remaining</p>
              <div className="text-5xl font-mono font-bold text-pine-900 tabular-nums">
                {formatTime(timeLeft)}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                <span className="text-gray-500">Starting Price</span>
                <span className="font-bold text-pine-900">৳ 4,50,00,000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Current Highest Bid</span>
                <span className="text-2xl font-bold text-viridian-600">৳ 4,85,50,000</span>
              </div>
            </div>

            <div className="flex space-x-4">
              <button className="flex-1 bg-white border-2 border-viridian-600 text-viridian-600 py-4 rounded-xl font-bold text-lg hover:bg-viridian-50 transition-colors">
                + ৳5,00,000
              </button>
              <button className="flex-[2] bg-viridian-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-viridian-700 hover:shadow-xl transition-all transform hover:-translate-y-1">
                Place Custom Bid
              </button>
            </div>
            <p className="text-center text-xs text-gray-400 mt-4">By placing a bid, you agree to our Auction Terms & Conditions. Wallet deduction applies.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
