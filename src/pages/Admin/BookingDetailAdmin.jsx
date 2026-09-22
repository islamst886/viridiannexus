import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, collection, onSnapshot, updateDoc, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { useParams, useNavigate } from 'react-router-dom';
import AdminSidebar from '../../components/AdminSidebar';
import { useGlobalState } from '../../context/GlobalState';
import { 
  ArrowLeft, CheckCircle, Clock, AlertCircle, FileText, 
  DollarSign, Loader2, Save, User as UserIcon, Building, ShieldCheck, X
} from 'lucide-react';
import { toast } from 'react-toastify';

const STAGES = [
  'EOI', 'Token Paid', 'Agreement Signed', 'Down Payment Paid', 
  'Installments Running', 'Fully Paid', 'Handover', 'Completed'
];

export default function AdminBookingDetail() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useGlobalState();
  const adminUid = userProfile?.uid;
  const adminName = userProfile?.displayName || 'Admin';

  const [booking, setBooking] = useState(null);
  const [payments, setPayments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isChangingStage, setIsChangingStage] = useState(false);
  const [newStage, setNewStage] = useState('');

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);

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

  const handleStageChange = async () => {
    if (!newStage) return;
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        stage: newStage,
        lastUpdatedAt: serverTimestamp(),
        lastUpdatedBy: adminUid
      });
      await addDoc(collection(db, `bookings/${bookingId}/activityLog`), {
        action: "Stage Changed",
        detail: `Stage advanced to ${newStage}`,
        performedBy: adminName,
        performedAt: serverTimestamp()
      });
      toast.success("Stage updated successfully");
      setIsChangingStage(false);
    } catch (error) {
      toast.error("Failed to update stage");
    }
  };

  const formatMoney = (amount) => {
    if (amount === undefined || amount === null) return '৳0';
    return '৳ ' + amount.toLocaleString('en-IN');
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
            <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">
              Put on Hold
            </button>
            <button className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors">
              Cancel Booking
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-8 flex flex-col gap-6">
          
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* Left Column - Client & Property */}
            <div className="xl:col-span-1 space-y-6">
              
              {/* Client Info */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <UserIcon size={20} className="text-brand-primary" />
                  <h2 className="text-lg font-bold">Client Details</h2>
                  {booking.linkedUserId && (
                    <span className="ml-auto flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded">
                      <ShieldCheck size={14} /> Linked
                    </span>
                  )}
                </div>
                <div className="space-y-3 text-sm">
                  <div><span className="text-gray-500 block text-xs font-bold uppercase">Name</span> <span className="font-medium text-gray-900">{booking.clientName}</span></div>
                  <div><span className="text-gray-500 block text-xs font-bold uppercase">Phone</span> <span className="font-medium text-gray-900">{booking.clientPhone}</span></div>
                  <div><span className="text-gray-500 block text-xs font-bold uppercase">Email</span> <span className="font-medium text-gray-900">{booking.clientEmail}</span></div>
                  <div><span className="text-gray-500 block text-xs font-bold uppercase">NID / Passport</span> <span className="font-medium text-gray-900">{booking.clientNid || 'Not provided'}</span></div>
                </div>
              </div>

              {/* Property Info */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Building size={20} className="text-brand-primary" />
                  <h2 className="text-lg font-bold">Property Details</h2>
                </div>
                <div className="space-y-3 text-sm">
                  <div><span className="text-gray-500 block text-xs font-bold uppercase">Project</span> <span className="font-medium text-brand-dark text-lg">{booking.propertyName}</span></div>
                  <div><span className="text-gray-500 block text-xs font-bold uppercase">Location</span> <span className="font-medium text-gray-900">{booking.propertyLocation}</span></div>
                  <div><span className="text-gray-500 block text-xs font-bold uppercase">Unit Type</span> <span className="font-medium text-gray-900">{booking.unitType}</span></div>
                  <div><span className="text-gray-500 block text-xs font-bold uppercase">Unit Number</span> <span className="font-medium text-gray-900">{booking.unitNumber || 'TBD'}</span></div>
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
                  <h2 className="text-lg font-bold">Booking Stage</h2>
                  <button 
                    onClick={() => setIsChangingStage(!isChangingStage)}
                    className="text-sm font-bold text-brand-primary hover:underline"
                  >
                    Change Stage
                  </button>
                </div>
                
                {isChangingStage && (
                  <div className="flex items-center gap-4 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <select 
                      className="p-2 border rounded-lg focus:outline-none focus:border-brand-primary"
                      value={newStage}
                      onChange={(e) => setNewStage(e.target.value)}
                    >
                      <option value="">Select New Stage</option>
                      {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={handleStageChange} className="px-4 py-2 bg-brand-primary text-white rounded-lg font-bold text-sm">Save</button>
                    <button onClick={() => setIsChangingStage(false)} className="px-4 py-2 text-gray-500 font-bold text-sm hover:bg-gray-200 rounded-lg">Cancel</button>
                  </div>
                )}

                <div className="flex items-center">
                  {STAGES.map((s, idx) => {
                    const isCompleted = STAGES.indexOf(booking.stage) >= idx;
                    const isCurrent = booking.stage === s;
                    return (
                      <div key={s} className="flex-1 relative flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 ${isCompleted ? 'bg-brand-primary text-white' : 'bg-gray-200 text-gray-500'} ${isCurrent ? 'ring-4 ring-brand-primary/20' : ''}`}>
                          {isCompleted ? <CheckCircle size={16} /> : idx + 1}
                        </div>
                        {idx < STAGES.length - 1 && (
                          <div className={`absolute top-4 left-1/2 w-full h-1 -translate-y-1/2 ${STAGES.indexOf(booking.stage) > idx ? 'bg-brand-primary' : 'bg-gray-200'}`} />
                        )}
                        <span className={`text-[10px] font-bold mt-2 text-center max-w-[60px] leading-tight ${isCurrent ? 'text-brand-primary' : 'text-gray-500'}`}>{s}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payment Ledger */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                  <h2 className="text-lg font-bold flex items-center gap-2"><FileText size={20} /> Payment Ledger</h2>
                  <button className="text-sm font-bold text-brand-primary hover:underline">Add Custom Payment</button>
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
                                  <button 
                                    onClick={() => { setSelectedPayment(p); setIsPaymentModalOpen(true); }}
                                    className="text-brand-primary font-bold hover:underline"
                                  >
                                    Record
                                  </button>
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
        await updateDoc(bookingRef, {
          totalPaid: newTotalPaid,
          balanceDue: newBalance,
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
