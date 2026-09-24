import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, collection, onSnapshot, query, orderBy, updateDoc, addDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useParams, useNavigate } from 'react-router-dom';
import AdminSidebar from '../../components/AdminSidebar';
import { useGlobalState } from '../../context/GlobalState';
import { 
  ArrowLeft, ArrowRight, CheckCircle, Clock, AlertCircle, FileText, 
  DollarSign, Loader2, Save, User as UserIcon, Building, ShieldCheck, X, RefreshCw, AlertTriangle
} from 'lucide-react';
import { toast } from 'react-toastify';
import StageAdvanceModal from './StageAdvanceModal';
import CancelBookingModal from './CancelBookingModal';
import ReleaseParkingModal from './ReleaseParkingModal';
import AddParkingModal from './AddParkingModal';
import ChangeParkingModal from './ChangeParkingModal';

const STAGES = [
  'EOI', 'Token Paid', 'Agreement Signed', 'Down Payment Paid', 
  'Installments Running', 'Fully Paid', 'Handover', 'Completed'
];

export default function AdminBookingDetail() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { userProfile, isSuperAdmin } = useGlobalState();
  const adminUid = userProfile?.uid;
  const adminName = userProfile?.displayName || 'Admin';

  const [booking, setBooking] = useState(null);
  const [payments, setPayments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [targetStageCandidate, setTargetStageCandidate] = useState(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  
  const [isCustomPaymentModalOpen, setIsCustomPaymentModalOpen] = useState(false);
  
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);
  
  const [isChangeUnitModalOpen, setIsChangeUnitModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isReleaseParkingModalOpen, setIsReleaseParkingModalOpen] = useState(false);
  const [isAddParkingModalOpen, setIsAddParkingModalOpen] = useState(false);
  const [isChangeParkingModalOpen, setIsChangeParkingModalOpen] = useState(false);
  
  const [linkedUser, setLinkedUser] = useState(null);
  const [syncingProfile, setSyncingProfile] = useState(false);

  useEffect(() => {
    if (!booking?.linkedUserId) {
      setLinkedUser(null);
      return;
    }

    const uSub = onSnapshot(doc(db, 'users', booking.linkedUserId), (docSnap) => {
      if (docSnap.exists()) {
        setLinkedUser({ id: docSnap.id, ...docSnap.data() });
      }
    });

    return () => uSub();
  }, [booking?.linkedUserId]);

  const profileDifferences = React.useMemo(() => {
    if (!booking || !linkedUser) return [];
    const diffs = [];

    if (linkedUser.displayName && booking.clientName !== linkedUser.displayName) {
      diffs.push({ field: 'Name', current: booking.clientName, updated: linkedUser.displayName });
    }
    if (linkedUser.phone && booking.clientPhone !== linkedUser.phone) {
      diffs.push({ field: 'Phone', current: booking.clientPhone, updated: linkedUser.phone });
    }
    if (linkedUser.email && booking.clientEmail !== linkedUser.email) {
      diffs.push({ field: 'Email', current: booking.clientEmail, updated: linkedUser.email });
    }
    if (linkedUser.nid && booking.clientNid !== linkedUser.nid) {
      diffs.push({ 
        field: linkedUser.nidType || 'NID', 
        current: booking.clientNid || 'Not set', 
        updated: linkedUser.nid 
      });
    }
    if (linkedUser.address && booking.clientAddress !== linkedUser.address) {
      diffs.push({ field: 'Address', current: booking.clientAddress || 'Not set', updated: linkedUser.address });
    }

    return diffs;
  }, [booking, linkedUser]);

  const handleSyncWithUserProfile = async () => {
    if (!linkedUser || !booking) return;
    setSyncingProfile(true);
    try {
      const updates = {
        clientName: linkedUser.displayName || booking.clientName,
        clientPhone: linkedUser.phone || booking.clientPhone,
        clientEmail: linkedUser.email || booking.clientEmail,
        clientNid: linkedUser.nid || booking.clientNid || '',
        clientNidType: linkedUser.nidType || booking.clientNidType || 'NID',
        clientAddress: linkedUser.address || booking.clientAddress || '',
        lastUpdatedAt: serverTimestamp(),
        lastUpdatedBy: adminUid
      };

      await updateDoc(doc(db, 'bookings', bookingId), updates);

      await addDoc(collection(db, `bookings/${bookingId}/activityLog`), {
        action: "Client Details Synced",
        detail: `Client details synchronized with linked user account (${linkedUser.email}) by ${adminName}`,
        performedBy: adminName,
        performedAt: serverTimestamp()
      });

      toast.success("Client details synchronized with user profile!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to sync client details.");
    } finally {
      setSyncingProfile(false);
    }
  };

  useEffect(() => {
    // 1. Booking Doc
    const bSub = onSnapshot(doc(db, 'bookings', bookingId), (docSnap) => {
      if (docSnap.exists()) {
        setBooking({ id: docSnap.id, ...docSnap.data() });
      } else {
        toast.error('Booking not found');
        navigate('/admin/bookings');
      }
      setLoading(false);
    });

    // 2. Payments Ledger
    const pSub = onSnapshot(query(collection(db, `bookings/${bookingId}/payments`), orderBy('scheduledDate', 'asc')), (snap) => {
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. Activity Log
    const aSub = onSnapshot(query(collection(db, `bookings/${bookingId}/activityLog`), orderBy('performedAt', 'desc')), (snap) => {
      setActivity(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { bSub(); pSub(); aSub(); };
  }, [bookingId, navigate]);

  const handleStatusChange = async (newStatus) => {
    const actionText = newStatus === 'On Hold' ? 'put this booking on hold' : 'resume this booking';
                       
    if (!window.confirm(`Are you sure you want to ${actionText}?`)) return;
    
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: newStatus,
        lastUpdatedAt: serverTimestamp(),
        lastUpdatedBy: adminUid
      });

      await addDoc(collection(db, `bookings/${bookingId}/activityLog`), {
        action: "Status Changed",
        detail: `Booking status changed to ${newStatus}`,
        performedBy: adminName,
        performedAt: serverTimestamp()
      });
      toast.success(`Booking ${newStatus === 'On Hold' ? 'put on hold' : 'resumed'}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update status");
    }
  };


  const formatMoney = (amount) => {
    if (amount === undefined || amount === null) return '৳0';
    return '৳ ' + Math.round(Number(amount)).toLocaleString('en-IN');
  };

  const formatDate = (ts) => {
    if (!ts) return 'N/A';
    // Handle Firestore Timestamp
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading || !booking) {
    return (
      <div className="flex h-screen bg-gray-50">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-brand-primary" size={48} />
        </div>
      </div>
    );
  }

  const completionPct = Math.min(100, Math.round(((booking.totalPaid || 0) / booking.totalPrice) * 100));

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/admin/bookings')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft size={24} className="text-gray-500" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 font-serif">{booking.bookingRef}</h1>
                <span className={`px-2 py-1 rounded text-xs font-bold ${booking.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-800'}`}>
                  {booking.status}
                </span>
              </div>
              <p className="text-sm text-gray-500">Created on {formatDate(booking.createdAt)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {booking.status !== 'Cancelled' && (
              <>
                <button 
                  onClick={() => handleStatusChange(booking.status === 'On Hold' ? 'Active' : 'On Hold')}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  {booking.status === 'On Hold' ? 'Resume Booking' : 'Put on Hold'}
                </button>
                <button 
                  onClick={() => setIsAddParkingModalOpen(true)}
                  className="px-4 py-2 bg-brand-primary/10 text-brand-dark border border-brand-primary/20 rounded-lg text-sm font-semibold hover:bg-brand-primary/20 transition-colors flex items-center gap-1.5"
                >
                  🚗 Add Parking
                </button>
                {booking.parkingIncluded && (
                  <>
                    <button 
                      onClick={() => setIsChangeParkingModalOpen(true)}
                      className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                    >
                      🔄 Swap Parking
                    </button>
                    <button 
                      onClick={() => setIsReleaseParkingModalOpen(true)}
                      className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-semibold hover:bg-amber-100 transition-colors flex items-center gap-1.5"
                    >
                      🚗 Release Parking
                    </button>
                  </>
                )}
                <button 
                  onClick={() => setIsCancelModalOpen(true)}
                  className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors"
                >
                  Cancel Booking
                </button>
              </>
            )}
            {booking.status === 'Cancelled' && (
              <span className="px-4 py-2 bg-red-100 text-red-800 rounded-lg text-sm font-bold border border-red-200 flex items-center gap-2 shadow-sm">
                <AlertTriangle size={16} /> Cancelled
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-8 flex flex-col gap-6">
          
          {booking.status === 'Cancelled' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm flex items-start gap-4">
              <div className="bg-red-100 text-red-600 p-3 rounded-full shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div className="flex-1">
                <h2 className="text-red-800 font-bold text-lg mb-1">Booking Cancelled</h2>
                <p className="text-red-700 text-sm mb-3">
                  This booking was cancelled on <span className="font-semibold">{formatDate(booking.cancellationDate)}</span> by <span className="font-semibold">{booking.cancelledBy || 'an admin'}</span>.
                </p>
                <div className="bg-white/80 border border-red-100 rounded-lg p-4 text-sm text-gray-800 shadow-sm relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-red-300 before:rounded-l-lg">
                  <strong className="block text-xs text-red-800 uppercase font-bold mb-1 tracking-wider">Cancellation Note</strong>
                  <span className="italic">"{booking.cancellationNote || 'No reason provided.'}"</span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* Left Column - Client & Property */}
            <div className="xl:col-span-1 space-y-6">
              
              {/* Client Info */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <UserIcon size={20} className="text-brand-primary" />
                  <h2 className="text-lg font-bold">Client Details</h2>
                  {booking.linkedUserId && (
                    <span className="ml-2 flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded">
                      <ShieldCheck size={14} /> Linked
                    </span>
                  )}
                  {booking.status !== 'Cancelled' && (
                    <button onClick={() => setIsEditClientModalOpen(true)} className="ml-auto text-xs font-bold text-brand-primary hover:underline">
                      Edit Details
                    </button>
                  )}
                </div>

                {/* Profile Sync Notification Banner if differences exist */}
                {profileDifferences.length > 0 && booking.status !== 'Cancelled' && (
                  <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-3.5 mb-4 text-xs space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900">
                        <AlertCircle size={15} className="text-amber-600 shrink-0" />
                        <span>User Profile Has Updated</span>
                      </div>
                      <button
                        onClick={handleSyncWithUserProfile}
                        disabled={syncingProfile}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-colors shrink-0 shadow-sm"
                        title="Update this booking's client details to match their current profile"
                      >
                        {syncingProfile ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        Sync Profile
                      </button>
                    </div>
                    <p className="text-amber-800 text-[11px] leading-tight">
                      The linked user updated their profile. Review changes:
                    </p>
                    <div className="space-y-1 bg-white/70 p-2 rounded-lg border border-amber-200/50">
                      {profileDifferences.map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px] gap-2">
                          <span className="font-semibold text-gray-700">{d.field}:</span>
                          <span className="text-gray-400 line-through truncate max-w-[85px]">{d.current}</span>
                          <span className="font-bold text-emerald-800 truncate max-w-[110px]">→ {d.updated}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 text-sm">
                  <div><span className="text-gray-500 block text-xs font-bold uppercase">Name</span> <span className="font-medium text-gray-900">{booking.clientName}</span></div>
                  <div><span className="text-gray-500 block text-xs font-bold uppercase">Phone</span> <span className="font-medium text-gray-900">{booking.clientPhone}</span></div>
                  <div><span className="text-gray-500 block text-xs font-bold uppercase">Email</span> <span className="font-medium text-gray-900">{booking.clientEmail}</span></div>
                  <div><span className="text-gray-500 block text-xs font-bold uppercase">{booking.clientNidType || 'NID / Passport'}</span> <span className="font-medium text-gray-900">{booking.clientNid || 'Not provided'}</span></div>
                  <div><span className="text-gray-500 block text-xs font-bold uppercase">Current Address</span> <span className="font-medium text-gray-900">{booking.clientAddress || 'Not provided'}</span></div>
                </div>
              </div>

              {/* Property Info */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Building size={20} className="text-brand-primary" />
                  <h2 className="text-lg font-bold">Property Details</h2>
                  {booking.status !== 'Cancelled' && (
                    <button onClick={() => setIsChangeUnitModalOpen(true)} className="ml-auto text-xs font-bold text-brand-primary hover:underline">
                      Change Unit
                    </button>
                  )}
                </div>
                <div className="space-y-3 text-sm">
                  <div><span className="text-gray-500 block text-xs font-bold uppercase">Project</span> <span className="font-medium text-brand-dark text-lg">{booking.propertyName}</span></div>
                  <div><span className="text-gray-500 block text-xs font-bold uppercase">Location</span> <span className="font-medium text-gray-900">{booking.propertyLocation}</span></div>
                  <div><span className="text-gray-500 block text-xs font-bold uppercase">Unit Type</span> <span className="font-medium text-gray-900">{booking.unitType}</span></div>
                  <div><span className="text-gray-500 block text-xs font-bold uppercase">Unit Number</span> <span className="font-medium text-gray-900">{booking.unitNumber || 'TBD'}</span></div>
                  {booking.parkingIncluded && (
                    <div>
                      <span className="text-gray-500 block text-xs font-bold uppercase">Parking Assigned</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">🚗 {booking.parkingIncluded}</span>
                        {booking.status !== 'Cancelled' && (
                          <button onClick={() => setIsReleaseParkingModalOpen(true)} className="text-xs font-bold text-amber-600 hover:text-amber-800 underline underline-offset-2 transition-colors">
                            Release
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Financials & Ledger */}
            <div className="xl:col-span-2 space-y-6">
              
              {/* Financial Overview */}
              <div className="bg-brand-dark text-brand-neutral p-6 rounded-xl shadow-lg relative overflow-hidden">
                <div className="absolute -right-10 -bottom-10 opacity-10">
                  <DollarSign size={160} />
                </div>
                <h2 className="text-lg font-bold font-serif mb-6 text-brand-accent">Financial Overview</h2>
                <div className="grid grid-cols-3 gap-6 mb-6">
                  <div>
                    <p className="text-brand-neutral/60 text-xs font-bold uppercase mb-1">Total Agreed Price</p>
                    <p className="text-2xl font-bold">{formatMoney(booking.totalPrice)}</p>
                  </div>
                  <div>
                    <p className="text-brand-neutral/60 text-xs font-bold uppercase mb-1">Total Received</p>
                    <p className="text-2xl font-bold text-green-400">{formatMoney(booking.totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-brand-neutral/60 text-xs font-bold uppercase mb-1">Balance Due</p>
                    <p className={`text-2xl font-bold ${booking.balanceDue > 0 ? 'text-red-400' : 'text-brand-neutral'}`}>{formatMoney(booking.balanceDue)}</p>
                  </div>
                </div>
                <div className="w-full bg-black/40 rounded-full h-2.5 mb-2">
                  <div className="bg-brand-accent h-2.5 rounded-full" style={{ width: `${completionPct}%` }}></div>
                </div>
                <p className="text-xs text-brand-neutral/60 text-right">{completionPct}% Completed</p>
              </div>

              {/* Stage Stepper */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-lg font-bold">Booking Stage</h2>
                    <p className="text-xs text-gray-500">Track and advance project milestones</p>
                  </div>
                  {booking.status !== 'Cancelled' && (
                    <button 
                      onClick={() => { setTargetStageCandidate(null); setIsStageModalOpen(true); }}
                      className="px-4 py-2 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      Advance Milestone
                    </button>
                  )}
                </div>

                <div className="flex items-center">
                  {STAGES.map((s, idx) => {
                    const isCompleted = STAGES.indexOf(booking.stage) >= idx;
                    const isCurrent = booking.stage === s;
                    return (
                      <div 
                        key={s} 
                        className="flex-1 relative flex flex-col items-center cursor-pointer group"
                        onClick={() => { 
                          if (booking.status !== 'Cancelled') {
                            setTargetStageCandidate(s); 
                            setIsStageModalOpen(true); 
                          }
                        }}
                        title={`Click to view milestone requirements for ${s}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-transform group-hover:scale-110 shadow-sm ${isCompleted ? 'bg-brand-primary text-white' : 'bg-gray-200 text-gray-500'} ${isCurrent ? 'ring-4 ring-brand-primary/20' : ''}`}>
                          {isCompleted ? <CheckCircle size={16} /> : idx + 1}
                        </div>
                        {idx < STAGES.length - 1 && (
                          <div className={`absolute top-4 left-1/2 w-full h-1 -translate-y-1/2 ${STAGES.indexOf(booking.stage) > idx ? 'bg-brand-primary' : 'bg-gray-200'}`} />
                        )}
                        <span className={`text-[10px] font-bold mt-2 text-center max-w-[60px] leading-tight group-hover:text-brand-primary transition-colors ${isCurrent ? 'text-brand-primary' : 'text-gray-500'}`}>{s}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payment Ledger */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                  <h2 className="text-lg font-bold flex items-center gap-2"><FileText size={20} /> Payment Ledger</h2>
                  {booking.status !== 'Cancelled' && (
                    <button onClick={() => setIsCustomPaymentModalOpen(true)} className="text-sm font-bold text-brand-primary hover:underline">Add Custom Payment</button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Type</th>
                        <th className="px-6 py-3 font-semibold">Scheduled</th>
                        <th className="px-6 py-3 font-semibold">Due Amount</th>
                        <th className="px-6 py-3 font-semibold">Status</th>
                        <th className="px-6 py-3 font-semibold">Received</th>
                        <th className="px-6 py-3 font-semibold">Mode</th>
                        <th className="px-6 py-3 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {payments.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-8 text-gray-500">No payments scheduled</td></tr>
                      ) : (
                        payments.map((p) => {
                          const isOverdue = p.status === 'Scheduled' && (p.scheduledDate.toDate ? p.scheduledDate.toDate() : new Date(p.scheduledDate)) < new Date();
                          
                          let statusBadge = '';
                          if (p.status === 'Paid') statusBadge = 'bg-green-100 text-green-800';
                          else if (p.status === 'Partially Paid') statusBadge = 'bg-amber-100 text-amber-800';
                          else if (p.status === 'Waived') statusBadge = 'bg-gray-200 text-gray-800';
                          else if (isOverdue) statusBadge = 'bg-red-100 text-red-800';
                          else statusBadge = 'bg-blue-50 text-blue-800';

                          return (
                            <tr key={p.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 font-semibold text-gray-900">
                                {p.type} {p.installmentNumber ? `#${p.installmentNumber}` : ''}
                              </td>
                              <td className="px-6 py-4 text-gray-500">{formatDate(p.scheduledDate)}</td>
                              <td className="px-6 py-4 font-bold text-gray-900">{formatMoney(p.scheduledAmount)}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${statusBadge}`}>
                                  {isOverdue ? 'Overdue' : p.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-bold text-green-600">{p.receivedAmount > 0 ? formatMoney(p.receivedAmount) : '—'}</td>
                              <td className="px-6 py-4 text-gray-500">{p.paymentMode || '—'}</td>
                              <td className="px-6 py-4 text-right">
                                {p.status !== 'Paid' && p.status !== 'Waived' ? (
                                  booking.status === 'Cancelled' ? (
                                    <span className="text-gray-400">Canceled</span>
                                  ) : (
                                    <button 
                                      onClick={() => { setSelectedPayment(p); setIsPaymentModalOpen(true); }}
                                      className="text-brand-primary font-bold hover:underline"
                                    >
                                      Record
                                    </button>
                                  )
                                ) : (
                                  <span className="text-gray-400">Done</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
          
          {/* Activity Log - Full Width */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2"><Clock size={20} /> Activity Log</h2>
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
              {activity.map((log) => (
                <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-brand-primary/10 text-brand-primary shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                    <CheckCircle size={16} />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-gray-50 p-4 rounded-lg border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-gray-900">{log.action}</span>
                      <span className="text-xs text-gray-500">{formatDate(log.performedAt)}</span>
                    </div>
                    <div className="text-sm text-gray-600">{log.detail}</div>
                    <div className="text-xs text-gray-400 mt-2 flex justify-end">- by {log.performedBy}</div>
                  </div>
                </div>
              ))}
              {activity.length === 0 && <div className="text-center text-gray-500 py-4">No activity recorded yet</div>}
            </div>
          </div>

        </main>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && selectedPayment && (
        <PaymentModal 
          payment={selectedPayment}
          bookingId={bookingId}
          adminName={adminName}
          adminUid={adminUid}
          onClose={() => setIsPaymentModalOpen(false)}
        />
      )}

      {/* Custom Payment Modal */}
      {isCustomPaymentModalOpen && (
        <CustomPaymentModal 
          bookingId={bookingId}
          adminName={adminName}
          adminUid={adminUid}
          onClose={() => setIsCustomPaymentModalOpen(false)}
        />
      )}

      {/* Edit Client Modal */}
      {isEditClientModalOpen && (
        <EditClientModal 
          booking={booking}
          adminName={adminName}
          adminUid={adminUid}
          onClose={() => setIsEditClientModalOpen(false)}
        />
      )}

      {/* Change Unit Modal */}
      {isChangeUnitModalOpen && (
        <ChangeUnitModal
          booking={booking}
          adminName={adminName}
          adminUid={adminUid}
          onClose={() => setIsChangeUnitModalOpen(false)}
        />
      )}

      {/* Stage Advance Modal */}
      {isStageModalOpen && (
        <StageAdvanceModal
          isOpen={isStageModalOpen}
          onClose={() => setIsStageModalOpen(false)}
          booking={booking}
          payments={payments}
          initialTargetStage={targetStageCandidate}
          isSuperAdmin={isSuperAdmin}
          adminName={adminName}
          adminUid={adminUid}
        />
      )}

      <CancelBookingModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        booking={booking}
        adminName={adminName}
        adminUid={adminUid}
        onSuccess={() => setIsCancelModalOpen(false)}
      />
      
      <ReleaseParkingModal
        isOpen={isReleaseParkingModalOpen}
        onClose={() => setIsReleaseParkingModalOpen(false)}
        booking={booking}
        onComplete={() => setIsReleaseParkingModalOpen(false)}
      />

      <AddParkingModal
        isOpen={isAddParkingModalOpen}
        onClose={() => setIsAddParkingModalOpen(false)}
        booking={booking}
        onComplete={() => setIsAddParkingModalOpen(false)}
      />

      <ChangeParkingModal
        isOpen={isChangeParkingModalOpen}
        onClose={() => setIsChangeParkingModalOpen(false)}
        booking={booking}
        onComplete={() => setIsChangeParkingModalOpen(false)}
      />
    </div>
  );
}

// Payment Modal Component
function PaymentModal({ payment, bookingId, adminName, adminUid, onClose }) {
  const [amount, setAmount] = useState(payment.scheduledAmount);
  const [mode, setMode] = useState('Bank Transfer');
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || amount <= 0) return toast.error("Amount must be greater than zero");
    
    if (!window.confirm(`Are you sure you want to record a payment of ৳${Number(amount).toLocaleString('en-IN')} via ${mode}?\n\nThis will update the client's payment ledger and financial summary. Please ensure the amount is correct before confirming.`)) {
      return;
    }
    
    setLoading(true);

    try {
      const numAmount = Number(amount);
      const isFull = numAmount >= payment.scheduledAmount;
      
      // Update Payment Doc
      await updateDoc(doc(db, `bookings/${bookingId}/payments`, payment.id), {
        receivedAmount: numAmount,
        paymentMode: mode,
        referenceNumber: ref,
        note: note,
        status: isFull ? 'Paid' : 'Partially Paid',
        paidDate: serverTimestamp(),
        recordedBy: adminUid
      });

      // Update Booking Totals
      const bookingRef = doc(db, 'bookings', bookingId);
      const bookingDoc = await getDoc(bookingRef);
      if (bookingDoc.exists()) {
        const data = bookingDoc.data();
        const newTotalPaid = (Number(data.totalPaid) || 0) + numAmount;
        const newBalance = Math.max(0, Number(data.totalPrice) - newTotalPaid);
        
        let nextStage = data.stage;
        
        if (isFull) {
          if (payment.type === 'Token' && STAGES.indexOf(data.stage) < STAGES.indexOf('Token Paid')) {
            nextStage = 'Token Paid';
          } else if (payment.type === 'Down Payment' && STAGES.indexOf(data.stage) < STAGES.indexOf('Down Payment Paid')) {
            nextStage = 'Down Payment Paid';
          } else if (payment.type.startsWith('Installment') && STAGES.indexOf(data.stage) < STAGES.indexOf('Installments Running')) {
            nextStage = 'Installments Running';
          }
        }
        
        if (newBalance === 0 && STAGES.indexOf(nextStage) < STAGES.indexOf('Fully Paid')) {
          nextStage = 'Fully Paid';
        }

        await updateDoc(bookingRef, {
          totalPaid: newTotalPaid,
          balanceDue: newBalance,
          stage: nextStage,
          lastUpdatedAt: serverTimestamp(),
          lastUpdatedBy: adminUid
        });
      }

      // Log
      await addDoc(collection(db, `bookings/${bookingId}/activityLog`), {
        action: "Payment Recorded",
        detail: `${payment.type} payment of ৳${numAmount.toLocaleString()} received via ${mode}`,
        performedBy: adminName,
        performedAt: serverTimestamp()
      });

      toast.success("Payment recorded successfully");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to record payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24} /></button>
        <h3 className="text-xl font-bold font-serif mb-4">Record Payment</h3>
        <p className="text-sm text-gray-500 mb-6">Recording payment for {payment.type} (Due: ৳{payment.scheduledAmount.toLocaleString()})</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Amount Received (BDT) *</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-3 border rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Payment Mode *</label>
            <select value={mode} onChange={e => setMode(e.target.value)} className="w-full p-3 border rounded-lg">
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
              <option value="Mobile Banking">Mobile Banking (bKash/Nagad)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Reference Number</label>
            <input type="text" value={ref} onChange={e => setRef(e.target.value)} placeholder="Txn ID or Cheque No." className="w-full p-3 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Internal Note</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} className="w-full p-3 border rounded-lg" />
          </div>
          
          <button type="submit" disabled={loading} className="w-full py-3 bg-brand-primary text-white font-bold rounded-lg mt-2 flex items-center justify-center gap-2 hover:bg-brand-dark transition-colors disabled:opacity-50">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Confirm Payment
          </button>
        </form>
      </div>
    </div>
  );
}

// Custom Payment Modal Component
function CustomPaymentModal({ bookingId, adminName, adminUid, onClose }) {
  const [type, setType] = useState('Custom Installment');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || amount <= 0) return toast.error("Amount must be greater than zero");
    if (!dueDate) return toast.error("Due date is required");
    setLoading(true);

    try {
      const numAmount = Number(amount);
      
      // Create new scheduled payment
      await addDoc(collection(db, `bookings/${bookingId}/payments`), {
        type: type,
        scheduledAmount: numAmount,
        scheduledDate: new Date(dueDate),
        status: 'Scheduled',
        receivedAmount: 0,
        createdAt: serverTimestamp(),
        createdBy: adminUid
      });

      // Update Booking Total Price
      const bookingRef = doc(db, 'bookings', bookingId);
      const bookingDoc = await getDoc(bookingRef);
      if (bookingDoc.exists()) {
        const data = bookingDoc.data();
        const newTotalPrice = (Number(data.totalPrice) || 0) + numAmount;
        const newBalance = Math.max(0, newTotalPrice - (Number(data.totalPaid) || 0));
        
        await updateDoc(bookingRef, {
          totalPrice: newTotalPrice,
          balanceDue: newBalance,
          lastUpdatedAt: serverTimestamp(),
          lastUpdatedBy: adminUid
        });
      }

      // Log
      await addDoc(collection(db, `bookings/${bookingId}/activityLog`), {
        action: "Custom Payment Added",
        detail: `Added ${type} for ৳${numAmount.toLocaleString()}`,
        performedBy: adminName,
        performedAt: serverTimestamp()
      });

      toast.success("Custom payment scheduled successfully");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to add custom payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24} /></button>
        <h3 className="text-xl font-bold font-serif mb-4">Add Custom Payment</h3>
        <p className="text-sm text-gray-500 mb-6">Schedule a new payment (e.g., Penalty, Utilities, Custom Installment).</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Payment Type *</label>
            <input type="text" value={type} onChange={e => setType(e.target.value)} className="w-full p-3 border rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Amount Due (BDT) *</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-3 border rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Due Date *</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full p-3 border rounded-lg" required />
          </div>
          
          <button type="submit" disabled={loading} className="w-full py-3 bg-brand-primary text-white font-bold rounded-lg mt-2 flex items-center justify-center gap-2 hover:bg-brand-dark transition-colors disabled:opacity-50">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Schedule Payment
          </button>
        </form>
      </div>
    </div>
  );
}

// Edit Client Modal Component
function EditClientModal({ booking, adminName, adminUid, onClose }) {
  const [formData, setFormData] = useState({
    clientName: booking.clientName || '',
    clientPhone: booking.clientPhone || '',
    clientEmail: booking.clientEmail || '',
    clientNid: booking.clientNid || '',
    clientAddress: booking.clientAddress || ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        ...formData,
        lastUpdatedAt: serverTimestamp(),
        lastUpdatedBy: adminUid
      });

      await addDoc(collection(db, `bookings/${booking.id}/activityLog`), {
        action: "Client Details Updated",
        detail: `Client information was updated by ${adminName}`,
        performedBy: adminName,
        performedAt: serverTimestamp()
      });

      toast.success("Client details updated successfully");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update client details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-8 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24} /></button>
        <h3 className="text-xl font-bold font-serif mb-6">Edit Client Details</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Full Name *</label>
              <input type="text" value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} className="w-full p-3 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Phone Number *</label>
              <input type="tel" value={formData.clientPhone} onChange={e => setFormData({...formData, clientPhone: e.target.value})} className="w-full p-3 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Email Address</label>
              <input type="email" value={formData.clientEmail} onChange={e => setFormData({...formData, clientEmail: e.target.value})} className="w-full p-3 border rounded-lg" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">NID / Passport Number</label>
              <input type="text" value={formData.clientNid} onChange={e => setFormData({...formData, clientNid: e.target.value})} className="w-full p-3 border rounded-lg" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Current Address</label>
              <textarea value={formData.clientAddress} onChange={e => setFormData({...formData, clientAddress: e.target.value})} rows="2" className="w-full p-3 border rounded-lg"></textarea>
            </div>
          </div>
          
          <div className="pt-4 mt-4 border-t border-gray-100 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-6 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-brand-primary text-white font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-brand-dark transition-colors disabled:opacity-50">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Change Unit Modal Component
function ChangeUnitModal({ booking, adminName, adminUid, onClose }) {
  const [properties, setProperties] = useState([]);
  const [loadingProps, setLoadingProps] = useState(true);
  
  const [selectedPropertyId, setSelectedPropertyId] = useState(booking.propertyId);
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Fetch all active properties to allow selection
    const unsub = onSnapshot(collection(db, 'properties'), (snap) => {
      setProperties(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingProps(false);
    });
    return () => unsub();
  }, []);

  const currentProperty = properties.find(p => p.id === selectedPropertyId);
  // Only show available units
  const availableInventory = currentProperty ? (currentProperty.inventory || []).filter(inv => inv.status === 'Available') : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPropertyId || !selectedInventoryId) {
      return toast.error("Please select a property and a unit");
    }
    // Switch to confirmation view instead of submitting immediately
    setShowConfirm(true);
  };

  const executeReassignment = async () => {
    setSubmitting(true);
      try {
        await runTransaction(db, async (transaction) => {
          const oldPropRef = doc(db, 'properties', booking.propertyId);
          const newPropRef = doc(db, 'properties', selectedPropertyId);
          const bookingRef = doc(db, 'bookings', booking.id);

          // Read both property documents (must happen before any writes)
          const oldPropDoc = await transaction.get(oldPropRef);
          let newPropDoc;
          
          if (oldPropRef.id === newPropRef.id) {
            newPropDoc = oldPropDoc; // They are the same document
          } else {
            newPropDoc = await transaction.get(newPropRef);
          }

          if (!oldPropDoc.exists()) throw new Error("Old property document not found.");
          if (!newPropDoc.exists()) throw new Error("New property document not found.");

          const oldData = oldPropDoc.data();
          const oldInv = oldData.inventory || [];
          
          let newData, newInv;
          if (oldPropRef.id === newPropRef.id) {
            newData = oldData; // Use exact same object reference
            newInv = oldInv;   // Use exact same array reference
          } else {
            newData = newPropDoc.data();
            newInv = newData.inventory || [];
          }

          const oldUnitIndex = oldInv.findIndex(u => u.id === booking.inventoryId);
          const newUnitIndex = newInv.findIndex(u => u.id === selectedInventoryId);

          if (newUnitIndex === -1) throw new Error("Selected new unit not found.");
          if (newInv[newUnitIndex].status !== 'Available') throw new Error("Selected unit is no longer available. Someone else may have just booked it.");

          // State updates
          if (oldUnitIndex !== -1) {
            oldInv[oldUnitIndex].status = 'Available'; // Release old
          }
          newInv[newUnitIndex].status = 'Booked'; // Lock new

          // Writes
          if (oldPropRef.id === newPropRef.id) {
            transaction.update(oldPropRef, { inventory: oldInv }); // Same reference
          } else {
            transaction.update(oldPropRef, { inventory: oldInv });
            transaction.update(newPropRef, { inventory: newInv });
          }

          // Format unit string
          const unitType = newInv[newUnitIndex].unitType || '';
          const unitNumber = `Floor ${newInv[newUnitIndex].floor || ''}, ${
            (unitType).toLowerCase().includes((newInv[newUnitIndex].unitName || '').toLowerCase()) 
            ? (newInv[newUnitIndex].unitName || '') 
            : `Unit ${newInv[newUnitIndex].unitName || ''}`
          }`;

          transaction.update(bookingRef, {
            propertyId: selectedPropertyId,
            propertyName: newData.name,
            propertyLocation: newData.location,
            inventoryId: selectedInventoryId,
            unitType: unitType,
            unitNumber: unitNumber,
            lastUpdatedAt: serverTimestamp(),
            lastUpdatedBy: adminUid
          });

          const logRef = doc(collection(db, `bookings/${booking.id}/activityLog`));
          transaction.set(logRef, {
            action: "Unit Reassigned",
            detail: `Moved from ${booking.propertyName} (${booking.unitType}) to ${newData.name} (${unitType})`,
            performedBy: adminName,
            performedAt: serverTimestamp()
          });
        });

        toast.success("Unit successfully changed!");
        onClose();
      } catch (err) {
        console.error(err);
        toast.error(`Failed to change unit: ${err.message || 'Unknown error'}`);
        setShowConfirm(false);
      } finally {
        setSubmitting(false);
      }
  };

  if (showConfirm) {
    const newProp = properties.find(p => p.id === selectedPropertyId);
    const newInv = newProp?.inventory?.find(i => i.id === selectedInventoryId);
    
    let newUnitStr = '';
    if (newInv) {
      newUnitStr = `Floor ${newInv.floor || ''}, ${
        (newInv.unitType || '').toLowerCase().includes((newInv.unitName || '').toLowerCase()) 
        ? (newInv.unitName || '') 
        : `Unit ${newInv.unitName || ''}`
      }`;
    }
    
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl relative border-t-8 border-amber-500">
          <h3 className="text-xl font-bold font-serif mb-2 text-amber-600 flex items-center gap-2">
            <ShieldCheck size={24} /> Confirm Reassignment
          </h3>
          <p className="text-gray-600 mb-6 text-sm">
            You are about to move this client's booking. This is a critical system action.
          </p>

          <div className="space-y-4 mb-8">
            <div className="bg-red-50 text-red-900 p-3 rounded-lg text-sm border border-red-100">
              <span className="font-bold block mb-1">Releasing:</span>
              {booking.propertyName} - {booking.unitType} {booking.unitNumber ? `(${booking.unitNumber})` : ''}
              <div className="text-red-700 text-xs mt-1">This unit will immediately become available for others to book.</div>
            </div>
            
            <div className="flex justify-center text-gray-400">
              <ArrowRight className="rotate-90" size={20} />
            </div>

            <div className="bg-green-50 text-green-900 p-3 rounded-lg text-sm border border-green-100">
              <span className="font-bold block mb-1">Locking:</span>
              {newProp?.name} - {newInv?.unitType} {newUnitStr ? `(${newUnitStr})` : ''}
              <div className="text-green-700 text-xs mt-1">This unit will be locked and assigned to this client.</div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setShowConfirm(false)} disabled={submitting} className="px-6 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg disabled:opacity-50">
              Cancel
            </button>
            <button onClick={executeReassignment} disabled={submitting} className="px-6 py-2 bg-amber-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-amber-600 transition-colors disabled:opacity-50 shadow-md">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Execute Change
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-8 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24} /></button>
        <h3 className="text-xl font-bold font-serif mb-6 flex items-center gap-2"><Building size={24} className="text-brand-primary" /> Reassign Unit</h3>
        
        {loadingProps ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin text-brand-primary" /></div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg mb-6">
              <p className="text-xs text-gray-500 font-bold uppercase mb-1">Current Assignment</p>
              <p className="font-bold text-gray-900">{booking.propertyName}</p>
              <p className="text-sm text-gray-600">{booking.unitType} {booking.unitNumber ? `- ${booking.unitNumber}` : ''}</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Select New Property</label>
              <select 
                value={selectedPropertyId} 
                onChange={(e) => { setSelectedPropertyId(e.target.value); setSelectedInventoryId(''); }}
                className="w-full p-3 border rounded-lg"
              >
                <option value="">-- Choose Property --</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Select Available Unit</label>
              <select 
                value={selectedInventoryId} 
                onChange={(e) => setSelectedInventoryId(e.target.value)}
                className="w-full p-3 border rounded-lg"
                disabled={!selectedPropertyId || availableInventory.length === 0}
              >
                <option value="">-- Choose Available Unit --</option>
                {availableInventory.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    Floor {inv.floor} - {inv.unitType} {inv.unitName ? `(${inv.unitName})` : ''} - ৳{Number(inv.price || 0).toLocaleString()}
                  </option>
                ))}
              </select>
              {selectedPropertyId && availableInventory.length === 0 && (
                <p className="text-xs text-red-500 mt-1 font-bold">No available units in this property.</p>
              )}
            </div>

            <div className="pt-6 mt-4 border-t border-gray-100 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-6 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">Cancel</button>
              <button type="submit" disabled={submitting || !selectedInventoryId} className="px-6 py-2 bg-brand-primary text-white font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-brand-dark transition-colors disabled:opacity-50">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Confirm Reassignment
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
