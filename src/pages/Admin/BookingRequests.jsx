import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import AdminSidebar from '../../components/AdminSidebar';
import { Loader2, CheckCircle, XCircle, Clock, Search, ExternalLink } from 'lucide-react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useGlobalState } from '../../context/GlobalState';

export default function BookingRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const { userProfile } = useGlobalState();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRequests = async () => {
      const { data } = await supabase.from('booking_requests').select('*').order('created_at', { ascending: false });
      if (data) {
        setRequests(data.map(d => ({
          id: d.id,
          clientName: d.client_name,
          clientEmail: d.client_email,
          clientPhone: d.client_phone,
          projectName: d.project_name,
          unitType: d.unit_type,
          parkingRequested: d.parking_requested,
          status: d.status,
          createdAt: d.created_at,
          linkedUserId: d.linked_user_id
        })));
      }
      setLoading(false);
    };

    fetchRequests();

    const sub = supabase.channel('public:booking_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_requests' }, fetchRequests)
      .subscribe();
      
    return () => supabase.removeChannel(sub);
  }, []);

  const handleReject = async (id, linkedUserId) => {
    if (!rejectReason) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    try {
      await supabase.from('booking_requests').update({
        status: 'Rejected',
        reject_reason: rejectReason,
        rejected_at: new Date().toISOString(),
        rejected_by: userProfile?.uid
      }).eq('id', id);
      
      if (linkedUserId) {
        await supabase.from('notifications').insert({
          user_id: linkedUserId,
          text: `Your expression of interest was not approved: ${rejectReason}`,
          read: false
        });
      }

      toast.success("Request rejected");
      setRejectingId(null);
      setRejectReason('');
    } catch (err) {
      console.error(err);
      toast.error("Failed to reject request");
    }
  };

  const filteredRequests = requests.filter(r => 
    r.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.clientEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.projectName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        
        <header className="bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between z-10">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-serif">Booking Requests</h1>
            <p className="text-sm text-gray-500 mt-1">Review public expressions of interest and convert to bookings.</p>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-8">
          
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/50 text-sm"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="animate-spin text-brand-primary" size={32} />
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Clock size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No booking requests found</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500">
                    <th className="p-4 font-semibold">Client</th>
                    <th className="p-4 font-semibold">Property</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRequests.map((r) => (
                    <React.Fragment key={r.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="p-4">
                          <div className="font-semibold text-gray-900">{r.clientName}</div>
                          <div className="text-sm text-gray-500">{r.clientEmail}</div>
                          <div className="text-sm text-gray-500">{r.clientPhone}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-medium text-brand-dark">{r.projectName}</div>
                          <div className="text-sm text-gray-500">{r.unitType}</div>
                          {r.parkingRequested > 0 && <div className="text-xs font-bold text-brand-primary mt-1">🚗 {r.parkingRequested} Parking Spot(s) Requested</div>}
                        </td>
                        <td className="p-4">
                          {r.status === 'Pending Review' && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Pending</span>}
                          {r.status === 'Converted' && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Converted</span>}
                          {r.status === 'Rejected' && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Rejected</span>}
                        </td>
                        <td className="p-4 text-sm text-gray-500">
                          {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="p-4 text-right">
                          {r.status === 'Pending Review' && (
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => navigate('/admin/bookings')} // Normally we'd pass state to auto-fill the modal
                                className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Convert to Booking"
                              >
                                <CheckCircle size={20} />
                              </button>
                              <button 
                                onClick={() => setRejectingId(r.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Reject"
                              >
                                <XCircle size={20} />
                              </button>
                            </div>
                          )}
                          {r.status === 'Converted' && (
                             <span className="text-xs text-gray-400 font-bold">Processed</span>
                          )}
                        </td>
                      </tr>
                      {rejectingId === r.id && (
                        <tr>
                          <td colSpan={5} className="p-4 bg-red-50 border-t border-red-100">
                            <div className="flex gap-4">
                              <input 
                                type="text"
                                placeholder="Reason for rejection..."
                                className="flex-1 p-2 border border-red-200 rounded text-sm"
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                              />
                              <button onClick={() => handleReject(r.id, r.linkedUserId)} className="px-4 py-2 bg-red-600 text-white rounded font-bold text-sm">Reject</button>
                              <button onClick={() => { setRejectingId(null); setRejectReason(''); }} className="px-4 py-2 text-red-600 font-bold text-sm">Cancel</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
