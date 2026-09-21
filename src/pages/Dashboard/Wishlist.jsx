import React from 'react';
import { useGlobalState } from '../../context/GlobalState';
import { Link } from 'react-router-dom';

export default function Wishlist() {
  const { wishlist, toggleWishlist } = useGlobalState();

  return (
    <div className="min-h-screen bg-viridian-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-pine-900">My Wishlist</h1>
            <p className="text-pine-600 mt-2">Saved properties you are keeping an eye on.</p>
          </div>
          <span className="bg-viridian-200 text-pine-900 py-1 px-4 rounded-full text-sm font-bold">
            {wishlist.length} Saved
          </span>
        </div>

        {wishlist.length === 0 ? (
          <div className="bg-white rounded-2xl shadow border border-viridian-100 p-16 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
            <h3 className="text-xl font-bold text-pine-900 mb-2">Your wishlist is empty</h3>
            <p className="text-pine-600 mb-6">Browse our properties and click the heart icon to save them here.</p>
            <Link to="/projects" className="inline-block bg-viridian-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-viridian-700 transition-colors">Browse Projects</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {wishlist.map((property) => (
              <div key={property.id} className="bg-white rounded-2xl shadow-lg border border-viridian-100 overflow-hidden group">
                <div className="h-48 bg-gray-200 relative">
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=800')" }}></div>
                  <button 
                    onClick={() => toggleWishlist(property)}
                    className="absolute top-4 right-4 bg-white p-2 rounded-full text-red-500 hover:scale-110 transition-transform shadow-md"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"></path></svg>
                  </button>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-pine-900 mb-2">{property.name}</h3>
                  <div className="flex items-center text-pine-600 text-sm mb-4">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    {property.location}
                  </div>
                  <div className="flex justify-between items-center mt-6 pt-4 border-t border-viridian-100">
                    <span className="text-lg font-bold text-viridian-600">{property.price}</span>
                    <button className="text-sm font-semibold text-pine-800 hover:text-viridian-600 transition-colors">View Details →</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
