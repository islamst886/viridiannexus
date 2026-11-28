import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabase';
import { isActiveAllocationStatus } from '../../utils/bookingAllocation';
import {
  deletePropertySafely,
  fetchPropertyDeletionCheck,
} from '../../utils/propertyDeletion';
import type { Property } from '../../types';
import { Plus, Trash2, Users, Building, DollarSign, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import AdminSidebar from '../../components/AdminSidebar';
import { useGlobalState } from '../../context/GlobalState';

interface DashboardStats {
  users: number;
  properties: number;
  value: number;
}

export default function AdminDashboard() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<DashboardStats>({ users: 0, properties: 0, value: 0 });
  const [activeBookingCounts, setActiveBookingCounts] = useState<Record<string, number>>({});
  const [deletingPropertyId, setDeletingPropertyId] = useState<string | null>(null);

  const { properties: globalProperties, loadingProperties, fetchProperties } = useGlobalState();

  // Use GlobalState properties (already realtime)
  useEffect(() => {
    setProperties(globalProperties);
    setStats(prev => ({ ...prev, properties: globalProperties.filter(p => p.status === 'Active').length }));
    setLoading(loadingProperties);
  }, [globalProperties, loadingProperties]);

  // Fetch stats from Supabase
  useEffect(() => {
    const fetchStats = async (): Promise<void> => {
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('property_id, total_price, status');
      const rows =
        (bookingsData as {
          property_id?: string | null;
          total_price?: number | string | null;
          status?: string | null;
        }[] | null) || [];
      let totalValue = 0;
      const countsByProperty: Record<string, number> = {};
      for (const b of rows) {
        if (!isActiveAllocationStatus(b.status)) continue;
        totalValue += Number(b.total_price) || 0;
        if (b.property_id) {
          countsByProperty[b.property_id] = (countsByProperty[b.property_id] || 0) + 1;
        }
      }
      setActiveBookingCounts(countsByProperty);
      setStats(prev => ({ ...prev, users: usersCount || 0, value: totalValue }));
    };
    void fetchStats();

    const statsSub = supabase
      .channel('dashboard_stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { void fetchStats(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => { void fetchStats(); })
      .subscribe();
    return () => {
      void supabase.removeChannel(statsSub);
    };
  }, []);

  const handleDelete = async (property: Property): Promise<void> => {
    if (deletingPropertyId) return;
    setDeletingPropertyId(property.id);

    try {
      const dependencyCheck = await fetchPropertyDeletionCheck(property.id);
      if (!dependencyCheck.canDelete) {
        toast.error(dependencyCheck.blockers.join(' '));
        return;
      }

      const historyParts: string[] = [];
      if (dependencyCheck.cancelledBookingIds.length > 0) {
        historyParts.push(
          `${dependencyCheck.cancelledBookingIds.length} cancelled booking(s)`
        );
      }
      if (dependencyCheck.processedRequestIds.length > 0) {
        historyParts.push(
          `${dependencyCheck.processedRequestIds.length} processed booking request(s)`
        );
      }
      const historyNote =
        historyParts.length > 0
          ? `\n\nHistorical records (${historyParts.join(' and ')}) will be preserved with their property link cleared.`
          : '';

      if (
        !window.confirm(
          `Are you sure you want to permanently delete "${property.name}"?${historyNote}\n\nAll associated media files will be removed only after the property record is deleted.`
        )
      ) {
        return;
      }

      const result = await deletePropertySafely({ property });
      if (!result.deleted) {
        toast.error(result.error || 'Failed to delete property.');
        return;
      }

      await fetchProperties();

      if (result.failedMediaCount > 0) {
        toast.warning(
          `Property deleted, though ${result.failedMediaCount} media file(s) could not be removed from storage.`
        );
      } else {
        toast.success('Property and associated media deleted completely.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error deleting property.';
      toast.error(msg);
    } finally {
      setDeletingPropertyId(null);
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
            Boolean(p.name?.toLowerCase().includes(q)) ||
            Boolean(p.location?.toLowerCase().includes(q)) ||
            Boolean(p.status?.toLowerCase().includes(q)) ||
            (() => {
              const pTypesStr = Array.isArray(p.propertyType) ? p.propertyType.join(' ') : (p.propertyType || '');
              return pTypesStr.toLowerCase().includes(q);
            })()
          );
          return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No properties match <strong>"{searchQuery}"</strong>.
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
                    {filtered.map((prop) => {
                      const activeCount = activeBookingCounts[prop.id] || 0;
                      const isDeleting = deletingPropertyId === prop.id;
                      return (
                        <tr key={prop.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-brand-dark">
                            <div>{prop.name}</div>
                            {activeCount > 0 && (
                              <span className="mt-1 inline-block px-2 py-0.5 text-[11px] font-semibold rounded bg-amber-100 text-amber-800">
                                {activeCount} Active Booking{activeCount === 1 ? '' : 's'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{prop.location}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {Array.isArray(prop.propertyType)
                              ? (prop.propertyType.length > 0 ? prop.propertyType.join(', ') : <span className="italic text-gray-300">—</span>)
                              : (prop.propertyType || <span className="italic text-gray-300">—</span>)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-primary font-semibold">{prop.price}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              {prop.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link to={`/admin/property/${prop.id}`} className="text-indigo-600 hover:text-indigo-900 mr-4">Edit</Link>
                            <button
                              type="button"
                              onClick={() => { void handleDelete(prop); }}
                              disabled={Boolean(deletingPropertyId)}
                              className={`inline-flex items-center gap-1 disabled:opacity-50 ${
                                activeCount > 0
                                  ? 'text-amber-700 hover:text-amber-900'
                                  : 'text-red-600 hover:text-red-900'
                              }`}
                              title={
                                activeCount > 0
                                  ? `Cannot delete while ${activeCount} active booking(s) reference this property`
                                  : 'Delete Property'
                              }
                            >
                              {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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
