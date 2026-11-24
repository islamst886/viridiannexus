import { useMemo, useState, type FormEvent } from 'react';
import { X, AlertTriangle, Loader2, ShieldAlert, FileCheck2, Wand2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { supabase } from '../../supabase';
import type { Booking, BookingPayment, BookingPaymentDBRow } from '../../types';
import {
  fetchFreshPropertyAndActiveBookings,
  reconcilePropertyInventoryWithBookings,
} from '../../utils/bookingAllocation';
import {
  CANCELLATION_FEE_TYPE,
  REFUND_PAYOUT_TYPE,
  computeCancellationSettlement,
  evaluateCancellationGovernance,
  generateCancellationLegalRef,
  isPartiallyPaidRow,
  isUnpaidObligationRow,
} from '../../utils/bookingCancellation';
import {
  mergeInvoiceReleaseManifestIntoNotes,
  parseInvoiceReleaseManifest,
  revokeActiveDocsOnCancellation,
  withBookingDocRelease,
} from '../../utils/invoiceRelease';
import { mapPaymentFromDB } from '../../utils/mappers';

type CancelableBooking = Booking & { internal_notes?: string | null };

interface CancelBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: CancelableBooking | null;
  payments?: BookingPayment[];
  isSuperAdmin?: boolean;
  adminName: string;
  adminUid: string | undefined;
  onSuccess?: () => void;
}

function getDefaultRefundDueDate(): string {
  const d = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  return d.toISOString().split('T')[0] ?? '';
}

function formatMoney(amount: number): string {
  return '৳ ' + Math.round(Number(amount) || 0).toLocaleString('en-IN');
}

