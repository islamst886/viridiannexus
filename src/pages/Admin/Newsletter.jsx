import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { Trash2, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import AdminSidebar from '../../components/AdminSidebar';

export default function AdminNewsletter() {
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const fetchSubscribers = async () => {
    try {
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .order('subscribed_at', { ascending: false });
      if (error) throw error;
      setSubscribers(data || []);
    } catch (error) {
      toast.error('Failed to fetch subscribers');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to remove this subscriber?')) {
      try {
        const { error } = await supabase.from('newsletter_subscribers').delete().eq('id', id);
        if (error) throw error;
        setSubscribers(prev => prev.filter(sub => sub.id !== id));
        toast.success('Subscriber removed');
      } catch (error) {
        toast.error('Failed to remove subscriber');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar />

      <div className="flex-1 p-10 h-screen overflow-y-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-serif text-brand-dark mb-2">Newsletter Subscribers</h1>
          <p className="text-gray-500">Manage the list of clients subscribed to exclusive updates.</p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading subscribers...</div>
        ) : subscribers.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-200">
            <Users className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-bold">No subscribers yet.</p>
            <p className="text-sm text-gray-400">When users subscribe via the footer, they will appear here.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Email Address</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Subscribed Date</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {subscribers.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-brand-dark">
                      {sub.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {sub.subscribed_at ? new Date(sub.subscribed_at).toLocaleDateString() : 'Unknown Date'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        {sub.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => handleDelete(sub.id)}
                        className="text-red-500 hover:text-red-700 transition-colors p-2 rounded hover:bg-red-50"
                        title="Remove Subscriber"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
