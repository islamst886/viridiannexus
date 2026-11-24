import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGlobalState } from '../../context/GlobalState';
import { supabase } from '../../supabase';
import { mapBookingFromDB, mapPaymentFromDB } from '../../utils/mappers';
import { normalizeExternalUrl } from '../../utils/urlHelpers';
import type { Booking, BookingDBRow, BookingPayment, BookingPaymentDBRow } from '../../types';
import { Building, Loader2, ChevronRight, CheckCircle, Clock, Edit3, MapPin, CreditCard, ShieldCheck } from 'lucide-react';
import EditProfileModal from './EditProfileModal';
import InvoicePreviewModal from '../../components/invoices/InvoicePreviewModal';
import type { InvoiceCategory } from '../../utils/invoiceBuilder';
import { fetchBookingInvoiceData } from '../../utils/invoiceExport';
import {
  getClientTotalAuthorizedDocumentsCount,
  resolveDefaultClientDocumentSelection,
} from '../../utils/invoiceRelease';
import { toast } from 'react-toastify';

export default function Overview() {
  const { userProfile, authUser } = useGlobalState();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [paymentsByBooking, setPaymentsByBooking] = useState<Record<string, BookingPayment[]>>({});
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [invoiceBundle, setInvoiceBundle] = useState<{
    booking: Booking;
    payments: BookingPayment[];
    initialCategory: InvoiceCategory;
    initialPaymentId?: string;
  } | null>(null);
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleOpenInvoices = async (bookingId: string): Promise<void> => {
    if (!userProfile?.uid) return;
    setLoadingInvoiceId(bookingId);
    try {
      const bundle = await fetchBookingInvoiceData(bookingId, userProfile.uid);
      if (!bundle) {
        toast.error('Unable to load invoice records for this booking.');
        return;
      }
      const defaultSelection = resolveDefaultClientDocumentSelection(bundle.booking, bundle.payments);
      if (!defaultSelection) {
        toast.info('No verified invoices have been issued for this booking yet.');
        return;
      }
      setInvoiceBundle({
        ...bundle,
        initialCategory: defaultSelection.category,
        initialPaymentId: defaultSelection.paymentId,
      });
    } catch (err) {
      console.error('Failed to load booking invoices:', err);
      toast.error('Failed to load invoices.');
    } finally {
      setLoadingInvoiceId(null);
    }
  };

  useEffect(() => {
    if (!userProfile?.uid) {
      setLoading(false);
      return;
    }

    const fetchBookings = async (): Promise<void> => {
      const { data } = await supabase
        .from('bookings')
        .select('*')
        .eq('linked_user_id', userProfile.uid)
        .order('created_at', { ascending: false });
      const mappedBookings = ((data || []) as BookingDBRow[]).map((row) => mapBookingFromDB(row));
      setBookings(mappedBookings);

      const bookingIds = mappedBookings.map((b) => b.id).filter(Boolean);
      if (bookingIds.length > 0) {
        const { data: pRows } = await supabase
          .from('booking_payments')
          .select('*')
          .in('booking_id', bookingIds);
        const grouped: Record<string, BookingPayment[]> = {};
        for (const pRow of (pRows || []) as BookingPaymentDBRow[]) {
          const mapped = mapPaymentFromDB(pRow);
          if (!grouped[mapped.bookingId]) grouped[mapped.bookingId] = [];
          grouped[mapped.bookingId].push(mapped);
        }
        setPaymentsByBooking(grouped);
      } else {
        setPaymentsByBooking({});
      }

      setLoading(false);
    };
    void fetchBookings();

    const sub = supabase
      .channel(`user_bookings:${userProfile.uid}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'bookings',
        filter: `linked_user_id=eq.${userProfile.uid}`
      }, () => { void fetchBookings(); })
      .subscribe();

    return () => {
      void supabase.removeChannel(sub);
    };
  }, [userProfile?.uid]);

  const formatMoney = (amount: number | string | null | undefined): string => {
    if (amount === undefined || amount === null) return '৳0';
    return '৳ ' + Math.round(Number(amount)).toLocaleString('en-IN');
  };

  const memberSince = userProfile?.createdAt
    ? new Date(userProfile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  const safeAvatarUrl = normalizeExternalUrl(userProfile?.avatar);
  const authEmail = authUser?.email || '';
  const authInitial = userProfile?.displayName?.charAt(0) || authEmail.charAt(0) || 'U';
  const isVerified = Boolean(authUser?.email_confirmed_at);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold font-serif text-gray-900 mb-8">Dashboard Overview</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User Profile Card */}
          <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-7 border border-gray-200 flex flex-col justify-between col-span-1 lg:col-span-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="relative shrink-0">
                {safeAvatarUrl ? (
                  <img
                    src={safeAvatarUrl}
                    alt={userProfile?.displayName || 'User'}
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-brand-accent/60 shadow-sm bg-brand-primary/10"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-brand-primary/10 text-brand-primary border-2 border-brand-primary/20 flex items-center justify-center text-3xl font-bold uppercase shadow-sm">
                    {authInitial}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold text-gray-900 truncate">
                    {userProfile?.displayName || 'User'}
                  </h2>
                  {isVerified && (
                    <span className="flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      <ShieldCheck size={12} /> Verified
                    </span>
                  )}
                </div>

                <p className="text-gray-500 text-sm mt-0.5">{userProfile?.email || authEmail}</p>
                {userProfile?.phone && (
                  <p className="text-gray-600 text-sm font-medium mt-1">
                    📞 {userProfile.phone}
                  </p>
                )}

                {/* Additional Profile Info Snippets */}
                <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                  {userProfile?.nid ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 font-medium rounded-lg border border-gray-200">
                      <CreditCard size={13} className="text-brand-primary" />
                      {userProfile.nidType || 'NID'}: {userProfile.nid}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 font-medium rounded-lg border border-amber-200/60">
                      <CreditCard size={13} /> Add NID / Passport
                    </span>
                  )}

                  {userProfile?.address && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 font-medium rounded-lg border border-gray-200 max-w-xs truncate">
                      <MapPin size={13} className="text-brand-primary shrink-0" />
                      <span className="truncate">{userProfile.address}</span>
                    </span>
                  )}

                  {memberSince && (
                    <span className="text-gray-400 font-medium ml-1">
                      Member since {memberSince}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">
                Client ID: <span className="font-mono text-gray-600">{userProfile?.uid?.slice(0, 8).toUpperCase() || 'N/A'}</span>
              </span>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="px-5 py-2 bg-brand-primary text-white text-sm font-bold rounded-xl hover:bg-brand-dark transition-all flex items-center gap-2 shadow-sm hover:shadow"
              >
                <Edit3 size={15} /> Edit Profile
              </button>
            </div>
          </div>

          {/* Referral Card */}
          <div className="bg-brand-dark rounded-2xl shadow-sm p-6 sm:p-7 border border-brand-dark text-white relative overflow-hidden flex flex-col justify-between opacity-90">
            <div className="absolute -right-4 -top-4 opacity-10 pointer-events-none">
              <CheckCircle size={140} />
            </div>
            <div>
              <div className="flex justify-between items-start mb-2 relative z-10">
                <h3 className="text-lg font-bold font-serif text-brand-accent">Refer & Earn</h3>
                <span className="bg-white/10 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider border border-white/20 flex items-center gap-1">
                  <Clock size={10} /> Coming Soon
                </span>
              </div>
              <p className="text-sm text-gray-300 mb-4 relative z-10">Invite friends and earn up to ৳100,000 on their first successful booking.</p>
            </div>
            <div className="bg-black/20 backdrop-blur-sm p-3.5 rounded-xl flex justify-center items-center border border-white/10 relative z-10">
              <span className="text-sm font-medium text-gray-400 flex items-center gap-2">
                Feature in development
              </span>
            </div>
          </div>
        </div>

        {/* Edit Profile Modal */}
        <EditProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          userProfile={userProfile}
        />

        {/* My Bookings Section */}
        <div className="mt-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold font-serif text-gray-900">My Bookings</h2>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 flex justify-center">
              <Loader2 className="animate-spin text-brand-primary" size={32} />
            </div>
          ) : bookings.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">No active bookings</h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">You haven't purchased or booked any properties yet. Explore our projects to start your real estate journey.</p>
              <Link to="/projects" className="inline-block bg-brand-primary text-white px-6 py-3 rounded-lg font-bold hover:bg-brand-dark transition-colors">
                Explore Projects
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bookings.map((booking) => {
                const completionPct = booking.totalPrice > 0
                  ? Math.min(100, Math.round(((booking.totalPaid || 0) / booking.totalPrice) * 100))
                  : 0;

                return (
                  <div key={booking.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group cursor-pointer" onClick={() => navigate(`/dashboard/booking/${booking.id}`)}>
                    <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                      <div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            booking.status === 'Active'
                              ? 'bg-green-100 text-green-800'
                              : booking.status === 'Cancelled'
                                ? 'bg-red-100 text-red-800'
                                : booking.status === 'On Hold'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {booking.status}
                        </span>
                        <h3 className="text-lg font-bold text-gray-900 mt-3">{booking.propertyName}</h3>
                        <p className="text-sm text-gray-500">
                          {booking.unitType}
                          {booking.unitNumber
                            ? ` - ${booking.unitNumber}${booking.status === 'Cancelled' ? ' (Released)' : ''}`
                            : ''}
                          {booking.parkingIncluded
                            ? ` | 🚗 Parking: ${booking.parkingIncluded}${booking.status === 'Cancelled' ? ' (Released)' : ''}`
                            : ''}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-brand-primary/10 group-hover:text-brand-primary transition-colors">
                        <ChevronRight size={20} />
                      </div>
                    </div>

                    <div className="p-6 bg-gray-50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-gray-500 uppercase">Stage</span>
                        <span className="text-sm font-bold text-brand-dark">{booking.stage}</span>
                      </div>

                      <div className="mt-4">
                        <div className="flex justify-between text-xs font-bold mb-1.5">
                          <span className="text-gray-500">Paid: {formatMoney(booking.totalPaid)}</span>
                          <span className="text-brand-primary">{completionPct}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className="bg-brand-primary h-1.5 rounded-full" style={{ width: `${completionPct}%` }}></div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-200/80 flex justify-end">
                        {(() => {
                          const bookingPayments = paymentsByBooking[booking.id] ?? [];
                          const authorizedCount = getClientTotalAuthorizedDocumentsCount(
                            booking,
                            bookingPayments
                          );
                          if (authorizedCount === 0) {
                            return (
                              <span className="text-[11px] font-medium text-gray-400 py-1">
                                No issued invoices yet
                              </span>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleOpenInvoices(booking.id);
                              }}
                              disabled={loadingInvoiceId === booking.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-brand-dark hover:text-brand-accent hover:border-brand-dark transition-colors shadow-sm disabled:opacity-50"
                            >
                              {loadingInvoiceId === booking.id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <ShieldCheck size={13} />
                              )}
                              Verified Invoices ({authorizedCount})
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <InvoicePreviewModal
        isOpen={Boolean(invoiceBundle)}
        onClose={() => setInvoiceBundle(null)}
        booking={invoiceBundle?.booking ?? null}
        payments={invoiceBundle?.payments ?? []}
        initialCategory={invoiceBundle?.initialCategory}
        initialPaymentId={invoiceBundle?.initialPaymentId}
        audience="client"
      />
    </div>
  );
}