export default function CancelBookingModal({
  isOpen,
  onClose,
  booking,
  payments = [],
  isSuperAdmin = false,
  adminName,
  adminUid,
  onSuccess,
}: CancelBookingModalProps) {
  if (!isOpen || !booking) return null;

  return (
    <CancelBookingModalContent
      key={booking.id}
      booking={booking}
      payments={payments}
      isSuperAdmin={isSuperAdmin}
      adminName={adminName}
      adminUid={adminUid}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

function CancelBookingModalContent({
  booking,
  payments,
  isSuperAdmin,
  adminName,
  adminUid,
  onClose,
  onSuccess,
}: {
  booking: CancelableBooking;
  payments: BookingPayment[];
  isSuperAdmin: boolean;
  adminName: string;
  adminUid: string | undefined;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [reason, setReason] = useState('');
  const [legalRef, setLegalRef] = useState('');
  const [cancellationFeeInput, setCancellationFeeInput] = useState<string>('0');
  const [refundDueDate, setRefundDueDate] = useState<string>(getDefaultRefundDueDate);
  const [issueSettlementToClient, setIssueSettlementToClient] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);

  const governance = useMemo(
    () => evaluateCancellationGovernance(booking, isSuperAdmin),
    [booking, isSuperAdmin]
  );

  const parsedFee = Math.max(0, Number(cancellationFeeInput) || 0);
  const settlement = useMemo(
    () => computeCancellationSettlement(booking, payments, parsedFee),
    [booking, payments, parsedFee]
  );

  const handlePercentageFee = (pct: number) => {
    const calc = Math.round((settlement.grossCollected * pct) / 100);
    setCancellationFeeInput(String(calc));
  };

  const handleCancel = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!governance.allowed) {
      toast.error(governance.blockReason || 'You are not authorized to cancel this booking.');
      return;
    }
    if (!reason.trim()) {
      toast.error('Please provide a cancellation reason/note.');
      return;
    }
    if (governance.requiresLegalRef && !legalRef.trim()) {
      toast.error('Deed Rescission / Cancellation Reference is required for this stage.');
      return;
    }
    if (parsedFee < 0 || parsedFee > settlement.grossCollected) {
      toast.error('Cancellation fee must be between ৳0 and the total amount collected.');
      return;
    }

    const confirmSummary =
      settlement.grossCollected > 0
        ? `Are you sure you want to cancel ${booking.bookingRef}?\n\n• Unit & parking will be released back to Available\n• ${settlement.unpaidObligationRows.length} unpaid schedule(s) will be Voided\n• Gross Collected: ${formatMoney(settlement.grossCollected)}\n• Cancellation Fee: ${formatMoney(settlement.cancellationFee)}\n• Net Refundable: ${formatMoney(settlement.netRefundable)}`
        : `Are you sure you want to cancel booking ${booking.bookingRef}? This will immediately release the assigned unit and void ${settlement.unpaidObligationRows.length} scheduled payment(s).`;

    if (!window.confirm(confirmSummary)) {
      return;
    }

    setLoading(true);
    try {
      const cancelTime = new Date().toISOString();
      const cancelDateStr = cancelTime.split('T')[0] ?? '';

      // 1. Fetch live ledger rows so voiding & settlement math cannot rely on stale props
      const { data: livePaymentRows, error: livePayErr } = await supabase
        .from('booking_payments')
        .select('*')
        .eq('booking_id', booking.id);
      if (livePayErr) throw livePayErr;

      const livePayments: BookingPayment[] = ((livePaymentRows as BookingPaymentDBRow[]) || []).map(
        (r) => mapPaymentFromDB(r)
      );
      const effectivePayments = livePayments.length > 0 ? livePayments : payments;
      const liveSettlement = computeCancellationSettlement(booking, effectivePayments, parsedFee);

      const unpaidIds = effectivePayments.filter((p) => isUnpaidObligationRow(p)).map((p) => p.id);
      const partialIds = effectivePayments.filter((p) => isPartiallyPaidRow(p)).map((p) => p.id);

      // 2. Revoke active forward-looking client docs & optionally issue Cancellation Settlement
      const existingManifest = parseInvoiceReleaseManifest(booking);
      let nextManifest = revokeActiveDocsOnCancellation(
        existingManifest,
        effectivePayments,
        { name: adminName, id: adminUid ?? null },
        cancelTime
      );
      if (issueSettlementToClient) {
        nextManifest = withBookingDocRelease(
          nextManifest,
          'cancellation-settlement',
          'issued',
          { name: adminName, id: adminUid ?? null },
          cancelTime
        );
      }
      const nextNotes = mergeInvoiceReleaseManifestIntoNotes(booking.notes, nextManifest);

      const refSegment = legalRef.trim() ? ` | Legal Ref: ${legalRef.trim()}` : '';
      const settlementSegment =
        liveSettlement.grossCollected > 0
          ? ` | Collected: ${formatMoney(liveSettlement.grossCollected)}, Fee: ${formatMoney(liveSettlement.cancellationFee)}, Net Refundable: ${formatMoney(liveSettlement.netRefundable)}`
          : '';
      const cancelNoteEntry = `[Cancelled by ${adminName} on ${cancelDateStr}${refSegment}]: ${reason.trim()}${settlementSegment}`;
      const prevInternal = booking.internalNotes || booking.internal_notes || '';
      const updatedInternalNotes = prevInternal
        ? `${prevInternal}\n${cancelNoteEntry}`
        : cancelNoteEntry;

      // 3. Update booking status, balance_due = 0, and release manifest first so reconciliation sees release
      const { error: bError } = await supabase
        .from('bookings')
        .update({
          status: 'Cancelled',
          stage: 'Cancelled',
          balance_due: 0,
          notes: nextNotes,
          internal_notes: updatedInternalNotes,
          last_updated_by: adminUid ?? null,
          updated_at: cancelTime,
        })
        .eq('id', booking.id);
      if (bError) throw bError;

      // 4. Void unpaid scheduled/overdue rows and close partial rows cleanly
      if (unpaidIds.length > 0) {
        const { error: voidErr } = await supabase
          .from('booking_payments')
          .update({
            status: 'Voided',
            notes: `Voided upon booking cancellation on ${cancelDateStr} by ${adminName}.`,
            updated_at: cancelTime,
          })
          .in('id', unpaidIds);
        if (voidErr) throw voidErr;
      }

      if (partialIds.length > 0) {
        const { error: partialErr } = await supabase
          .from('booking_payments')
          .update({
            status: 'Partially Paid (Closed)',
            updated_at: cancelTime,
          })
          .in('id', partialIds);
        if (partialErr) throw partialErr;
      }

      // 5. Append Cancellation Fee and/or Refund Payout ledger items if client had paid money
      if (liveSettlement.cancellationFee > 0) {
        const { error: feeErr } = await supabase.from('booking_payments').insert({
          booking_id: booking.id,
          type: CANCELLATION_FEE_TYPE,
          due_date: cancelDateStr,
          paid_date: cancelDateStr,
          scheduled_amount: liveSettlement.cancellationFee,
          received_amount: 0,
          payment_mode: 'Deduction',
          status: 'Deducted',
          notes: `Cancellation deduction applied on termination.${legalRef.trim() ? ` Ref: ${legalRef.trim()}` : ''}`,
          recorded_by: adminUid ?? null,
        });
        if (feeErr) throw feeErr;
      }

      if (liveSettlement.netRefundable > 0) {
        const { error: refundErr } = await supabase.from('booking_payments').insert({
          booking_id: booking.id,
          type: REFUND_PAYOUT_TYPE,
          due_date: refundDueDate || cancelDateStr,
          paid_date: null,
          scheduled_amount: -liveSettlement.netRefundable,
          received_amount: 0,
          payment_mode: 'Bank Transfer',
          status: 'Refund Pending',
          notes: `Net refundable payout after ${formatMoney(liveSettlement.cancellationFee)} deduction.${legalRef.trim() ? ` Ref: ${legalRef.trim()}` : ''}`,
          recorded_by: adminUid ?? null,
        });
        if (refundErr) throw refundErr;
      }

      // 6. Reconcile unit & parking inventory locks
      if (booking.propertyId) {
        const postFresh = await fetchFreshPropertyAndActiveBookings(booking.propertyId);
        const reconciled = reconcilePropertyInventoryWithBookings(
          postFresh.property,
          postFresh.activeBookings
        );
        const { error: propErr } = await supabase
          .from('properties')
          .update({
            inventory: reconciled.inventory,
            parking_inventory: reconciled.parkingInventory,
          })
          .eq('id', booking.propertyId);
        if (propErr) throw propErr;
      }

      // 7. Activity Log & optional client notification
      await supabase.from('booking_activity_log').insert({
        booking_id: booking.id,
        type: 'Booking Cancelled',
        message: `Booking cancelled by ${adminName}. Reason: ${reason.trim()} (${unpaidIds.length} unpaid row(s) voided, assigned assets released${liveSettlement.grossCollected > 0 ? `, Net Refundable: ${formatMoney(liveSettlement.netRefundable)}` : ''})`,
        actor_name: adminName,
        actor_id: adminUid ?? null,
        metadata: {
          reason: reason.trim(),
          legalRef: legalRef.trim() || null,
          cancelledBy: adminName,
          cancellationDate: cancelTime,
          voidedPaymentCount: unpaidIds.length,
          closedPartialCount: partialIds.length,
          grossCollected: liveSettlement.grossCollected,
          cancellationFee: liveSettlement.cancellationFee,
          netRefundable: liveSettlement.netRefundable,
        },
      });

      if (booking.linkedUserId) {
        try {
          await supabase.from('notifications').insert({
            user_id: booking.linkedUserId,
            text:
              liveSettlement.netRefundable > 0
                ? `Your booking ${booking.bookingRef} (${booking.propertyName}) has been cancelled. Net refundable amount of ${formatMoney(liveSettlement.netRefundable)} is scheduled for processing.`
                : `Your booking ${booking.bookingRef} (${booking.propertyName}) has been formally cancelled and closed.`,
            read: false,
          });
        } catch (notifyErr) {
          console.error('Best-effort cancellation notification failed:', notifyErr);
        }
      }

      toast.success('Booking cancelled and settlement ledger updated.');
      onSuccess?.();
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to cancel booking: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>

        <div className="flex items-center gap-3 text-red-600 mb-2">
          <div className="p-2 bg-red-100 rounded-full">
            {governance.allowed ? <AlertTriangle size={24} /> : <ShieldAlert size={24} />}
          </div>
          <div>
            <h3 className="text-xl font-bold font-serif">Cancel Booking</h3>
            <p className="text-xs text-gray-500">
              {booking.bookingRef} · Stage: <strong className="text-gray-800">{booking.stage}</strong>
            </p>
          </div>
        </div>

        {!governance.allowed ? (
          <div className="mt-4 space-y-5">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
              <strong className="block mb-1 font-bold">Super Admin Authorization Required</strong>
              <p>{governance.blockReason}</p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-bold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-xs text-gray-700 mb-5 mt-3 border-l-4 border-red-500 bg-red-50 p-3.5 rounded-r space-y-1">
              <div>
                <strong>Asset Release:</strong> {booking.propertyName} ({booking.unitNumber || 'TBD'}
                {booking.parkingIncluded ? ` · Parking: ${booking.parkingIncluded}` : ''}) returns
                to <strong>Available</strong>.
              </div>
              <div>
                <strong>Billing &amp; Portal Impact:</strong> {settlement.unpaidObligationRows.length}{' '}
                unpaid schedule(s) will be <strong>Voided</strong>, balance due reset to{' '}
                <strong>৳ 0</strong>, and active demand/allotment invoices withdrawn from the Client
                Portal.
              </div>
            </div>

            <form onSubmit={handleCancel} className="space-y-4">
              {settlement.grossCollected > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                      Financial Settlement Calculation
                    </span>
                    <span className="text-xs font-bold text-emerald-800">
                      Collected: {formatMoney(settlement.grossCollected)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Cancellation Fee / Deduction (BDT)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={settlement.grossCollected}
                        value={cancellationFeeInput}
                        onChange={(e) => setCancellationFeeInput(e.target.value)}
                        className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-primary/40"
                      />
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {[0, 5, 10].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => handlePercentageFee(pct)}
                            className="px-2 py-0.5 text-[11px] font-bold bg-white border border-gray-300 rounded hover:bg-gray-100 text-gray-700"
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Target Refund Settlement Date
                      </label>
                      <input
                        type="date"
                        value={refundDueDate}
                        onChange={(e) => setRefundDueDate(e.target.value)}
                        disabled={settlement.netRefundable <= 0}
                        className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-primary/40 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-emerald-200 text-sm">
                    <span className="font-semibold text-gray-700">Net Refundable to Client:</span>
                    <span className="font-bold text-lg text-emerald-900">
                      {formatMoney(settlement.netRefundable)}
                    </span>
                  </div>
                </div>
              )}

              {governance.requiresLegalRef && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    Deed Rescission / Cancellation Reference # <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={legalRef}
                      onChange={(e) => setLegalRef(e.target.value)}
                      placeholder="e.g. VN-DEED-CXL-2026-04"
                      className="flex-1 min-w-0 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-sm"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setLegalRef(generateCancellationLegalRef(booking.bookingRef))}
                      className="px-3 py-2 text-xs font-bold text-brand-dark bg-brand-primary/10 border border-brand-primary/30 rounded-lg hover:bg-brand-primary hover:text-white transition-colors inline-flex items-center gap-1.5 shrink-0"
                    >
                      <Wand2 size={14} />
                      Generate Ref
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Enter your signed Deed of Cancellation / Board Approval Memo #, or click Generate Ref.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Cancellation Reason / Note <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-sm"
                  rows={3}
                  placeholder="e.g. Client requested cancellation due to personal reasons. Settlement scheduled."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  This note will be permanently logged in the audit trail.
                </p>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-gray-50 border border-gray-200 cursor-pointer text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={issueSettlementToClient}
                  onChange={(e) => setIssueSettlementToClient(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                />
                <span>
                  <strong className="text-gray-900 flex items-center gap-1">
                    <FileCheck2 size={13} className="text-brand-primary" />
                    Verify &amp; Issue Cancellation &amp; Settlement Statement to Client Portal
                  </strong>
                  Make the official cancellation &amp; settlement statement visible read-only to the
                  client while withholding prior demand invoices.
                </span>
              </label>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-5 py-2.5 text-sm font-bold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Keep Booking Active
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
