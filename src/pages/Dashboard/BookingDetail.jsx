import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { useParams, useNavigate } from 'react-router-dom';
import { useGlobalState } from '../../context/GlobalState';
import { ArrowLeft, CheckCircle, Clock, FileText, Loader2, Building, DollarSign } from 'lucide-react';

const STAGES = [
  'EOI', 'Token Paid', 'Agreement Signed', 'Down Payment Paid', 
  'Installments Running', 'Fully Paid', 'Handover', 'Completed'
];

export default function BookingDetail() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useGlobalState();
  const [booking, setBooking] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile?.uid) return;

    // 1. Fetch Booking and verify ownership
    const bSub = onSnapshot(doc(db, 'bookings', bookingId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.linkedUserId !== userProfile.uid) {
          navigate('/dashboard'); // unauthorized
          return;
        }
        setBooking({ id: docSnap.id, ...data });
      } else {
        navigate('/dashboard');
      }
      setLoading(false);
    });

    // 2. Fetch Payments Ledger
    const pSub = onSnapshot(query(collection(db, `bookings/${bookingId}/payments`), orderBy('scheduledDate', 'asc')), (snap) => {
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { bSub(); pSub(); };
  }, [bookingId, userProfile, navigate]);

  const formatMoney = (amount) => {
    if (amount === undefined || amount === null) return '৳0';
    return '৳ ' + Math.round(Number(amount)).toLocaleString('en-IN');
  };

  const formatDate = (ts) => {
    if (!ts) return 'N/A';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading || !booking) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <Loader2 className="animate-spin text-brand-primary" size={48} />
      </div>
    );
  }

  const completionPct = Math.min(100, Math.round(((booking.totalPaid || 0) / booking.totalPrice) * 100));

  // Find the next payment that needs to be paid (whether it's in the future or currently overdue)
  const upcomingPayment = payments.find(p => p.status === 'Scheduled');

  return (
    <div className="min-h-screen bg-gray-50 py-12 font-sans">
      <div className="container mx-auto px-4 max-w-5xl">
        
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-gray-500 hover:text-brand-primary font-bold mb-6 transition-colors">
          <ArrowLeft size={20} /> Back to Dashboard
        </button>

        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-serif font-bold text-gray-900 mb-2">Booking #{booking.bookingRef}</h1>
            <p className="text-gray-500 font-medium">{booking.propertyName} - {booking.unitType}</p>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-bold ${booking.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-800'}`}>
            {booking.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Main Content */}
          <div className="md:col-span-2 space-y-8">
            
            {/* Stage Stepper */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-8">Current Progress</h2>
              <div className="flex items-center justify-between">
                {STAGES.map((s, idx) => {
                  const isCompleted = STAGES.indexOf(booking.stage) >= idx;
                  const isCurrent = booking.stage === s;
                  
                  // For mobile, only show a few
                  const isMobileHidden = STAGES.length > 4 && idx % 2 !== 0 && !isCurrent;

                  return (
                    <div key={s} className={`flex-1 relative flex flex-col items-center ${isMobileHidden ? 'hidden md:flex' : 'flex'}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold z-10 ${isCompleted ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-400'} ${isCurrent ? 'ring-4 ring-brand-primary/20' : ''}`}>
                        {isCompleted ? <CheckCircle size={20} /> : idx + 1}
                      </div>
                      {idx < STAGES.length - 1 && (
                        <div className={`hidden md:block absolute top-5 left-1/2 w-full h-1.5 -translate-y-1/2 ${STAGES.indexOf(booking.stage) > idx ? 'bg-brand-primary' : 'bg-gray-100'}`} />
                      )}
                      <span className={`text-[11px] uppercase font-bold mt-3 text-center max-w-[80px] leading-tight ${isCurrent ? 'text-brand-primary' : 'text-gray-400'}`}>{s}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment History */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold flex items-center gap-2"><FileText size={24} className="text-brand-primary" /> Payment History</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                    <tr>
                      <th className="px-6 py-4">Installment</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payments.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-8 text-gray-500">No payment records found</td></tr>
                    ) : (
                      payments.map((p) => {
                        const isOverdue = p.status === 'Scheduled' && (p.scheduledDate.toDate ? p.scheduledDate.toDate() : new Date(p.scheduledDate)) < new Date();
                        let statusBadge = '';
                        if (p.status === 'Paid') statusBadge = 'bg-green-100 text-green-800';
                        else if (p.status === 'Partially Paid') statusBadge = 'bg-amber-100 text-amber-800';
                        else if (isOverdue) statusBadge = 'bg-red-100 text-red-800';
                        else statusBadge = 'bg-gray-100 text-gray-600';

                        return (
                          <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-bold text-gray-900">
                              {p.type} {p.installmentNumber ? `#${p.installmentNumber}` : ''}
                            </td>
                            <td className="px-6 py-4 text-gray-500">
                              {p.status === 'Paid' && p.paidDate ? formatDate(p.paidDate) : formatDate(p.scheduledDate)}
                            </td>
                            <td className="px-6 py-4 font-bold text-gray-900">
                              {formatMoney(p.scheduledAmount)}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusBadge}`}>
                                {isOverdue ? 'Overdue' : p.status}
                              </span>
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

          {/* Sidebar */}
          <div className="space-y-8">
            
            {/* Financial Card */}
            <div className="bg-brand-dark text-brand-neutral p-8 rounded-2xl shadow-xl relative overflow-hidden">
              <div className="absolute -right-8 -bottom-8 opacity-10">
                <DollarSign size={160} />
              </div>
              <h3 className="text-lg font-serif font-bold text-brand-accent mb-6">Financial Summary</h3>
              
              <div className="space-y-6">
                <div>
                  <p className="text-brand-neutral/60 text-xs font-bold uppercase mb-1">Total Agreed Price</p>
                  <p className="text-3xl font-bold">{formatMoney(booking.totalPrice)}</p>
                </div>
                
                <div className="pt-6 border-t border-brand-neutral/20 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-brand-neutral/60 text-xs font-bold uppercase mb-1">Total Paid</p>
                    <p className="text-xl font-bold text-green-400">{formatMoney(booking.totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-brand-neutral/60 text-xs font-bold uppercase mb-1">Balance Due</p>
                    <p className="text-xl font-bold">{formatMoney(booking.balanceDue)}</p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-brand-neutral/60">Payment Progress</span>
                    <span className="text-brand-accent">{completionPct}%</span>
                  </div>
                  <div className="w-full bg-black/40 rounded-full h-2">
                    <div className="bg-brand-accent h-2 rounded-full" style={{ width: `${completionPct}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Next Payment */}
            {upcomingPayment && (
              <div className="bg-gradient-to-br from-brand-primary/10 to-transparent p-8 rounded-2xl shadow-sm border border-brand-primary/20">
                <div className="flex items-center gap-3 mb-4 text-brand-primary">
                  <Clock size={24} />
                  <h3 className="font-bold text-lg">Next Payment Due</h3>
                </div>
                <p className="text-sm text-gray-600 mb-2 font-bold">{upcomingPayment.type} {upcomingPayment.installmentNumber ? `#${upcomingPayment.installmentNumber}` : ''}</p>
                <p className="text-3xl font-bold text-gray-900 mb-2">{formatMoney(upcomingPayment.scheduledAmount)}</p>
                <p className="text-gray-500 text-sm">Due by {formatDate(upcomingPayment.scheduledDate)}</p>
              </div>
            )}
            
            {!upcomingPayment && booking.balanceDue === 0 && (
              <div className="bg-green-50 p-8 rounded-2xl shadow-sm border border-green-200 text-center">
                <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                <h3 className="font-bold text-lg text-green-900 mb-2">Fully Paid</h3>
                <p className="text-green-700 text-sm">You have completed all payments for this booking.</p>
              </div>
            )}

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-2">Need assistance?</h3>
              <p className="text-sm text-gray-500 mb-4">Contact your dedicated relationship manager regarding this booking.</p>
              <a href="mailto:sales@viridiannexus.com" className="block text-center w-full py-3 border-2 border-brand-primary text-brand-primary font-bold rounded-lg hover:bg-brand-primary hover:text-white transition-colors">
                Contact Sales
              </a>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
