import React from 'react';

export default function LiveCameras() {
  const cameras = [
    { id: 1, project: 'The Sapphire Penthouse', status: 'Live', feed: 'https://images.unsplash.com/photo-1541888087525-cebfd64c2924?auto=format&fit=crop&q=80&w=800' },
    { id: 2, project: 'Emerald Heights', status: 'Live', feed: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=800' },
    { id: 3, project: 'Viridian Plaza', status: 'Offline', feed: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=800' },
    { id: 4, project: 'Oasis Towers', status: 'Live', feed: 'https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?auto=format&fit=crop&q=80&w=800' },
  ];

  return (
    <div className="min-h-screen bg-viridian-50 py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-pine-900 mb-4 text-center">Live Construction Cameras</h1>
        <p className="text-lg text-pine-700 text-center max-w-2xl mx-auto mb-12">
          Watch your investment grow in real-time. We provide 24/7 transparent access to all our active construction sites.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {cameras.map((cam) => (
            <div key={cam.id} className="bg-white rounded-2xl overflow-hidden shadow-lg border border-viridian-100 relative group">
              <div className="absolute top-4 left-4 z-20 flex items-center bg-black bg-opacity-50 px-3 py-1 rounded-full backdrop-blur-md">
                <span className={`w-3 h-3 rounded-full mr-2 ${cam.status === 'Live' ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}></span>
                <span className="text-white text-sm font-semibold">{cam.status}</span>
              </div>
              <div className="h-64 md:h-80 bg-cover bg-center relative" style={{ backgroundImage: `url('${cam.feed}')` }}>
                {/* Mock Video Overlay overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-10 transition-all"></div>
                <div className="absolute bottom-4 right-4 bg-black bg-opacity-70 px-2 py-1 rounded text-white text-xs font-mono">
                  {new Date().toLocaleTimeString()}
                </div>
              </div>
              <div className="p-6 bg-white flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-pine-900">{cam.project}</h3>
                  <p className="text-sm text-pine-600">Camera {cam.id} - Main Site Overview</p>
                </div>
                <button className="text-viridian-600 hover:text-viridian-800 p-2 rounded-full hover:bg-viridian-50 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
