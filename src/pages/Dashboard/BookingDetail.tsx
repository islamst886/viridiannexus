import { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { useParams, useNavigate } from 'react-router-dom';
import { useGlobalState } from '../../context/GlobalState';
import { COMPANY_INFO } from '../../data/companyInfo';
import { STAGES } from '../../utils/bookingStageGates';
import { computeCancellationSettlement, isCancellationFeeRow, isRefundPaymentRow } from '../../utils/bookingCancellation';
import { mapBookingFromDB, mapPaymentFromDB } from '../../utils/mappers';
import {
  classifyPaymentDocumentCategory,
  type InvoiceCategory,
} from '../../utils/invoiceBuilder';
import {
  getClientAuthorizedBookingCategories,
  getClientTotalAuthorizedDocumentsCount,
  isPaymentInvoiceAuthorizedForClient,
  resolveDefaultClientDocumentSelection,
} from '../../utils/invoiceRelease';
import InvoicePreviewModal from '../../components/invoices/InvoicePreviewModal';
import type { Booking, BookingDBRow, BookingPayment, BookingPaymentDBRow } from '../../types';
import { AlertTriangle, ArrowLeft, CheckCircle, Clock, FileText, Loader2, DollarSign, Printer, ShieldCheck } from 'lucide-react';

export default function BookingDetail() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { userProfile } = useGlobalState();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [payments, setPayments] = useState<BookingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceModalState, setInvoiceModalState] = useState<{
    isOpen: boolean;
    category: InvoiceCategory;
    paymentId?: string;
  }>({ isOpen: false, category: 'booking-summary' });

  useEffect(() => {
    if (!userProfile?.uid || !bookingId) {
      navigate('/dashboard');
      return;
    }

    const fetchData = async (): Promise<void> => {
      // 1. Fetch Booking and verify ownership
      const { data: bookingData, error: bErr } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      if (bErr || !bookingData) {
        navigate('/dashboard');
        return;
      }

      const typedBookingRow = bookingData as BookingDBRow;
      if (typedBookingRow.linked_user_id !== userProfile.uid) {
        navigate('/dashboard'); // unauthorized
        return;
      }

      setBooking(mapBookingFromDB(typedBookingRow));

      // 2. Fetch Payments Ledger
      const { data: paymentsData, error: pErr } = await supabase
        .from('booking_payments')
        .select('*')
        .eq('booking_id', bookingId)
        .order('due_date', { ascending: true })
        .order('installment_number', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (pErr) console.error("Error fetching payments:", pErr);
      if (paymentsData) {
        setPayments((paymentsData as BookingPaymentDBRow[]).map((row) => mapPaymentFromDB(row)));
      }
      setLoading(false);
    };

    void fetchData();

    const sub = supabase
      .channel(`booking_${bookingId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` }, () => { void fetchData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_payments', filter: `booking_id=eq.${bookingId}` }, () => { void fetchData(); })
      .subscribe();

    return () => {
      void supabase.removeChannel(sub);
    };
  }, [bookingId, userProfile, navigate]);

  const formatMoney = (amount: number | string | null | undefined): string => {
    if (amount === undefined || amount === null) return '৳0';
    return '৳\u00A0' + Math.round(Number(amount)).toLocaleString('en-IN');
  };

  const formatDate = (ts: string | null | undefined): string => {
    if (!ts) return 'N/A';
    const date = new Date(ts);
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading || !booking) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <Loader2 className="animate-spin text-brand-primary" size={48} />
      </div>
    );
  }

  const isCancelled = booking.status === 'Cancelled';
  const settlement = computeCancellationSettlement(booking, payments);
  const completionPct = booking.totalPrice > 0
    ? Math.min(100, Math.round(((booking.totalPaid || 0) / booking.totalPrice) * 100))
    : 0;

  // Find the next payment that needs to be paid (suppressed on Cancelled or On Hold bookings)
  const upcomingPayment =
    isCancelled || booking.status === 'On Hold'
      ? undefined
      : payments.find((p) => p.status === 'Scheduled');
  const authorizedBookingCategories = getClientAuthorizedBookingCategories(booking, undefined, payments);
  const authorizedDocsCount = getClientTotalAuthorizedDocumentsCount(booking, payments);
  const defaultClientSelection = resolveDefaultClientDocumentSelection(booking, payments);
  const hasIssuedStatementOrReceipts =
    authorizedBookingCategories.includes('cancellation-settlement') ||
    authorizedBookingCategories.includes('account-statement') ||
    authorizedBookingCategories.includes('receipts-summary');
  const isUpcomingAuthorized = upcomingPayment
    ? isPaymentInvoiceAuthorizedForClient(booking, upcomingPayment)
    : false;

  return (
    <div className="min-h-screen bg-gray-50 py-12 font-sans">
      <div className="container mx-auto px-4 max-w-5xl">

        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-gray-500 hover:text-brand-primary font-bold mb-6 transition-colors">
          <ArrowLeft size={20} /> Back to Dashboard
        </button>

        <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-serif font-bold text-gray-900 mb-2">Booking #{booking.bookingRef}</h1>
            <p className="text-gray-500 font-medium">
              {booking.propertyName} - {booking.unitType}{' '}
              {booking.unitNumber && `| ${booking.unitNumber}${isCancelled ? ' (Released)' : ''}`}{' '}
              {booking.parkingIncluded
                ? ` | Parking: ${booking.parkingIncluded}${isCancelled ? ' (Released)' : ''}`
                : (booking.parkingRequested ?? 0) > 0 && ` | ${booking.parkingRequested} Parking Requested`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {authorizedDocsCount > 0 && defaultClientSelection && (
              <button
                type="button"
                onClick={() =>
                  setInvoiceModalState({
                    isOpen: true,
                    category: defaultClientSelection.category,
                    paymentId: defaultClientSelection.paymentId,
                  })
                }
                className="px-4 py-2 bg-brand-dark text-brand-accent hover:bg-brand-primary hover:text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
              >
                <ShieldCheck size={16} />
                Verified Invoices ({authorizedDocsCount})
              </button>
            )}
            <span
              className={`px-4 py-2 rounded-full text-sm font-bold ${
                booking.status === 'Active'
                  ? 'bg-green-100 text-green-800'
                  : booking.status === 'Cancelled'
                    ? 'bg-red-100 text-red-800'
                    : booking.status === 'On Hold'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-gray-200 text-gray-800'
              }`}
            >
              {booking.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* Main Content */}
          <div className="md:col-span-2 space-y-8">

            {/* Stage Stepper OR Cancellation & Settlement Notice */}
            {isCancelled ? (
              <div className="bg-red-50/90 p-7 rounded-2xl shadow-sm border border-red-200 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-red-100 text-red-600 rounded-full shrink-0">
                    <AlertTriangle size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-xl font-bold text-red-900">Booking Cancelled</h2>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white border border-red-200 text-red-800">
                        {settlement.settlementStatusLabel}
                      </span>
                    </div>
                    <p className="text-sm text-red-800 mt-1">
                      This booking has been formally cancelled and its unit &amp; parking allocation
                      have been released. Any remaining future installments have been voided.
                    </p>
                  </div>
                </div>

                {settlement.grossCollected > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/90 border border-red-100 rounded-xl p-4 text-xs">
                    <div>
                      <span className="text-gray-500 block">Total Collected</span>
                      <strong className="text-gray-900 text-sm">
                        {formatMoney(settlement.grossCollected)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Deduction / Fee</span>
                      <strong className="text-red-700 text-sm">
                        {formatMoney(settlement.cancellationFee)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Net Refundable</span>
                      <strong className="text-gray-900 text-sm">
                        {formatMoney(settlement.netRefundable)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Refund Remaining</span>
                      <strong className="text-cyan-800 text-sm">
                        {formatMoney(settlement.refundRemaining)}
                      </strong>
                    </div>
                  </div>
                )}

                {authorizedBookingCategories.includes('cancellation-settlement') && (
                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        setInvoiceModalState({
                          isOpen: true,
                          category: 'cancellation-settlement',
                        })
                      }
                      className="px-4 py-2 rounded-lg bg-white border border-red-200 text-red-800 hover:bg-red-100 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Printer size={14} /> View Cancellation &amp; Settlement Statement
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-8">Current Progress</h2>
                <div className="flex items-start justify-between">
                  {STAGES.map((s, idx) => {
                    const stageIndex = STAGES.indexOf(booking.stage as (typeof STAGES)[number]);
                    const isCompleted = stageIndex >= idx;
                    const isCurrent = booking.stage === s;

                    // For mobile, only show a few
                    const isMobileHidden = STAGES.length > 4 && idx % 2 !== 0 && !isCurrent;

                    return (
                      <div key={s} className={`flex-1 min-w-0 relative flex flex-col items-center ${isMobileHidden ? 'hidden md:flex' : 'flex'}`}>
                        <div className={`relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold z-10 ${isCompleted ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-400'} ${isCurrent ? 'ring-4 ring-brand-primary/20' : ''}`}>
                          {isCompleted ? <CheckCircle size={20} /> : idx + 1}
                        </div>
                        {idx < STAGES.length - 1 && (
                          <div className={`hidden md:block absolute top-5 left-1/2 w-full h-1.5 -translate-y-1/2 ${stageIndex > idx ? 'bg-brand-primary' : 'bg-gray-100'}`} />
                        )}
                        <span className={`text-[11px] uppercase font-bold mt-3 text-center max-w-[80px] leading-tight ${isCurrent ? 'text-brand-primary' : 'text-gray-400'}`}>{s}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Payment History */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold flex items-center gap-2"><FileText size={24} className="text-brand-primary" /> Payment History</h2>
                {hasIssuedStatementOrReceipts && (
                  <button
                    type="button"
                    onClick={() =>
                      setInvoiceModalState({
                        isOpen: true,
                        category:
                          isCancelled && authorizedBookingCategories.includes('cancellation-settlement')
                            ? 'cancellation-settlement'
                            : authorizedBookingCategories.includes('account-statement')
                              ? 'account-statement'
                              : 'receipts-summary',
                      })
                    }
                    className="text-xs font-bold text-brand-primary hover:text-brand-dark flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary/10 hover:bg-brand-primary/20 transition-colors"
                  >
                    <Printer size={14} />
                    {isCancelled && authorizedBookingCategories.includes('cancellation-settlement')
                      ? 'Cancellation Settlement'
                      : authorizedBookingCategories.includes('account-statement')
                        ? 'Verified Statement'
                        : 'Receipts Summary'}
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                    <tr>
                      <th className="px-6 py-4">Installment</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Document</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payments.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-8 text-gray-500">No payment records found</td></tr>
                    ) : (
                      payments.map((p) => {
                        const isRefundRow = isRefundPaymentRow(p);
                        const isFeeRow = isCancellationFeeRow(p);
                        const dueDateObj = p.scheduledDate ? new Date(p.scheduledDate) : null;
                        const isOverdue =
                          !isCancelled &&
                          !isRefundRow &&
                          !isFeeRow &&
                          p.status === 'Scheduled' &&
                          dueDateObj &&
                          !isNaN(dueDateObj.getTime()) &&
                          dueDateObj < new Date();
                        let statusBadge = '';
                        if (p.status === 'Paid' || p.status === 'Refunded')
                          statusBadge = 'bg-green-100 text-green-800';
                        else if (p.status === 'Partially Paid' || p.status === 'Partially Paid (Closed)')
                          statusBadge = 'bg-amber-100 text-amber-800';
                        else if (p.status === 'Partially Refunded')
                          statusBadge = 'bg-cyan-100 text-cyan-800';
                        else if (p.status === 'Refund Pending')
                          statusBadge = 'bg-amber-100 text-amber-800';
                        else if (p.status === 'Deducted')
                          statusBadge = 'bg-red-100 text-red-800';
                        else if (p.status === 'Voided')
                          statusBadge = 'bg-gray-100 text-gray-500 line-through';
                        else if (isOverdue) statusBadge = 'bg-red-100 text-red-800';
                        else statusBadge = 'bg-gray-100 text-gray-600';

                        const docMeta = classifyPaymentDocumentCategory(p);
                        const isDocAuthorized = isPaymentInvoiceAuthorizedForClient(booking, p);

                        return (
                          <tr
                            key={p.id}
                            className={
                              p.status === 'Voided'
                                ? 'bg-gray-50/70 opacity-70'
                                : 'hover:bg-gray-50 transition-colors'
                            }
                          >
                            <td className="px-6 py-4 font-bold text-gray-900">
                              {p.type} {p.installmentNumber ? `#${p.installmentNumber}` : ''}
                            </td>
                            <td className="px-6 py-4 text-gray-500">
                              {(p.status === 'Paid' || p.status === 'Refunded') && p.paidDate
                                ? formatDate(p.paidDate)
                                : formatDate(p.scheduledDate)}
                            </td>
                            <td className="px-6 py-4 font-bold text-gray-900">
                              {isRefundRow
                                ? formatMoney(Math.abs(p.scheduledAmount))
                                : formatMoney(p.scheduledAmount)}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusBadge}`}>
                                {isOverdue ? 'Overdue' : p.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {p.status === 'Voided' ? (
                                <span className="text-xs font-medium text-gray-400 italic">
                                  Voided
                                </span>
                              ) : isDocAuthorized ? (
                                <button
                                  type="button"
                                  onClick={() => setInvoiceModalState({
                                    isOpen: true,
                                    category: docMeta.category,
                                    paymentId: p.id,
                                  })}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-brand-dark hover:text-brand-accent hover:border-brand-dark transition-colors"
                                >
                                  <ShieldCheck size={13} /> {docMeta.actionLabel}
                                </button>
                              ) : (
                                <span className="text-xs font-medium text-gray-400">
                                  {isCancelled ? 'Not Applicable' : 'Not Yet Issued'}
                                </span>
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

          {/* Sidebar */}
          <div className="space-y-8">

            {/* Financial Card */}
            <div className="bg-brand-dark text-brand-neutral p-8 rounded-2xl shadow-xl relative overflow-hidden">
              <div className="absolute -right-8 -bottom-8 opacity-10">
                <DollarSign size={160} />
              </div>
              <h3 className="text-lg font-serif font-bold text-brand-accent mb-6">Financial Summary</h3>

              <div className="space-y-6 relative z-10">
                <div>
                  <p className="text-brand-neutral/60 text-xs font-bold uppercase mb-1">Total Agreed Price</p>
                  <p className="text-3xl font-bold">{formatMoney(booking.totalPrice)}</p>
                </div>

                <div className="pt-6 border-t border-brand-neutral/20 grid grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <p className="text-brand-neutral/60 text-xs font-bold uppercase mb-1">Total Paid</p>
                    <p className="text-lg font-bold text-green-400 tracking-tight">{formatMoney(booking.totalPaid)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-brand-neutral/60 text-xs font-bold uppercase mb-1">
                      {isCancelled && settlement.grossCollected > 0 ? 'Refund Remaining' : 'Balance Due'}
                    </p>
                    <p className="text-lg font-bold tracking-tight">
                      {isCancelled
                        ? formatMoney(settlement.grossCollected > 0 ? settlement.refundRemaining : 0)
                        : formatMoney(booking.balanceDue)}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-brand-neutral/60">
                      {isCancelled ? 'Settlement Status' : 'Payment Progress'}
                    </span>
                    <span className="text-brand-accent">
                      {isCancelled ? 'Cancelled' : `${completionPct}%`}
                    </span>
                  </div>
                  <div className="w-full bg-black/40 rounded-full h-2">
                    <div className="bg-brand-accent h-2 rounded-full" style={{ width: `${completionPct}%` }}></div>
                  </div>
                </div>

                {isCancelled && authorizedBookingCategories.includes('cancellation-settlement') ? (
                  <button
                    type="button"
                    onClick={() =>
                      setInvoiceModalState({ isOpen: true, category: 'cancellation-settlement' })
                    }
                    className="w-full py-2.5 bg-white/10 hover:bg-brand-accent hover:text-brand-dark text-brand-accent font-bold text-xs uppercase tracking-wider rounded-lg border border-brand-accent/30 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Printer size={14} /> Download Cancellation Settlement
                  </button>
                ) : authorizedBookingCategories.includes('account-statement') ? (
                  <button
                    type="button"
                    onClick={() => setInvoiceModalState({ isOpen: true, category: 'account-statement' })}
                    className="w-full py-2.5 bg-white/10 hover:bg-brand-accent hover:text-brand-dark text-brand-accent font-bold text-xs uppercase tracking-wider rounded-lg border border-brand-accent/30 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Printer size={14} /> Download Account Statement
                  </button>
                ) : authorizedBookingCategories.includes('booking-summary') ? (
                  <button
                    type="button"
                    onClick={() => setInvoiceModalState({ isOpen: true, category: 'booking-summary' })}
                    className="w-full py-2.5 bg-white/10 hover:bg-brand-accent hover:text-brand-dark text-brand-accent font-bold text-xs uppercase tracking-wider rounded-lg border border-brand-accent/30 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Printer size={14} /> Download Allotment Invoice
                  </button>
                ) : (
                  <p className="text-[11px] text-brand-neutral/60 leading-relaxed border-t border-brand-neutral/15 pt-3">
                    Official statements and allotment invoices appear here once verified by Finance.
                  </p>
                )}
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
                <p className="text-gray-500 text-sm mb-4">Due by {formatDate(upcomingPayment.scheduledDate)}</p>
                {isUpcomingAuthorized ? (
                  <button
                    type="button"
                    onClick={() => setInvoiceModalState({
                      isOpen: true,
                      category: 'demand-invoice',
                      paymentId: upcomingPayment.id,
                    })}
                    className="w-full py-2.5 bg-brand-primary text-white font-bold text-xs rounded-lg hover:bg-brand-dark transition-colors flex items-center justify-center gap-2"
                  >
                    <ShieldCheck size={14} /> Download Official Invoice
                  </button>
                ) : (
                  <p className="text-xs font-medium text-gray-500 bg-white/70 border border-gray-200 rounded-lg px-3 py-2 text-center">
                    Official demand invoice pending issuance by Admin.
                  </p>
                )}
              </div>
            )}

            {!isCancelled &&
              !upcomingPayment &&
              booking.totalPrice > 0 &&
              booking.totalPaid >= booking.totalPrice && (
              <div className="bg-green-50 p-8 rounded-2xl shadow-sm border border-green-200 text-center">
                <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                <h3 className="font-bold text-lg text-green-900 mb-2">Fully Paid</h3>
                <p className="text-green-700 text-sm mb-4">You have completed all payments for this booking.</p>
                {authorizedDocsCount > 0 && defaultClientSelection && (
                  <button
                    type="button"
                    onClick={() =>
                      setInvoiceModalState({
                        isOpen: true,
                        category: authorizedBookingCategories.includes('receipts-summary')
                          ? 'receipts-summary'
                          : defaultClientSelection.category,
                        paymentId: defaultClientSelection.paymentId,
                      })
                    }
                    className="w-full py-2.5 bg-green-700 text-white font-bold text-xs rounded-lg hover:bg-green-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <ShieldCheck size={14} /> Download Verified Receipts
                  </button>
                )}
              </div>
            )}

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-2">Need assistance?</h3>
              <p className="text-sm text-gray-500 mb-4">Contact your dedicated relationship manager regarding this booking.</p>
              <a href={COMPANY_INFO.emailHref} className="block text-center w-full py-3 border-2 border-brand-primary text-brand-primary font-bold rounded-lg hover:bg-brand-primary hover:text-white transition-colors">
                Contact Sales
              </a>
            </div>

          </div>
        </div>

      </div>

      <InvoicePreviewModal
        isOpen={invoiceModalState.isOpen}
        onClose={() => setInvoiceModalState((prev) => ({ ...prev, isOpen: false }))}
        booking={booking}
        payments={payments}
        initialCategory={invoiceModalState.category}
        initialPaymentId={invoiceModalState.paymentId}
        audience="client"
      />
    </div>
  );
}
