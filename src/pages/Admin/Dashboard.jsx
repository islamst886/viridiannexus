import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Plus, Edit, Trash2, Users, Building, DollarSign } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import AdminSidebar from '../../components/AdminSidebar';

export default function AdminDashboard() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ users: 0, properties: 0, value: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Real-time Properties listener
    const unsubProps = onSnapshot(collection(db, 'properties'), (snap) => {
      const propsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProperties(propsData);
      setStats(prev => ({ 
        ...prev, 
        properties: propsData.filter(p => p.status === 'Active').length 
      }));
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error("Failed to fetch properties");
      setLoading(false);
    });

    // 2. Real-time Users count listener
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setStats(prev => ({ ...prev, users: snap.size }));
    }, (error) => {
      console.error(error);
    });

    // 3. Real-time Bookings Value listener (Excludes Cancelled bookings)
    const unsubBookings = onSnapshot(collection(db, 'bookings'), (snap) => {
      const activeBookings = snap.docs.map(d => d.data()).filter(b => b.status !== 'Cancelled');
      const totalValue = activeBookings.reduce((acc, curr) => acc + (Number(curr.totalPrice) || 0), 0);
      setStats(prev => ({ ...prev, value: totalValue }));
    }, (error) => {
      console.error(error);
    });

    return () => {
      unsubProps();
      unsubUsers();
      unsubBookings();
    };
  }, []);

  const deleteCloudinaryMedia = async (url) => {
    if (!url || !url.includes('cloudinary.com')) return;
    try {
      await fetch('/api/deleteMedia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
    } catch (err) {
      console.error("Deletion API error:", err);
    }
  };

  const handleDelete = async (property) => {
    if (window.confirm("Are you sure you want to delete this property? All associated media will also be permanently deleted.")) {
      try {
        // Delete all associated media first
        if (property.images) {
          toast.info("Deleting associated media from Cloudinary...");
          const mediaUrls = Object.values(property.images).filter(url => url && url.includes('cloudinary.com'));
          for (const url of mediaUrls) {
            await deleteCloudinaryMedia(url);
          }
        }

        await deleteDoc(doc(db, 'properties', property.id));
        toast.success("Property deleted completely.");
      } catch (error) {
        toast.error("Failed to delete property");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar />

      {/* Main Content */}
      <div className="flex-1 p-10">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-serif text-brand-dark">Dashboard Overview</h1>
          <Link to="/admin/property/new" className="bg-brand-primary text-white px-6 py-3 rounded font-bold flex items-center gap-2 hover:bg-brand-dark transition-colors">
            <Plus size={20} /> Add New Property
          </Link>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{stats.users}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center">
              <Building size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Active Properties</p>
              <p className="text-2xl font-bold text-gray-900">{stats.properties}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Booking Value</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.value >= 10000000 
                  ? `৳ ${(stats.value / 10000000).toFixed(2)} Cr`
                  : stats.value >= 100000 
                  ? `৳ ${(stats.value / 100000).toFixed(2)} Lac`
                  : `৳ ${stats.value.toLocaleString()}`}
              </p>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-4 font-serif">Property Directory</h2>

        {/* Search Bar */}
        <div className="relative mb-6">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" /></svg>
          <input
            type="text"
            placeholder="Search by name, location or status..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-primary bg-white"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading properties...</div>
        ) : properties.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-200">
            <p className="text-gray-500 mb-4">No properties found in the database.</p>
            <p className="text-sm text-brand-primary font-bold">You need to add some properties for them to appear on the live site!</p>
          </div>
        ) : (() => {
          const q = searchQuery.toLowerCase();
          const filtered = properties.filter(p =>
            !q ||
            p.name?.toLowerCase().includes(q) ||
            p.location?.toLowerCase().includes(q) ||
            p.status?.toLowerCase().includes(q) ||
            p.propertyType?.toLowerCase().includes(q)
          );
          return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No properties match <strong>"{ searchQuery }"</strong>.
                <button onClick={() => setSearchQuery('')} className="ml-2 text-brand-primary font-bold hover:underline">Clear</button>
              </div>
            ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Property Name</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map((prop) => (
                  <tr key={prop.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-brand-dark">{prop.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{prop.location}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{prop.propertyType || <span className="italic text-gray-300">—</span>}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-primary font-semibold">{prop.price}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        {prop.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link to={`/admin/property/${prop.id}`} className="text-indigo-600 hover:text-indigo-900 mr-4">Edit</Link>
                      <button onClick={() => handleDelete(prop)} className="text-red-600 hover:text-red-900">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
          );
        })()}
      </div>
    </div>
  );
}

