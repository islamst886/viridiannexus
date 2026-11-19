import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../../supabase';
import { useParams, useNavigate } from 'react-router-dom';
import AdminSidebar from '../../components/AdminSidebar';
import { useGlobalState } from '../../context/GlobalState';
import type {
  Booking,
  BookingDBRow,
  BookingPayment,
  BookingPaymentDBRow,
  BookingActivity,
  BookingActivityDBRow,
  InventoryUnit,
  ParkingSpot,
  PropertyDBRow,
  PropertyUnitType,
  ProfileDBRow,
} from '../../types';
import {
  ArrowLeft, ArrowRight, CheckCircle, Clock, AlertCircle, FileText,
  DollarSign, Loader2, Save, User as UserIcon, Building, ShieldCheck,
  X, RefreshCw, AlertTriangle, Printer, Car, PauseCircle, PlayCircle, MinusCircle, XCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import { mapBookingFromDB, mapPaymentFromDB, mapActivityFromDB } from '../../utils/mappers';
import { STAGES } from '../../utils/bookingStageGates';
import {
  classifyPaymentDocumentCategory,
  type InvoiceCategory,
} from '../../utils/invoiceBuilder';
import {
  BOOKING_INVOICE_DOC_LABELS,
  getDocumentVerificationInfo,
  isBookingDocAuthorizedForClient,
  isPaymentInvoiceAuthorizedForClient,
  mergeInvoiceReleaseManifestIntoNotes,
  parseInvoiceReleaseManifest,
  persistBookingInvoiceRelease,
  withPaymentDocRelease,
  type BookingInvoiceDocumentKey,
  type ReleaseToggleTarget,
} from '../../utils/invoiceRelease';
import InvoicePreviewModal from '../../components/invoices/InvoicePreviewModal';
import StageAdvanceModal from './StageAdvanceModal';
import {
  computePropertyAllocationSnapshot,
  detectConcurrentAllocationConflict,
  fetchFreshPropertyAndActiveBookings,
  formatBookingUnitNumber,
  reconcilePropertyInventoryWithBookings,
  validateUnitAssignment,
  type ActiveBookingAllocationRow,
} from '../../utils/bookingAllocation';
import CancelBookingModal from './CancelBookingModal';
import ReleaseParkingModal from './ReleaseParkingModal';
import AddParkingModal from './AddParkingModal';
import ChangeParkingModal from './ChangeParkingModal';

interface LinkedUserDetails {
  id: string;
  displayName: string;
  phone: string;
  email: string;
  nidType: string;
  nid: string;
  address: string;
}

interface ProfileDifference {
  field: string;
  current: string;
  updated: string;
}

interface PaymentModalProps {
  payment: BookingPayment;
  bookingId: string;
  adminName: string;
  adminUid: string;
  onSuccess?: () => void;
  onClose: () => void;
}

interface CustomPaymentModalProps {
  bookingId: string;
  adminName: string;
  adminUid: string;
  onSuccess?: () => void;
  onClose: () => void;
}

interface EditClientModalProps {
  booking: Booking;
  adminName: string;
  adminUid: string;
  onSuccess?: () => void;
  onClose: () => void;
}

interface ChangeUnitModalProps {
  booking: Booking;
  adminName: string;
  adminUid: string;
  onSuccess?: () => void;
  onClose: () => void;
}

interface ReassignPropertyOption {
  id: string;
  name: string;
  location: string;
  inventory: InventoryUnit[];
  availableUnits: PropertyUnitType[];
  parkingPrice: number | string;
  parkingInventory: ParkingSpot[];
}

export default function AdminBookingDetail() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { userProfile, isSuperAdmin } = useGlobalState();
  const adminUid = userProfile?.uid || '';
  const adminName = userProfile?.displayName || 'Admin';

  const [booking, setBooking] = useState<Booking | null>(null);
  const [payments, setPayments] = useState<BookingPayment[]>([]);
  const [activity, setActivity] = useState<BookingActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [targetStageCandidate, setTargetStageCandidate] = useState<string | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<BookingPayment | null>(null);

  const [isCustomPaymentModalOpen, setIsCustomPaymentModalOpen] = useState(false);

  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);

  const [isChangeUnitModalOpen, setIsChangeUnitModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isReleaseParkingModalOpen, setIsReleaseParkingModalOpen] = useState(false);
  const [isAddParkingModalOpen, setIsAddParkingModalOpen] = useState(false);
  const [isChangeParkingModalOpen, setIsChangeParkingModalOpen] = useState(false);
  const [invoiceModalState, setInvoiceModalState] = useState<{
    isOpen: boolean;
    category: InvoiceCategory;
    paymentId?: string;
  }>({ isOpen: false, category: 'booking-summary' });

  const [linkedUser, setLinkedUser] = useState<LinkedUserDetails | null>(null);
  const [syncingProfile, setSyncingProfile] = useState(false);
  const [releasingDocKey, setReleasingDocKey] = useState<string | null>(null);

  const linkedId = booking?.linkedUserId || booking?.linked_user_id;

  useEffect(() => {
    if (!linkedId) {
      setLinkedUser(null);
      return;
    }

    const fetchUser = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', linkedId).single();
      if (data) {
        const profileRow = data as ProfileDBRow;
        setLinkedUser({
          id: profileRow.id,
          displayName: profileRow.display_name ?? '',
          phone: profileRow.phone ?? '',
          email: profileRow.email ?? '',
          nidType: profileRow.nid_type ?? 'NID',
          nid: profileRow.nid ?? '',
          address: profileRow.address ?? '',
        });
      }
    };
    void fetchUser();
  }, [linkedId]);

  const profileDifferences = useMemo<ProfileDifference[]>(() => {
    if (!booking || !linkedUser) return [];
    const diffs: ProfileDifference[] = [];

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
        updated: linkedUser.nid,
      });
    }
    if (linkedUser.address && booking.clientAddress !== linkedUser.address) {
      diffs.push({
        field: 'Address',
        current: booking.clientAddress || 'Not set',
        updated: linkedUser.address,
      });
    }

    return diffs;
  }, [booking, linkedUser]);

  const fetchBooking = useCallback(async () => {
    if (!bookingId) return;
    const { data, error } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
    if (error || !data) {
      toast.error('Booking not found');
      void navigate('/admin/bookings');
      return;
    }
    setBooking(mapBookingFromDB(data as BookingDBRow));
    setLoading(false);
  }, [bookingId, navigate]);

  const fetchPayments = useCallback(async () => {
    if (!bookingId) return;
    const { data, error } = await supabase
      .from('booking_payments')
      .select('*')
      .eq('booking_id', bookingId)
      .order('due_date', { ascending: true })
      .order('installment_number', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching payments:', error);
    }
    if (data) {
      setPayments((data as BookingPaymentDBRow[]).map((row) => mapPaymentFromDB(row)));
    }
  }, [bookingId]);

  const fetchActivity = useCallback(async () => {
    if (!bookingId) return;
    const { data, error } = await supabase
      .from('booking_activity_log')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching activity log:', error);
    }
    if (data) {
      setActivity((data as BookingActivityDBRow[]).map((row) => mapActivityFromDB(row)));
    }
  }, [bookingId]);

  const refreshAll = useCallback(() => {
    void fetchBooking();
    void fetchPayments();
    void fetchActivity();
  }, [fetchBooking, fetchPayments, fetchActivity]);

  useEffect(() => {
    if (!bookingId) return;
    refreshAll();

    const sub = supabase
      .channel(`booking_detail_${bookingId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` },
        () => {
          void fetchBooking();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'booking_payments', filter: `booking_id=eq.${bookingId}` },
        () => {
          void fetchPayments();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_activity_log',
          filter: `booking_id=eq.${bookingId}`,
        },
        () => {
          void fetchActivity();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(sub);
    };
  }, [bookingId, fetchBooking, fetchPayments, fetchActivity, refreshAll]);

  const handleSyncWithUserProfile = async () => {
    if (!linkedUser || !booking || !bookingId) return;
    setSyncingProfile(true);
    try {
      const updates = {
        client_name: linkedUser.displayName || booking.clientName,
        client_phone: linkedUser.phone || booking.clientPhone,
        client_email: linkedUser.email || booking.clientEmail,
        client_nid: linkedUser.nid || booking.clientNid || '',
        client_address: linkedUser.address || booking.clientAddress || '',
        last_updated_by: adminUid,
        updated_at: new Date().toISOString(),
      };

      const { error: bErr } = await supabase.from('bookings').update(updates).eq('id', bookingId);
      if (bErr) throw bErr;

      await supabase.from('booking_activity_log').insert({
        booking_id: bookingId,
        type: 'Client Details Synced',
        message: `Client details synchronized with linked user account (${linkedUser.email}) by ${adminName}`,
        actor_name: adminName,
        actor_id: adminUid,
      });

      toast.success('Client details synchronized with user profile!');
      refreshAll();
    } catch (err: unknown) {
      console.error(err);
      toast.error('Failed to sync client details.');
    } finally {
      setSyncingProfile(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!bookingId) return;
    if (booking?.status === 'Cancelled' && newStatus !== 'Cancelled') {
      toast.error(
        'Cancelled bookings cannot be reactivated because their unit and parking were released. Create a new booking instead.'
      );
      return;
    }
    const actionText =
      newStatus === 'On Hold' ? 'put this booking on hold' : 'resume this booking';

    if (!window.confirm(`Are you sure you want to ${actionText}?`)) return;

    try {
      const { error: bErr } = await supabase
        .from('bookings')
        .update({
          status: newStatus,
          last_updated_by: adminUid,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);
      if (bErr) throw bErr;

      await supabase.from('booking_activity_log').insert({
        booking_id: bookingId,
        type: 'Status Changed',
        message: `Booking status changed to ${newStatus} by ${adminName}`,
        actor_name: adminName,
        actor_id: adminUid,
      });
      toast.success(`Booking ${newStatus === 'On Hold' ? 'put on hold' : 'resumed'}`);
      refreshAll();
    } catch (error: unknown) {
      console.error(error);
      toast.error('Failed to update status');
    }
  };

  const handleToggleInvoiceRelease = async (
    target: ReleaseToggleTarget,
    nextStatus: 'issued' | 'withheld',
    actionKey: string
  ) => {
    if (!booking) return;
    setReleasingDocKey(actionKey);
    try {
      const updated = await persistBookingInvoiceRelease({
        booking,
        target,
        nextStatus,
        actorName: adminName,
        actorId: adminUid,
      });
      setBooking(updated);
      toast.success(
        nextStatus === 'issued'
          ? 'Verified & issued to Client Dashboard'
          : 'Withdrawn from Client Dashboard'
      );
      void fetchActivity();
    } catch (err) {
      console.error('Failed to update client invoice release:', err);
      toast.error('Failed to update client document visibility');
    } finally {
      setReleasingDocKey(null);
    }
  };

  const formatMoney = (amount: number | string | null | undefined) => {
    if (amount === undefined || amount === null) return '৳0';
    return '৳ ' + Math.round(Number(amount)).toLocaleString('en-IN');
  };

  const formatDate = (ts: string | null | undefined) => {
    if (!ts) return 'N/A';
    const date = new Date(ts);
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

  const completionPct =
    booking.totalPrice > 0
      ? Math.min(100, Math.round(((booking.totalPaid || 0) / booking.totalPrice) * 100))
      : 0;

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 lg:px-8 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 z-10 sticky top-0">
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => void navigate('/admin/bookings')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors shrink-0"
              aria-label="Back to Bookings"
            >
              <ArrowLeft size={22} className="text-gray-500" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl lg:text-2xl font-bold text-gray-900 font-serif whitespace-nowrap">
                  {booking.bookingRef}
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${
                    booking.status === 'Active'
                      ? 'bg-green-100 text-green-800'
                      : booking.status === 'On Hold'
                        ? 'bg-amber-100 text-amber-800'
                        : booking.status === 'Cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {booking.status}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 whitespace-nowrap mt-0.5">
                Created on {formatDate(booking.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-start xl:justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                setInvoiceModalState({ isOpen: true, category: 'booking-summary' })
              }
              className="h-9 px-3.5 bg-brand-dark text-brand-accent rounded-lg text-xs font-bold hover:bg-brand-primary hover:text-white transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm"
            >
              <Printer size={15} /> Invoices &amp; Statements
            </button>

            {booking.status !== 'Cancelled' ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    void handleStatusChange(booking.status === 'On Hold' ? 'Active' : 'On Hold')
                  }
                  className="h-9 px-3 border border-gray-300 bg-white text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  {booking.status === 'On Hold' ? (
                    <>
                      <PlayCircle size={14} className="text-emerald-600" />
                      Resume Booking
                    </>
                  ) : (
                    <>
                      <PauseCircle size={14} className="text-amber-600" />
                      Put on Hold
                    </>
                  )}
                </button>

                {booking.parkingIncluded ? (
                  <div
                    className="inline-flex items-center h-9 rounded-lg border border-gray-200 bg-white divide-x divide-gray-200 overflow-hidden shadow-xs"
                    role="group"
                    aria-label="Parking Actions"
                  >
                    <button
                      type="button"
                      onClick={() => setIsAddParkingModalOpen(true)}
                      title="Add Parking Spot"
                      aria-label="Add Parking"
                      className="h-full px-3 text-xs font-semibold text-brand-dark bg-brand-primary/5 hover:bg-brand-primary/15 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Car size={14} className="text-brand-primary" />
                      <span>Add Parking</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsChangeParkingModalOpen(true)}
                      title="Swap Parking Spot"
                      aria-label="Swap Parking"
                      className="h-full px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <RefreshCw size={13} />
                      <span>Swap</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsReleaseParkingModalOpen(true)}
                      title="Release Parking Spot"
                      aria-label="Release Parking"
                      className="h-full px-3 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <MinusCircle size={13} />
                      <span>Release</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddParkingModalOpen(true)}
                    className="h-9 px-3 bg-brand-primary/10 text-brand-dark border border-brand-primary/20 rounded-lg text-xs font-semibold hover:bg-brand-primary/20 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Car size={14} className="text-brand-primary" /> Add Parking
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(true)}
                  className="h-9 px-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <XCircle size={14} /> Cancel Booking
                </button>
              </>
            ) : (
              <span className="h-9 px-3.5 bg-red-100 text-red-800 rounded-lg text-xs font-bold border border-red-200 inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                <AlertTriangle size={14} /> Cancelled
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-8 flex flex-col gap-6">
          {booking.status === 'Cancelled' &&
            (() => {
              const cancelLog = activity.find(
                (a) => a.type === 'Booking Cancelled' || a.action === 'Booking Cancelled'
              );
              const cancelDate = cancelLog?.createdAt || cancelLog?.performedAt || booking.updatedAt;
              const cancelledBy = cancelLog?.actorName || cancelLog?.performedBy || 'an admin';
              const metaReason = cancelLog?.metadata?.reason;
              const cancellationNote =
                (typeof metaReason === 'string' && metaReason) ||
                cancelLog?.message ||
                cancelLog?.detail ||
                booking.internalNotes ||
                'No reason provided.';

              return (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm flex items-start gap-4">
                  <div className="bg-red-100 text-red-600 p-3 rounded-full shrink-0">
                    <AlertTriangle size={24} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-red-800 font-bold text-lg mb-1">Booking Cancelled</h2>
                    <p className="text-red-700 text-sm mb-3">
                      This booking was cancelled on{' '}
                      <span className="font-semibold">{formatDate(cancelDate)}</span> by{' '}
                      <span className="font-semibold">{cancelledBy}</span>.
                    </p>
                    <div className="bg-white/80 border border-red-100 rounded-lg p-4 text-sm text-gray-800 shadow-sm relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-red-300 before:rounded-l-lg">
                      <strong className="block text-xs text-red-800 uppercase font-bold mb-1 tracking-wider">
                        Cancellation Note
                      </strong>
                      <span className="italic">"{cancellationNote}"</span>
                    </div>
                  </div>
                </div>
              );
            })()}

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
                    <button
                      type="button"
                      onClick={() => setIsEditClientModalOpen(true)}
                      className="ml-auto text-xs font-bold text-brand-primary hover:underline"
                    >
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
                        type="button"
                        onClick={() => void handleSyncWithUserProfile()}
                        disabled={syncingProfile}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-colors shrink-0 shadow-sm"
                        title="Update this booking's client details to match their current profile"
                      >
                        {syncingProfile ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
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
                          <span className="text-gray-400 line-through truncate max-w-[85px]">
                            {d.current}
                          </span>
                          <span className="font-bold text-emerald-800 truncate max-w-[110px]">
                            → {d.updated}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-500 block text-xs font-bold uppercase">Name</span>{' '}
                    <span className="font-medium text-gray-900">{booking.clientName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs font-bold uppercase">Phone</span>{' '}
                    <span className="font-medium text-gray-900">{booking.clientPhone}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs font-bold uppercase">Email</span>{' '}
                    <span className="font-medium text-gray-900">{booking.clientEmail}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs font-bold uppercase">
                      {booking.clientNidType || 'NID / Passport'}
                    </span>{' '}
                    <span className="font-medium text-gray-900">
                      {booking.clientNid || 'Not provided'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs font-bold uppercase">
                      Current Address
                    </span>{' '}
                    <span className="font-medium text-gray-900">
                      {booking.clientAddress || 'Not provided'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Property Info */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Building size={20} className="text-brand-primary" />
                  <h2 className="text-lg font-bold">Property Details</h2>
                  {booking.status !== 'Cancelled' && (
                    <button
                      type="button"
                      onClick={() => setIsChangeUnitModalOpen(true)}
                      className="ml-auto text-xs font-bold text-brand-primary hover:underline"
                    >
                      Change Unit
                    </button>
                  )}
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-500 block text-xs font-bold uppercase">Project</span>{' '}
                    <span className="font-medium text-brand-dark text-lg">
                      {booking.propertyName}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs font-bold uppercase">
                      Location
                    </span>{' '}
                    <span className="font-medium text-gray-900">{booking.propertyLocation}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs font-bold uppercase">
                      Unit Type
                    </span>{' '}
                    <span className="font-medium text-gray-900">{booking.unitType}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs font-bold uppercase">
                      Unit Number
                    </span>{' '}
                    <span className="font-medium text-gray-900">{booking.unitNumber || 'TBD'}</span>
                  </div>
                  {booking.parkingIncluded && (
                    <div>
                      <span className="text-gray-500 block text-xs font-bold uppercase">
                        Parking Assigned
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 inline-flex items-center gap-1.5">
                          <Car size={15} className="text-brand-primary shrink-0" />
                          <span>{booking.parkingIncluded}</span>
                        </span>
                        {booking.status !== 'Cancelled' && (
                          <button
                            type="button"
                            onClick={() => setIsReleaseParkingModalOpen(true)}
                            className="text-xs font-bold text-amber-600 hover:text-amber-800 underline underline-offset-2 transition-colors"
                          >
                            Release
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Client Portal Document Releases (Admin / Super Admin Control) */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={19} className="text-brand-primary shrink-0" />
                      <h2 className="text-base font-bold text-gray-900">Client Portal Documents</h2>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Only verified &amp; issued items appear read-only in the User Dashboard.
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 mt-4">
                  {(
                    [
                      'booking-summary',
                      'account-statement',
                      'outstanding-bundle',
                      'receipts-summary',
                    ] as BookingInvoiceDocumentKey[]
                  ).map((docKey) => {
                    const isIssued = isBookingDocAuthorizedForClient(booking, docKey);
                    const info = getDocumentVerificationInfo(booking, docKey);
                    const busy = releasingDocKey === `doc:${docKey}`;
                    const canIssueDoc = !(booking.status === 'Cancelled' && docKey === 'outstanding-bundle');

                    return (
                      <div
                        key={docKey}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-gray-100 bg-gray-50/70"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-gray-900 truncate">
                            {BOOKING_INVOICE_DOC_LABELS[docKey]}
                          </div>
                          <div className="text-[11px] text-gray-500 truncate">
                            {isIssued
                              ? `Issued${info.issuedBy ? ` by ${info.issuedBy}` : ''}`
                              : 'Internal only (Hidden from Client)'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setInvoiceModalState({ isOpen: true, category: docKey })
                            }
                            className="px-2 py-1 text-[11px] font-bold text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                            title="Preview document"
                          >
                            Preview
                          </button>
                          {canIssueDoc && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void handleToggleInvoiceRelease(
                                  { kind: 'booking-doc', category: docKey },
                                  isIssued ? 'withheld' : 'issued',
                                  `doc:${docKey}`
                                )
                              }
                              className={`px-2.5 py-1 text-[11px] font-bold rounded border inline-flex items-center gap-1 transition-colors disabled:opacity-50 ${
                                isIssued
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200'
                                  : 'bg-brand-primary text-white border-brand-primary hover:bg-brand-dark'
                              }`}
                              title={
                                isIssued
                                  ? 'Issued to Client Dashboard — click to withdraw'
                                  : 'Verify & issue to Client Dashboard'
                              }
                            >
                              {busy && <Loader2 size={11} className="animate-spin" />}
                              {isIssued ? 'Issued' : 'Verify & Issue'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
                <h2 className="text-lg font-bold font-serif mb-6 text-brand-accent">
                  Financial Overview
                </h2>
                <div className="grid grid-cols-3 gap-6 mb-6">
                  <div>
                    <p className="text-brand-neutral/60 text-xs font-bold uppercase mb-1">
                      Total Agreed Price
                    </p>
                    <p className="text-2xl font-bold">{formatMoney(booking.totalPrice)}</p>
                  </div>
                  <div>
                    <p className="text-brand-neutral/60 text-xs font-bold uppercase mb-1">
                      Total Received
                    </p>
                    <p className="text-2xl font-bold text-green-400">
                      {formatMoney(booking.totalPaid)}
                    </p>
                  </div>
                  <div>
                    <p className="text-brand-neutral/60 text-xs font-bold uppercase mb-1">
                      Balance Due
                    </p>
                    <p
                      className={`text-2xl font-bold ${booking.balanceDue > 0 ? 'text-red-400' : 'text-brand-neutral'}`}
                    >
                      {formatMoney(booking.balanceDue)}
                    </p>
                  </div>
                </div>
                <div className="w-full bg-black/40 rounded-full h-2.5 mb-2">
                  <div
                    className="bg-brand-accent h-2.5 rounded-full"
                    style={{ width: `${completionPct}%` }}
                  ></div>
                </div>
                <p className="text-xs text-brand-neutral/60 text-right">
                  {completionPct}% Completed
                </p>
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
                      type="button"
                      onClick={() => {
                        setTargetStageCandidate(null);
                        setIsStageModalOpen(true);
                      }}
                      className="px-4 py-2 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      Advance Milestone
                    </button>
                  )}
                </div>

                <div className="flex items-start">
                  {STAGES.map((s, idx) => {
                    const stageIndex = (STAGES as readonly string[]).indexOf(booking.stage);
                    const isCompleted = stageIndex >= idx;
                    const isCurrent = booking.stage === s;
                    return (
                      <div
                        key={s}
                        className="flex-1 min-w-0 relative flex flex-col items-center cursor-pointer group"
                        onClick={() => {
                          if (booking.status !== 'Cancelled') {
                            setTargetStageCandidate(s);
                            setIsStageModalOpen(true);
                          }
                        }}
                        title={`Click to view milestone requirements for ${s}`}
                      >
                        <div
                          className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-transform group-hover:scale-110 shadow-sm ${isCompleted ? 'bg-brand-primary text-white' : 'bg-gray-200 text-gray-500'} ${isCurrent ? 'ring-4 ring-brand-primary/20' : ''}`}
                        >
                          {isCompleted ? <CheckCircle size={16} /> : idx + 1}
                        </div>
                        {idx < STAGES.length - 1 && (
                          <div
                            className={`absolute top-4 left-1/2 w-full h-1 -translate-y-1/2 ${stageIndex > idx ? 'bg-brand-primary' : 'bg-gray-200'}`}
                          />
                        )}
                        <span
                          className={`text-[10px] sm:text-[11px] font-bold mt-2.5 px-1 text-center max-w-[78px] leading-tight group-hover:text-brand-primary transition-colors ${isCurrent ? 'text-brand-primary' : 'text-gray-500'}`}
                        >
                          {s}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payment Ledger */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex flex-wrap justify-between items-center gap-3">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <FileText size={20} /> Payment Ledger
                  </h2>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setInvoiceModalState({ isOpen: true, category: 'account-statement' })
                      }
                      className="h-8 px-3 rounded-lg text-xs font-bold text-brand-dark bg-brand-primary/10 hover:bg-brand-primary/20 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                    >
                      <Printer size={14} /> Statement &amp; Receipts
                    </button>
                    {booking.status !== 'Cancelled' && (
                      <button
                        type="button"
                        onClick={() => setIsCustomPaymentModalOpen(true)}
                        className="h-8 px-3 rounded-lg text-xs font-bold border border-brand-primary/30 text-brand-primary hover:bg-brand-primary hover:text-white inline-flex items-center whitespace-nowrap transition-colors"
                      >
                        Add Custom Payment
                      </button>
                    )}
                  </div>
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
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-gray-500">
                            No payments scheduled
                          </td>
                        </tr>
                      ) : (
                        payments.map((p) => {
                          const isOverdue =
                            p.status === 'Scheduled' &&
                            p.scheduledDate != null &&
                            p.scheduledDate !== '' &&
                            new Date(p.scheduledDate) < new Date();

                          let statusBadge = '';
                          if (p.status === 'Paid') statusBadge = 'bg-green-100 text-green-800';
                          else if (p.status === 'Partially Paid')
                            statusBadge = 'bg-amber-100 text-amber-800';
                          else if (p.status === 'Waived') statusBadge = 'bg-gray-200 text-gray-800';
                          else if (isOverdue) statusBadge = 'bg-red-100 text-red-800';
                          else statusBadge = 'bg-blue-50 text-blue-800';

                          const docMeta = classifyPaymentDocumentCategory(p);
                          const isClientVisible = isPaymentInvoiceAuthorizedForClient(booking, p);
                          const rowBusy = releasingDocKey === `pay:${p.id}`;

                          return (
                            <tr key={p.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 font-semibold text-gray-900">
                                {p.type} {p.installmentNumber ? `#${p.installmentNumber}` : ''}
                              </td>
                              <td className="px-6 py-4 text-gray-500">
                                {formatDate(p.scheduledDate)}
                              </td>
                              <td className="px-6 py-4 font-bold text-gray-900">
                                {formatMoney(p.scheduledAmount)}
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-bold ${statusBadge}`}
                                >
                                  {isOverdue ? 'Overdue' : p.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-bold text-green-600">
                                {p.receivedAmount > 0 ? formatMoney(p.receivedAmount) : '—'}
                              </td>
                              <td className="px-6 py-4 text-gray-500">{p.paymentMode || '—'}</td>
                              <td className="px-6 py-4 text-right">
                                <div className="inline-flex items-center justify-end gap-2">
                                  {p.status !== 'Paid' &&
                                    p.status !== 'Waived' &&
                                    booking.status !== 'Cancelled' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedPayment(p);
                                          setIsPaymentModalOpen(true);
                                        }}
                                        className="text-brand-primary font-bold hover:underline"
                                      >
                                        Record
                                      </button>
                                    )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setInvoiceModalState({
                                        isOpen: true,
                                        category: docMeta.category,
                                        paymentId: p.id,
                                      })
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-700 hover:bg-brand-dark hover:text-brand-accent transition-colors"
                                    title="Preview, print, or download PDF"
                                  >
                                    <Printer size={12} />
                                    {docMeta.actionLabel}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={rowBusy}
                                    onClick={() =>
                                      void handleToggleInvoiceRelease(
                                        { kind: 'payment-doc', payment: p },
                                        isClientVisible ? 'withheld' : 'issued',
                                        `pay:${p.id}`
                                      )
                                    }
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold border transition-colors disabled:opacity-50 ${
                                      isClientVisible
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200'
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                                    }`}
                                    title={
                                      isClientVisible
                                        ? 'Visible in Client Dashboard — click to hide/withhold'
                                        : 'Verify & issue this invoice to Client Dashboard'
                                    }
                                  >
                                    {rowBusy ? (
                                      <Loader2 size={11} className="animate-spin" />
                                    ) : (
                                      <ShieldCheck size={11} />
                                    )}
                                    {isClientVisible ? 'Issued' : 'Issue'}
                                  </button>
                                </div>
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
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Clock size={20} /> Activity Log
            </h2>
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
              {activity.map((log) => (
                <div
                  key={log.id}
                  className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-brand-primary/10 text-brand-primary shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                    <CheckCircle size={16} />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-gray-50 p-4 rounded-lg border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-gray-900">{log.action}</span>
                      <span className="text-xs text-gray-500">{formatDate(log.performedAt)}</span>
                    </div>
                    <div className="text-sm text-gray-600">{log.detail}</div>
                    <div className="text-xs text-gray-400 mt-2 flex justify-end">
                      - by {log.performedBy}
                    </div>
                  </div>
                </div>
              ))}
              {activity.length === 0 && (
                <div className="text-center text-gray-500 py-4">No activity recorded yet</div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && selectedPayment && (
        <PaymentModal
          payment={selectedPayment}
          bookingId={booking.id}
          adminName={adminName}
          adminUid={adminUid}
          onSuccess={refreshAll}
          onClose={() => setIsPaymentModalOpen(false)}
        />
      )}

      {/* Custom Payment Modal */}
      {isCustomPaymentModalOpen && (
        <CustomPaymentModal
          bookingId={booking.id}
          adminName={adminName}
          adminUid={adminUid}
          onSuccess={refreshAll}
          onClose={() => setIsCustomPaymentModalOpen(false)}
        />
      )}

      {/* Edit Client Modal */}
      {isEditClientModalOpen && (
        <EditClientModal
          booking={booking}
          adminName={adminName}
          adminUid={adminUid}
          onSuccess={refreshAll}
          onClose={() => setIsEditClientModalOpen(false)}
        />
      )}

      {/* Change Unit Modal */}
      {isChangeUnitModalOpen && (
        <ChangeUnitModal
          booking={booking}
          adminName={adminName}
          adminUid={adminUid}
          onSuccess={refreshAll}
          onClose={() => setIsChangeUnitModalOpen(false)}
        />
      )}

      {/* Stage Advance Modal */}
      {isStageModalOpen && (
        <StageAdvanceModal
          isOpen={isStageModalOpen}
          onClose={() => setIsStageModalOpen(false)}
          onSuccess={refreshAll}
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
        onSuccess={() => {
          setIsCancelModalOpen(false);
          refreshAll();
        }}
      />

      <ReleaseParkingModal
        isOpen={isReleaseParkingModalOpen}
        onClose={() => setIsReleaseParkingModalOpen(false)}
        booking={booking}
        onComplete={() => {
          setIsReleaseParkingModalOpen(false);
          refreshAll();
        }}
      />

      <AddParkingModal
        isOpen={isAddParkingModalOpen}
        onClose={() => setIsAddParkingModalOpen(false)}
        booking={booking}
        onComplete={() => {
          setIsAddParkingModalOpen(false);
          refreshAll();
        }}
      />

      <ChangeParkingModal
        isOpen={isChangeParkingModalOpen}
        onClose={() => setIsChangeParkingModalOpen(false)}
        booking={booking}
        onComplete={() => {
          setIsChangeParkingModalOpen(false);
          refreshAll();
        }}
      />

      <InvoicePreviewModal
        isOpen={invoiceModalState.isOpen}
        onClose={() => setInvoiceModalState((prev) => ({ ...prev, isOpen: false }))}
        booking={booking}
        payments={payments}
        initialCategory={invoiceModalState.category}
        initialPaymentId={invoiceModalState.paymentId}
        audience="admin"
        actorName={adminName}
        actorId={adminUid}
        onBookingUpdated={(updated) => setBooking(updated)}
      />
    </div>
  );
}

// Payment Modal Component
function PaymentModal({
  payment,
  bookingId,
  adminName,
  adminUid,
  onSuccess,
  onClose,
}: PaymentModalProps) {
  const [amount, setAmount] = useState<string | number>(payment.scheduledAmount);
  const [mode, setMode] = useState('Bank Transfer');
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [issueReceiptToClient, setIssueReceiptToClient] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!amount || Number.isNaN(numAmount) || numAmount <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to record a payment of ৳${numAmount.toLocaleString('en-IN')} via ${mode}?\n\nThis will update the client's payment ledger and financial summary. Please ensure the amount is correct before confirming.`
      )
    ) {
      return;
    }

    setLoading(true);

    try {
      const isFull = numAmount >= payment.scheduledAmount;
      const paymentNotes = ref ? (note ? `Ref: ${ref} | ${note}` : `Ref: ${ref}`) : note || null;

      // Update Payment Doc
      const { error: pErr } = await supabase
        .from('booking_payments')
        .update({
          received_amount: numAmount,
          payment_mode: mode,
          notes: paymentNotes,
          status: isFull ? 'Paid' : 'Partially Paid',
          paid_date: new Date().toISOString().split('T')[0],
          recorded_by: adminUid,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id);
      if (pErr) throw pErr;

      // Update Booking Totals
      const { data: bookingDoc, error: bErr } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();
      if (!bErr && bookingDoc) {
        const bookingRow = bookingDoc as BookingDBRow;
        const prevReceived = Number(payment.receivedAmount || 0);
        const delta = Math.max(0, numAmount - prevReceived);
        const newTotalPaid = (Number(bookingRow.total_paid) || 0) + delta;
        const newBalance = Math.max(0, Number(bookingRow.total_price) - newTotalPaid);

        let nextStage = bookingRow.stage === 'Token Paid' ? 'EOI' : (bookingRow.stage ?? 'EOI');
        const stageList: readonly string[] = STAGES;

        if (isFull) {
          if (
            payment.type === 'Down Payment' &&
            stageList.indexOf(nextStage) < stageList.indexOf('Down Payment Paid')
          ) {
            nextStage = 'Down Payment Paid';
          } else if (
            payment.type.startsWith('Installment') &&
            stageList.indexOf(nextStage) < stageList.indexOf('Installments Running')
          ) {
            nextStage = 'Installments Running';
          }
        }

        if (newBalance === 0 && stageList.indexOf(nextStage) < stageList.indexOf('Fully Paid')) {
          nextStage = 'Fully Paid';
        }

        const nowIso = new Date().toISOString();
        const paidPaymentRecord: BookingPayment = {
          ...payment,
          receivedAmount: numAmount,
          paymentMode: mode,
          notes: paymentNotes || '',
          status: isFull ? 'Paid' : 'Partially Paid',
          paidDate: nowIso.split('T')[0],
        };
        const currentManifest = parseInvoiceReleaseManifest({ notes: bookingRow.notes ?? undefined });
        const nextManifest = withPaymentDocRelease(
          currentManifest,
          paidPaymentRecord,
          issueReceiptToClient ? 'issued' : 'withheld',
          { name: adminName, id: adminUid },
          nowIso
        );
        const nextBookingNotes = mergeInvoiceReleaseManifestIntoNotes(bookingRow.notes, nextManifest);

        await supabase
          .from('bookings')
          .update({
            total_paid: newTotalPaid,
            balance_due: newBalance,
            stage: nextStage,
            notes: nextBookingNotes,
            last_updated_by: adminUid,
            updated_at: nowIso,
          })
          .eq('id', bookingId);
      }

      // Log activity
      await supabase.from('booking_activity_log').insert({
        booking_id: bookingId,
        type: 'Payment Recorded',
        message: `${payment.type} payment of ৳${numAmount.toLocaleString('en-IN')} received via ${mode}${ref ? ` (Ref: ${ref})` : ''}`,
        actor_name: adminName,
        actor_id: adminUid,
      });

      toast.success('Payment recorded successfully');
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to record payment: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>
        <h3 className="text-xl font-bold font-serif mb-4">Record Payment</h3>
        <p className="text-sm text-gray-500 mb-6">
          Recording payment for {payment.type} (Due: ৳{payment.scheduledAmount.toLocaleString()})
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Amount Received (BDT) *
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-3 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Payment Mode *</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full p-3 border rounded-lg"
            >
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
              <option value="Mobile Banking">Mobile Banking (bKash/Nagad)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Reference Number
            </label>
            <input
              type="text"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="Txn ID or Cheque No."
              className="w-full p-3 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Internal Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-3 border rounded-lg"
            />
          </div>
          <label className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 cursor-pointer text-xs text-gray-700">
            <input
              type="checkbox"
              checked={issueReceiptToClient}
              onChange={(e) => setIssueReceiptToClient(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
            />
            <span>
              <strong className="text-emerald-900 block">Verify &amp; Issue Receipt to Client Portal</strong>
              Allow the client to view &amp; download this verified receipt immediately.
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-primary text-white font-bold rounded-lg mt-2 flex items-center justify-center gap-2 hover:bg-brand-dark transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Confirm Payment
          </button>
        </form>
      </div>
    </div>
  );
}

// Custom Payment Modal Component
function CustomPaymentModal({
  bookingId,
  adminName,
  adminUid,
  onSuccess,
  onClose,
}: CustomPaymentModalProps) {
  const [type, setType] = useState('Custom Installment');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!amount || Number.isNaN(numAmount) || numAmount <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }
    if (!dueDate) {
      toast.error('Due date is required');
      return;
    }
    setLoading(true);

    try {
      // Create new scheduled payment
      const { error: pInsertErr } = await supabase.from('booking_payments').insert({
        booking_id: bookingId,
        type,
        scheduled_amount: numAmount,
        due_date: new Date(dueDate).toISOString().split('T')[0],
        status: 'Scheduled',
        received_amount: 0,
        payment_mode: 'Cash',
        recorded_by: adminUid,
      });
      if (pInsertErr) throw pInsertErr;

      // Update Booking Total Price
      const { data: bookingDoc, error: bErr } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();
      if (!bErr && bookingDoc) {
        const bookingRow = bookingDoc as BookingDBRow;
        const newTotalPrice = (Number(bookingRow.total_price) || 0) + numAmount;
        const newBalance = Math.max(0, newTotalPrice - (Number(bookingRow.total_paid) || 0));

        await supabase
          .from('bookings')
          .update({
            total_price: newTotalPrice,
            balance_due: newBalance,
            last_updated_by: adminUid,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId);
      }

      // Log
      await supabase.from('booking_activity_log').insert({
        booking_id: bookingId,
        type: 'Custom Payment Added',
        message: `Added ${type} for ৳${numAmount.toLocaleString('en-IN')}`,
        actor_name: adminName,
        actor_id: adminUid,
      });

      toast.success('Custom payment scheduled successfully');
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to add custom payment: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>
        <h3 className="text-xl font-bold font-serif mb-4">Add Custom Payment</h3>
        <p className="text-sm text-gray-500 mb-6">
          Schedule a new payment (e.g., Penalty, Utilities, Custom Installment).
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Payment Type *</label>
            <input
              type="text"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full p-3 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Amount Due (BDT) *
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-3 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Due Date *</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full p-3 border rounded-lg"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-primary text-white font-bold rounded-lg mt-2 flex items-center justify-center gap-2 hover:bg-brand-dark transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Schedule Payment
          </button>
        </form>
      </div>
    </div>
  );
}

// Edit Client Modal Component
function EditClientModal({
  booking,
  adminName,
  adminUid,
  onSuccess,
  onClose,
}: EditClientModalProps) {
  const [formData, setFormData] = useState({
    clientName: booking.clientName || '',
    clientPhone: booking.clientPhone || '',
    clientEmail: booking.clientEmail || '',
    clientNid: booking.clientNid || '',
    clientAddress: booking.clientAddress || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error: bErr } = await supabase
        .from('bookings')
        .update({
          client_name: formData.clientName,
          client_phone: formData.clientPhone,
          client_email: formData.clientEmail,
          client_nid: formData.clientNid,
          client_address: formData.clientAddress,
          last_updated_by: adminUid,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);
      if (bErr) throw bErr;

      await supabase.from('booking_activity_log').insert({
        booking_id: booking.id,
        type: 'Client Details Updated',
        message: `Client information was updated by ${adminName}`,
        actor_name: adminName,
        actor_id: adminUid,
      });

      toast.success('Client details updated successfully');
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to update client details: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-8 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>
        <h3 className="text-xl font-bold font-serif mb-6">Edit Client Details</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Full Name *</label>
              <input
                type="text"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                className="w-full p-3 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Phone Number *</label>
              <input
                type="tel"
                value={formData.clientPhone}
                onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                className="w-full p-3 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                value={formData.clientEmail}
                onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                className="w-full p-3 border rounded-lg"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">
                NID / Passport Number
              </label>
              <input
                type="text"
                value={formData.clientNid}
                onChange={(e) => setFormData({ ...formData, clientNid: e.target.value })}
                className="w-full p-3 border rounded-lg"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Current Address
              </label>
              <textarea
                value={formData.clientAddress}
                onChange={(e) => setFormData({ ...formData, clientAddress: e.target.value })}
                rows={2}
                className="w-full p-3 border rounded-lg"
              ></textarea>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-brand-primary text-white font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-brand-dark transition-colors disabled:opacity-50"
            >
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
function ChangeUnitModal({
  booking,
  adminName,
  adminUid,
  onSuccess,
  onClose,
}: ChangeUnitModalProps) {
  const [properties, setProperties] = useState<ReassignPropertyOption[]>([]);
  const [activeBookings, setActiveBookings] = useState<ActiveBookingAllocationRow[]>([]);
  const [loadingProps, setLoadingProps] = useState(true);

  const [selectedPropertyId] = useState(booking.propertyId);
  const [selectedInventoryId, setSelectedInventoryId] = useState('');

  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchPropsAndLocks = async () => {
      try {
        const [{ data }, freshState] = await Promise.all([
          supabase.from('properties').select('*'),
          selectedPropertyId
            ? fetchFreshPropertyAndActiveBookings(selectedPropertyId)
            : Promise.resolve(null),
        ]);
        if (!active) return;
        if (data) {
          setProperties(
            (data as PropertyDBRow[]).map((d) => ({
              id: d.id,
              name: d.name,
              location: d.location,
              inventory: Array.isArray(d.inventory) ? d.inventory : [],
              availableUnits: Array.isArray(d.available_units) ? d.available_units : [],
              parkingPrice: d.parking_price ?? 0,
              parkingInventory: Array.isArray(d.parking_inventory) ? d.parking_inventory : [],
            }))
          );
        }
        if (freshState) {
          setActiveBookings(freshState.activeBookings);
        }
      } catch (err) {
        console.error('Failed to load unit availability:', err);
      } finally {
        if (active) setLoadingProps(false);
      }
    };
    void fetchPropsAndLocks();
    return () => {
      active = false;
    };
  }, [selectedPropertyId]);

  const currentProperty = properties.find((p) => p.id === selectedPropertyId);
  const allocationSnapshot = useMemo(() => {
    if (!currentProperty) return null;
    return computePropertyAllocationSnapshot(
      {
        id: currentProperty.id,
        inventory: currentProperty.inventory,
        parkingInventory: currentProperty.parkingInventory,
      },
      activeBookings
    );
  }, [currentProperty, activeBookings]);

  // Only show genuinely unassigned units (excluding units locked by any active booking, including self)
  const availableInventory = allocationSnapshot
    ? allocationSnapshot.availableUnits.filter((inv) => inv.id !== booking.inventoryId)
    : [];
  const lockedUnitCount = allocationSnapshot
    ? allocationSnapshot.lockedUnits.filter(
        (item) => item.unit.id !== booking.inventoryId && item.bookingRef !== booking.bookingRef
      ).length
    : 0;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (booking.status === 'Cancelled') {
      toast.error('Cancelled bookings cannot change units.');
      return;
    }
    if (!selectedPropertyId || !selectedInventoryId) {
      toast.error('Please select a property and a unit');
      return;
    }
    if (
      selectedPropertyId === booking.propertyId &&
      selectedInventoryId === booking.inventoryId
    ) {
      toast.error('Please select a different unit from the currently assigned unit.');
      return;
    }
    if (currentProperty) {
      const check = validateUnitAssignment({
        property: {
          id: currentProperty.id,
          inventory: currentProperty.inventory,
          parkingInventory: currentProperty.parkingInventory,
        },
        activeBookings,
        inventoryId: selectedInventoryId,
        excludeBookingId: booking.id,
      });
      if (!check.ok) {
        toast.error(check.error);
        return;
      }
    }
    // Switch to confirmation view instead of submitting immediately
    setShowConfirm(true);
  };

  const executeReassignment = async () => {
    setSubmitting(true);
    try {
      if (booking.status === 'Cancelled') {
        throw new Error('Cancelled bookings cannot change units.');
      }
      if (
        selectedPropertyId === booking.propertyId &&
        selectedInventoryId === booking.inventoryId
      ) {
        throw new Error('Please select a different unit from the currently assigned unit.');
      }

      const targetFresh = await fetchFreshPropertyAndActiveBookings(selectedPropertyId);
      const validation = validateUnitAssignment({
        property: targetFresh.property,
        activeBookings: targetFresh.activeBookings,
        inventoryId: selectedInventoryId,
        excludeBookingId: booking.id,
      });
      if (!validation.ok) {
        setActiveBookings(targetFresh.activeBookings);
        setSelectedInventoryId('');
        throw new Error(validation.error);
      }

      const newUnit = validation.unit;
      const unitType = newUnit.unitType || '';
      const unitNumber = formatBookingUnitNumber(newUnit);

      // Update booking first and verify no concurrent booking claimed the same unit/floor
      const { error: bErr } = await supabase
        .from('bookings')
        .update({
          property_id: selectedPropertyId,
          property_name: targetFresh.propertyRow.name,
          property_location: targetFresh.propertyRow.location,
          inventory_id: selectedInventoryId,
          unit_type: unitType,
          unit_number: unitNumber,
          last_updated_by: adminUid,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);
      if (bErr) throw bErr;

      const conflictCheck = await detectConcurrentAllocationConflict({
        propertyId: selectedPropertyId,
        bookingId: booking.id,
        inventoryId: selectedInventoryId,
        unitNumber,
        mode: 'update',
      });
      if (conflictCheck.hasConflict) {
        await supabase
          .from('bookings')
          .update({
            property_id: booking.propertyId,
            property_name: booking.propertyName,
            property_location: booking.propertyLocation,
            inventory_id: booking.inventoryId,
            unit_type: booking.unitType,
            unit_number: booking.unitNumber,
            last_updated_by: adminUid,
            updated_at: new Date().toISOString(),
          })
          .eq('id', booking.id);
        try {
          const refreshed = await fetchFreshPropertyAndActiveBookings(selectedPropertyId);
          setActiveBookings(refreshed.activeBookings);
          setSelectedInventoryId('');
        } catch {
          // Ignore secondary refresh error
        }
        throw new Error(
          conflictCheck.message ||
            'Another active booking was assigned to this unit/floor concurrently.'
        );
      }

      // Reconcile property inventory against live active bookings
      const postTargetFresh = await fetchFreshPropertyAndActiveBookings(selectedPropertyId);
      const reconciledTarget = reconcilePropertyInventoryWithBookings(
        postTargetFresh.property,
        postTargetFresh.activeBookings
      );
      const { error: targetPropErr } = await supabase
        .from('properties')
        .update({
          inventory: reconciledTarget.inventory,
          parking_inventory: reconciledTarget.parkingInventory,
        })
        .eq('id', selectedPropertyId);
      if (targetPropErr) throw targetPropErr;

      if (booking.propertyId && booking.propertyId !== selectedPropertyId) {
        const postOldFresh = await fetchFreshPropertyAndActiveBookings(booking.propertyId);
        const reconciledOld = reconcilePropertyInventoryWithBookings(
          postOldFresh.property,
          postOldFresh.activeBookings
        );
        const { error: oldPropErr } = await supabase
          .from('properties')
          .update({
            inventory: reconciledOld.inventory,
            parking_inventory: reconciledOld.parkingInventory,
          })
          .eq('id', booking.propertyId);
        if (oldPropErr) throw oldPropErr;
      }

      await supabase.from('booking_activity_log').insert({
        booking_id: booking.id,
        type: 'Unit Reassigned',
        message: `Moved from ${booking.propertyName} (${booking.unitType}) to ${targetFresh.propertyRow.name} (${unitType}) by ${adminName}`,
        actor_name: adminName,
        actor_id: adminUid,
      });

      toast.success('Unit successfully changed!');
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to change unit: ${message}`);
      setShowConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (showConfirm) {
    const newProp = properties.find((p) => p.id === selectedPropertyId);
    const newInv = newProp?.inventory?.find((i) => i.id === selectedInventoryId);

    let newUnitStr = '';
    if (newInv) {
      newUnitStr = `Floor ${newInv.floor || ''}, ${
        (newInv.unitType || '').toLowerCase().includes((newInv.unitName || '').toLowerCase())
          ? newInv.unitName || ''
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
              {booking.propertyName} - {booking.unitType}{' '}
              {booking.unitNumber ? `(${booking.unitNumber})` : ''}
              <div className="text-red-700 text-xs mt-1">
                This unit will immediately become available for others to book.
              </div>
            </div>

            <div className="flex justify-center text-gray-400">
              <ArrowRight className="rotate-90" size={20} />
            </div>

            <div className="bg-green-50 text-green-900 p-3 rounded-lg text-sm border border-green-100">
              <span className="font-bold block mb-1">Locking:</span>
              {newProp?.name} - {newInv?.unitType} {newUnitStr ? `(${newUnitStr})` : ''}
              <div className="text-green-700 text-xs mt-1">
                This unit will be locked and assigned to this client.
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              disabled={submitting}
              className="px-6 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void executeReassignment()}
              disabled={submitting}
              className="px-6 py-2 bg-amber-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-amber-600 transition-colors disabled:opacity-50 shadow-md"
            >
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
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>
        <h3 className="text-xl font-bold font-serif mb-6 flex items-center gap-2">
          <Building size={24} className="text-brand-primary" /> Reassign Unit
        </h3>

        {loadingProps ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin text-brand-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg mb-6">
              <p className="text-xs text-gray-500 font-bold uppercase mb-1">Current Assignment</p>
              <p className="font-bold text-gray-900">{booking.propertyName}</p>
              <p className="text-sm text-gray-600">
                {booking.unitType} {booking.unitNumber ? `- ${booking.unitNumber}` : ''}
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Property</label>
              <input
                type="text"
                value={booking.propertyName}
                className="w-full p-3 border rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                disabled
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Select Available Unit
              </label>
              <select
                value={selectedInventoryId}
                onChange={(e) => setSelectedInventoryId(e.target.value)}
                className="w-full p-3 border rounded-lg"
                disabled={!selectedPropertyId || availableInventory.length === 0}
              >
                <option value="">-- Choose Available Unit --</option>
                {availableInventory.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    Floor {inv.floor} - {inv.unitType} {inv.unitName ? `(${inv.unitName})` : ''} -
                    ৳{Number(inv.price || 0).toLocaleString()}
                  </option>
                ))}
              </select>
              {lockedUnitCount > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  {lockedUnitCount} unit{lockedUnitCount === 1 ? '' : 's'} currently locked by other active bookings and excluded.
                </p>
              )}
              {selectedPropertyId && availableInventory.length === 0 && (
                <p className="text-xs text-red-500 mt-1 font-bold">
                  No available units in this property.
                </p>
              )}
            </div>

            <div className="pt-6 mt-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedInventoryId}
                className="px-6 py-2 bg-brand-primary text-white font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-brand-dark transition-colors disabled:opacity-50"
              >
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
