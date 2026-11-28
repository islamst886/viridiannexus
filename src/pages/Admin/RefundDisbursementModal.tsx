import { useMemo, useState, type FormEvent } from 'react';
import { X, Loader2, Save, Banknote, Wand2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { supabase } from '../../supabase';
import type { Booking, BookingPayment } from '../../types';
import {
  CANCELLATION_FEE_TYPE,
  REFUND_PAYOUT_TYPE,
  computeCancellationSettlement,
  generateCashRefundVoucherRef,
  getRefundPayoutRefMeta,
  isPartiallyPaidRow,
  isUnpaidObligationRow,
} from '../../utils/bookingCancellation';
import {
  mergeInvoiceReleaseManifestIntoNotes,
  parseInvoiceReleaseManifest,
  withBookingDocRelease,
  withPaymentDocRelease,
} from '../../utils/invoiceRelease';

interface RefundDisbursementModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  payments: BookingPayment[];
  adminName: string;
  adminUid: string | undefined;
  onSuccess?: () => void;
}

function formatMoney(amount: number): string {
  return '৳ ' + Math.round(Number(amount) || 0).toLocaleString('en-IN');
}

export default function RefundDisbursementModal({
  isOpen,
  onClose,
  booking,
  payments,
  adminName,
  adminUid,
  onSuccess,
}: RefundDisbursementModalProps) {
  if (!isOpen || !booking) return null;

  return (
    <RefundDisbursementModalContent
      key={`${booking.id}:${payments.length}`}
      booking={booking}
      payments={payments}
      adminName={adminName}
      adminUid={adminUid}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

function RefundDisbursementModalContent({
  booking,
  payments,
  adminName,
  adminUid,
  onClose,
  onSuccess,
}: {
  booking: Booking;
  payments: BookingPayment[];
  adminName: string;
  adminUid: string | undefined;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const initialSettlement = useMemo(
    () => computeCancellationSettlement(booking, payments),
    [booking, payments]
  );
  const isLegacyUnsettled = !initialSettlement.primaryRefundRow;

  const [feeInput, setFeeInput] = useState<string>('0');
  const [disbursementAmount, setDisbursementAmount] = useState<string>(
    isLegacyUnsettled
      ? String(initialSettlement.grossCollected)
      : String(initialSettlement.refundRemaining)
  );
  const [payoutMode, setPayoutMode] = useState('Bank Transfer (BEFTN/RTGS)');
  const [payoutRef, setPayoutRef] = useState('');
  const [payoutDate, setPayoutDate] = useState<string>(
    () => new Date().toISOString().split('T')[0] ?? ''
  );
  const [note, setNote] = useState('');
  const [issueVoucherToClient, setIssueVoucherToClient] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const parsedFee = isLegacyUnsettled
    ? Math.min(initialSettlement.grossCollected, Math.max(0, Number(feeInput) || 0))
    : initialSettlement.cancellationFee;
  const effectiveNetRefundable = isLegacyUnsettled
    ? Math.max(0, initialSettlement.grossCollected - parsedFee)
    : initialSettlement.netRefundable;
  const effectiveRemaining = isLegacyUnsettled
    ? effectiveNetRefundable
    : initialSettlement.refundRemaining;
  const refMeta = getRefundPayoutRefMeta(payoutMode);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const amountNum = Math.max(0, Number(disbursementAmount) || 0);

    if (isLegacyUnsettled) {
      if (parsedFee < 0 || parsedFee > initialSettlement.grossCollected) {
        toast.error('Cancellation fee cannot exceed collected amount.');
        return;
      }
      if (amountNum > effectiveNetRefundable) {
        toast.error('Immediate disbursement cannot exceed the net refundable amount.');
        return;
      }
      if (amountNum > 0 && !payoutRef.trim()) {
        toast.error(`${refMeta.label} is required when disbursing a refund.`);
        return;
      }
    } else {
      if (amountNum <= 0) {
        toast.error('Disbursement amount must be greater than zero.');
        return;
      }
      if (amountNum > effectiveRemaining) {
        toast.error(`Amount cannot exceed remaining refundable balance (${formatMoney(effectiveRemaining)}).`);
        return;
      }
      if (!payoutRef.trim()) {
        toast.error(`Please enter ${refMeta.label}.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const todayStr = payoutDate || nowIso.split('T')[0] || '';
      const formattedNote = payoutRef.trim()
        ? note.trim()
          ? `Ref: ${payoutRef.trim()} | ${note.trim()}`
          : `Ref: ${payoutRef.trim()}`
        : note.trim();

      let currentManifest = parseInvoiceReleaseManifest(booking);

      if (isLegacyUnsettled) {
        // Void any lingering legacy Scheduled/Overdue rows and close partial rows
        const unpaidIds = payments.filter((p) => isUnpaidObligationRow(p)).map((p) => p.id);
        const partialIds = payments.filter((p) => isPartiallyPaidRow(p)).map((p) => p.id);

        if (unpaidIds.length > 0) {
          const { error: voidErr } = await supabase
            .from('booking_payments')
            .update({
              status: 'Voided',
              notes: `Voided during cancellation settlement by ${adminName}.`,
              updated_at: nowIso,
            })
            .in('id', unpaidIds);
          if (voidErr) throw voidErr;
        }
        if (partialIds.length > 0) {
          const { error: partErr } = await supabase
            .from('booking_payments')
            .update({ status: 'Partially Paid (Closed)', updated_at: nowIso })
            .in('id', partialIds);
          if (partErr) throw partErr;
        }

        if (parsedFee > 0) {
          const { error: feeErr } = await supabase.from('booking_payments').insert({
            booking_id: booking.id,
            type: CANCELLATION_FEE_TYPE,
            due_date: todayStr,
            paid_date: todayStr,
            scheduled_amount: parsedFee,
            received_amount: 0,
            payment_mode: 'Deduction',
            status: 'Deducted',
            notes: note.trim() || 'Cancellation fee applied during settlement.',
            recorded_by: adminUid ?? null,
          });
          if (feeErr) throw feeErr;
        }

        let createdRefundRow: BookingPayment | null = null;
        if (effectiveNetRefundable > 0) {
          const refundStatus =
            amountNum >= effectiveNetRefundable
              ? 'Refunded'
              : amountNum > 0
                ? 'Partially Refunded'
                : 'Refund Pending';
          const { data: insertedRefund, error: refErr } = await supabase
            .from('booking_payments')
            .insert({
              booking_id: booking.id,
              type: REFUND_PAYOUT_TYPE,
              due_date: todayStr,
              paid_date: amountNum > 0 ? todayStr : null,
              scheduled_amount: -effectiveNetRefundable,
              received_amount: amountNum > 0 ? -amountNum : 0,
              payment_mode: payoutMode,
              status: refundStatus,
              notes: formattedNote || 'Refund settlement initialized.',
              recorded_by: adminUid ?? null,
            })
            .select()
            .single();
          if (refErr) throw refErr;
          if (insertedRefund) {
            createdRefundRow = {
              id: String((insertedRefund as { id: string }).id),
              bookingId: booking.id,
              type: REFUND_PAYOUT_TYPE,
              scheduledAmount: -effectiveNetRefundable,
              receivedAmount: amountNum > 0 ? -amountNum : 0,
              status: refundStatus,
              dueDate: todayStr,
              paidDate: amountNum > 0 ? todayStr : null,
              paymentMode: payoutMode,
              notes: formattedNote,
            };
          }
        }

        currentManifest = withBookingDocRelease(
          currentManifest,
          'cancellation-settlement',
          'issued',
          { name: adminName, id: adminUid ?? null },
          nowIso,
          booking.id
        );
        if (issueVoucherToClient && createdRefundRow && amountNum > 0) {
          currentManifest = withPaymentDocRelease(
            currentManifest,
            createdRefundRow,
            'issued',
            { name: adminName, id: adminUid ?? null },
            nowIso,
            booking.id
          );
        }

        const nextNotes = mergeInvoiceReleaseManifestIntoNotes(booking.notes, currentManifest);
        const { error: bUpdErr } = await supabase
          .from('bookings')
          .update({
            balance_due: 0,
            notes: nextNotes,
            last_updated_by: adminUid ?? null,
            updated_at: nowIso,
          })
          .eq('id', booking.id);
        if (bUpdErr) throw bUpdErr;

        await supabase.from('booking_activity_log').insert({
          booking_id: booking.id,
          type: 'Cancellation Settlement Initialized',
          message: `Settlement configured by ${adminName}: Collected ${formatMoney(initialSettlement.grossCollected)}, Fee ${formatMoney(parsedFee)}, Net Refundable ${formatMoney(effectiveNetRefundable)}${amountNum > 0 ? `, Disbursed ${formatMoney(amountNum)} (${payoutMode})` : ''}.`,
          actor_name: adminName,
          actor_id: adminUid ?? null,
        });

        toast.success('Cancellation settlement saved successfully.');
      } else {
        const refundRow = initialSettlement.primaryRefundRow!;
        const newDisbursedTotal = initialSettlement.refundDisbursed + amountNum;
        const nextStatus =
          newDisbursedTotal >= initialSettlement.netRefundable
            ? 'Refunded'
            : 'Partially Refunded';

        const mergedRowNotes = formattedNote
          ? refundRow.notes
            ? `${refundRow.notes}\n[${todayStr}] ${formatMoney(amountNum)} via ${payoutMode} — ${formattedNote}`
            : formattedNote
          : refundRow.notes;

        const { error: pErr } = await supabase
          .from('booking_payments')
          .update({
            received_amount: -newDisbursedTotal,
            paid_date: todayStr,
            payment_mode: payoutMode,
            status: nextStatus,
            notes: mergedRowNotes,
            recorded_by: adminUid ?? null,
            updated_at: nowIso,
          })
          .eq('id', refundRow.id);
        if (pErr) throw pErr;

        if (issueVoucherToClient) {
          const updatedRowForManifest: BookingPayment = {
            ...refundRow,
            receivedAmount: -newDisbursedTotal,
            paidDate: todayStr,
            paymentMode: payoutMode,
            status: nextStatus,
            notes: mergedRowNotes,
          };
          currentManifest = withPaymentDocRelease(
            currentManifest,
            updatedRowForManifest,
            'issued',
            { name: adminName, id: adminUid ?? null },
            nowIso,
            booking.id
          );
        }
        const nextNotes = mergeInvoiceReleaseManifestIntoNotes(booking.notes, currentManifest);

        const { error: bErr } = await supabase
          .from('bookings')
          .update({
            balance_due: 0,
            notes: nextNotes,
            last_updated_by: adminUid ?? null,
            updated_at: nowIso,
          })
          .eq('id', booking.id);
        if (bErr) throw bErr;

        await supabase.from('booking_activity_log').insert({
          booking_id: booking.id,
          type: 'Refund Disbursed',
          message: `Refund disbursement of ${formatMoney(amountNum)} issued via ${payoutMode} (Ref: ${payoutRef.trim()}) by ${adminName}.`,
          actor_name: adminName,
          actor_id: adminUid ?? null,
        });

        toast.success('Refund disbursement recorded successfully.');
      }

      if (booking.linkedUserId && amountNum > 0) {
        try {
          await supabase.from('notifications').insert({
            user_id: booking.linkedUserId,
            text: `Refund of ${formatMoney(amountNum)} for cancelled booking ${booking.bookingRef} has been disbursed via ${payoutMode} (Ref: ${payoutRef.trim()}).`,
            read: false,
          });
        } catch (notifyErr) {
          console.error('Best-effort refund notification failed:', notifyErr);
        }
      }

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to record refund: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-cyan-50 text-cyan-800 rounded-xl border border-cyan-200">
            <Banknote size={22} />
          </div>
          <div>
            <h3 className="text-xl font-bold font-serif text-gray-900">
              {isLegacyUnsettled ? 'Initialize Cancellation Settlement' : 'Disburse Refund'}
            </h3>
            <p className="text-xs text-gray-500">
              {booking.bookingRef} · {booking.clientName}
            </p>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 mb-5 grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-gray-500 block">Gross Collected</span>
            <strong className="text-gray-900 text-sm">
              {formatMoney(initialSettlement.grossCollected)}
            </strong>
          </div>
          <div>
            <span className="text-gray-500 block">Cancellation Fee</span>
            <strong className="text-red-700 text-sm">{formatMoney(parsedFee)}</strong>
          </div>
          <div>
            <span className="text-gray-500 block">Net Refundable</span>
            <strong className="text-gray-900 text-sm">{formatMoney(effectiveNetRefundable)}</strong>
          </div>
          <div>
            <span className="text-gray-500 block">Remaining Payable</span>
            <strong className="text-cyan-800 text-sm">{formatMoney(effectiveRemaining)}</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isLegacyUnsettled && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Cancellation Fee / Deduction (BDT)
              </label>
              <input
                type="number"
                min={0}
                max={initialSettlement.grossCollected}
                value={feeInput}
                onChange={(e) => {
                  const nextFee = Math.min(
                    initialSettlement.grossCollected,
                    Math.max(0, Number(e.target.value) || 0)
                  );
                  setFeeInput(e.target.value);
                  setDisbursementAmount(String(Math.max(0, initialSettlement.grossCollected - nextFee)));
                }}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              {isLegacyUnsettled ? 'Disburse Now (BDT, 0 to schedule only)' : 'Refund Amount (BDT) *'}
            </label>
            <input
              type="number"
              min={isLegacyUnsettled ? 0 : 1}
              max={effectiveRemaining}
              value={disbursementAmount}
              onChange={(e) => setDisbursementAmount(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Payout Mode *</label>
              <select
                value={payoutMode}
                onChange={(e) => setPayoutMode(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
              >
                <option value="Bank Transfer (BEFTN/RTGS)">Bank Transfer (BEFTN/RTGS)</option>
                <option value="Account Payee Cheque">Account Payee Cheque</option>
                <option value="Pay Order">Pay Order</option>
                <option value="Mobile Banking (bKash/Nagad)">Mobile Banking (bKash/Nagad)</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Disbursement Date *</label>
              <input
                type="date"
                value={payoutDate}
                onChange={(e) => setPayoutDate(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              {refMeta.label} {Number(disbursementAmount) > 0 ? '*' : '(Optional)'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={payoutRef}
                onChange={(e) => setPayoutRef(e.target.value)}
                placeholder={refMeta.placeholder}
                className="flex-1 min-w-0 p-2.5 border border-gray-300 rounded-lg text-sm"
                required={Number(disbursementAmount) > 0}
              />
              {refMeta.supportsAutoGenerate && (
                <button
                  type="button"
                  onClick={() => setPayoutRef(generateCashRefundVoucherRef(booking.bookingRef))}
                  className="px-3 py-2 text-xs font-bold text-brand-dark bg-brand-primary/10 border border-brand-primary/30 rounded-lg hover:bg-brand-primary hover:text-white transition-colors inline-flex items-center gap-1.5 shrink-0"
                >
                  <Wand2 size={14} />
                  Generate Voucher #
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">{refMeta.helperText}</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Internal Finance Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Bank branch or beneficiary account memo"
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 cursor-pointer text-xs text-gray-700">
            <input
              type="checkbox"
              checked={issueVoucherToClient}
              onChange={(e) => setIssueVoucherToClient(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
            />
            <span>
              <strong className="text-emerald-900 block">
                Verify &amp; Issue Refund Voucher to Client Portal
              </strong>
              Make the official Refund Voucher visible read-only to the client once disbursed.
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-brand-primary text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-brand-dark transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isLegacyUnsettled ? 'Save Settlement' : 'Record Refund Disbursement'}
          </button>
        </form>
      </div>
    </div>
  );
}
