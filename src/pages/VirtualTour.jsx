import React from 'react';

export default function VirtualTour() {
  return (
    <div className="min-h-screen bg-viridian-50 py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-pine-900 mb-6 text-center">Immersive Virtual Tour</h1>
        <p className="text-lg text-pine-700 text-center max-w-3xl mx-auto mb-12">
          Experience Viridian Nexus properties from the comfort of your home with our high-definition 360-degree virtual tours.
        </p>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden aspect-video relative border-4 border-viridian-200">
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-pine-900 bg-opacity-90 text-white z-10 transition-opacity duration-300 hover:opacity-0 group cursor-pointer">
            <svg className="w-20 h-20 mb-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <h3 className="text-2xl font-bold">Click to start 360° Tour</h3>
            <p className="mt-2 text-viridian-200">The Sapphire Penthouse</p>
          </div>
          {/* Mock Iframe for 360 viewer */}
          <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=2000')" }}></div>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-lg group cursor-pointer hover:-translate-y-2 transition-all duration-300">
              <div className="h-48 bg-cover bg-center" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=800&sig=${i}')` }}></div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-pine-900 mb-2">Emerald Heights Unit {i}A</h3>
                <button className="text-viridian-600 font-semibold group-hover:text-viridian-800 flex items-center">
                  Take Tour <span className="ml-2">→</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
