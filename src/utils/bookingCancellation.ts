import type { Booking, BookingPayment } from '../types';

export const CANCELLATION_FEE_TYPE = 'Cancellation Fee';
export const REFUND_PAYOUT_TYPE = 'Refund Payout';

function extractBookingRefSuffix(bookingRef?: string | null): string {
  const segments = (bookingRef || '')
    .split('-')
    .map((part) => part.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
    .filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? '';
  return lastSegment.length > 0
    ? lastSegment.slice(-6)
    : String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

export function generateCancellationLegalRef(
  bookingRef?: string | null,
  referenceDate = new Date()
): string {
  const year = referenceDate.getFullYear();
  return `VN-CXL-${year}-${extractBookingRefSuffix(bookingRef)}`;
}

export function generateCashRefundVoucherRef(
  bookingRef?: string | null,
  referenceDate = new Date()
): string {
  const year = referenceDate.getFullYear();
  return `CV-${year}-${extractBookingRefSuffix(bookingRef)}`;
}

export interface RefundPayoutRefMeta {
  label: string;
  placeholder: string;
  helperText: string;
  supportsAutoGenerate: boolean;
}

export function getRefundPayoutRefMeta(payoutMode: string): RefundPayoutRefMeta {
  switch (payoutMode) {
    case 'Bank Transfer (BEFTN/RTGS)':
      return {
        label: 'BEFTN / RTGS Transaction Ref',
        placeholder: 'e.g. BEFTN-88412 or RTGS-20261124-091',
        helperText: 'Enter the bank transfer trace ID from your BEFTN/RTGS confirmation slip.',
        supportsAutoGenerate: false,
      };
    case 'Account Payee Cheque':
      return {
        label: 'Cheque Number',
        placeholder: 'e.g. CHQ-44109 or EBL-CHQ-44109',
        helperText: 'Enter the Account Payee cheque leaf number issued to the client.',
        supportsAutoGenerate: false,
      };
    case 'Pay Order':
      return {
        label: 'Pay Order Number',
        placeholder: 'e.g. PO-2026-77312',
        helperText: 'Enter the bank Pay Order / Demand Draft instrument number.',
        supportsAutoGenerate: false,
      };
    case 'Mobile Banking (bKash/Nagad)':
      return {
        label: 'Mobile Banking TrxID',
        placeholder: 'e.g. BKASH-9X4K2M8P',
        helperText: 'Enter the bKash / Nagad / Rocket transaction ID from the payout confirmation.',
        supportsAutoGenerate: false,
      };
    case 'Cash':
      return {
        label: 'Cash Payment Voucher No.',
        placeholder: 'e.g. CV-2026-8687',
        helperText:
          'Enter the signed physical cash voucher/receipt number, or click Generate Voucher #.',
        supportsAutoGenerate: true,
      };
    default:
      return {
        label: 'Payout Reference / Voucher No.',
        placeholder: 'e.g. REF-2026-001',
        helperText: 'Enter the bank, cheque, or signed voucher reference for this disbursement.',
        supportsAutoGenerate: false,
      };
  }
}

export function isVoidedPaymentStatus(status?: string | null): boolean {
  return status === 'Voided';
}

export function isRefundPaymentRow(p: Pick<BookingPayment, 'type' | 'status'>): boolean {
  const typeLower = (p.type || '').toLowerCase();
  const statusLower = (p.status || '').toLowerCase();
  return (
    p.type === REFUND_PAYOUT_TYPE ||
    typeLower.startsWith('refund') ||
    statusLower === 'refund pending' ||
    statusLower === 'partially refunded' ||
    statusLower === 'refunded'
  );
}

export function isCancellationFeeRow(p: Pick<BookingPayment, 'type'>): boolean {
  return p.type === CANCELLATION_FEE_TYPE || (p.type || '').toLowerCase().includes('cancellation fee');
}

export function isPositiveClientPaymentRow(
  p: Pick<BookingPayment, 'type' | 'status' | 'scheduledAmount' | 'receivedAmount'>
): boolean {
  if (isRefundPaymentRow(p) || isCancellationFeeRow(p)) return false;
  return (Number(p.scheduledAmount) || 0) >= 0 && (Number(p.receivedAmount) || 0) > 0;
}

export function isUnpaidObligationRow(
  p: Pick<BookingPayment, 'type' | 'status' | 'scheduledAmount' | 'receivedAmount'>
): boolean {
  if (isRefundPaymentRow(p) || isCancellationFeeRow(p)) return false;
  if ((Number(p.scheduledAmount) || 0) <= 0) return false;
  if ((Number(p.receivedAmount) || 0) > 0) return false;
  return (
    p.status !== 'Paid' &&
    p.status !== 'Waived' &&
    p.status !== 'Voided' &&
    p.status !== 'Deducted'
  );
}

export function isPartiallyPaidRow(
  p: Pick<BookingPayment, 'type' | 'status' | 'scheduledAmount' | 'receivedAmount'>
): boolean {
  if (isRefundPaymentRow(p) || isCancellationFeeRow(p)) return false;
  const scheduled = Number(p.scheduledAmount) || 0;
  const received = Number(p.receivedAmount) || 0;
  if (scheduled <= 0 || received <= 0) return false;
  return (
    p.status === 'Partially Paid' ||
    p.status === 'Partially Paid (Closed)' ||
    (p.status !== 'Paid' && received < scheduled)
  );
}

export type CancellationGovernanceTier =
  | 'already-cancelled'
  | 'standard'
  | 'post-agreement'
  | 'post-completion';

export interface CancellationGovernanceResult {
  allowed: boolean;
  requiresSuperAdmin: boolean;
  requiresLegalRef: boolean;
  tier: CancellationGovernanceTier;
  blockReason?: string;
}

/**
 * Evaluates who is authorized to cancel a booking based on its current lifecycle stage and status.
 */
export function evaluateCancellationGovernance(
  booking: Pick<Booking, 'stage' | 'status'> | null | undefined,
  isSuperAdmin: boolean
): CancellationGovernanceResult {
  if (!booking) {
    return {
      allowed: false,
      requiresSuperAdmin: false,
      requiresLegalRef: false,
      tier: 'already-cancelled',
      blockReason: 'Booking record not found.',
    };
  }

  if (booking.status === 'Cancelled' || booking.stage === 'Cancelled') {
    return {
      allowed: false,
      requiresSuperAdmin: false,
      requiresLegalRef: false,
      tier: 'already-cancelled',
      blockReason: 'This booking is already cancelled.',
    };
  }

  const stage = booking.stage === 'Token Paid' ? 'EOI' : (booking.stage ?? 'EOI');

  if (
    booking.status === 'Completed' ||
    stage === 'Fully Paid' ||
    stage === 'Handover' ||
    stage === 'Completed'
  ) {
    return {
      allowed: Boolean(isSuperAdmin),
      requiresSuperAdmin: true,
      requiresLegalRef: true,
      tier: 'post-completion',
      blockReason: isSuperAdmin
        ? undefined
        : 'Fully Paid, Handover, or Completed bookings can only be reversed by a Super Admin with a formal legal rescission reference.',
    };
  }

  if (stage === 'Agreement Signed' || stage === 'Installments Running') {
    return {
      allowed: Boolean(isSuperAdmin),
      requiresSuperAdmin: true,
      requiresLegalRef: true,
      tier: 'post-agreement',
      blockReason: isSuperAdmin
        ? undefined
        : 'Bookings at or beyond "Agreement Signed" require Super Admin authorization and a Deed Rescission / Cancellation Reference.',
    };
  }

  return {
    allowed: true,
    requiresSuperAdmin: false,
    requiresLegalRef: false,
    tier: 'standard',
  };
}

export type CancellationSettlementStatus =
  | 'no-payment-closed'
  | 'forfeited'
  | 'unsettled-legacy'
  | 'refund-pending'
  | 'partially-refunded'
  | 'refunded';

export interface CancellationSettlementSummary {
  grossCollected: number;
  cancellationFee: number;
  netRefundable: number;
  refundRows: BookingPayment[];
  refundScheduled: number;
  refundDisbursed: number;
  refundRemaining: number;
  unpaidObligationRows: BookingPayment[];
  partiallyPaidRows: BookingPayment[];
  voidedCount: number;
  primaryRefundRow: BookingPayment | null;
  settlementStatus: CancellationSettlementStatus;
  settlementStatusLabel: string;
}

/**
 * Computes financial settlement metrics, refund balances, and voidable rows for cancellation workflows.
 */
export function computeCancellationSettlement(
  booking: Pick<Booking, 'totalPaid' | 'status'>,
  payments: BookingPayment[] = [],
  proposedFee?: number
): CancellationSettlementSummary {
  const positiveRows = payments.filter((p) => isPositiveClientPaymentRow(p));
  const rowCollected = positiveRows.reduce((sum, p) => sum + (Number(p.receivedAmount) || 0), 0);
  const grossCollected =
    positiveRows.length > 0 ? rowCollected : Math.max(0, Number(booking.totalPaid) || 0);

  const feeRows = payments.filter((p) => isCancellationFeeRow(p));
  const existingFee = feeRows.reduce((sum, p) => sum + Math.abs(Number(p.scheduledAmount) || 0), 0);

  const cancellationFee =
    proposedFee !== undefined
      ? Math.min(grossCollected, Math.max(0, Number(proposedFee) || 0))
      : Math.min(grossCollected, existingFee);

  const netRefundable = Math.max(0, grossCollected - cancellationFee);

  const refundRows = payments.filter((p) => isRefundPaymentRow(p));
  const refundScheduled = refundRows.reduce(
    (sum, p) => sum + Math.abs(Number(p.scheduledAmount) || 0),
    0
  );
  const refundDisbursed = refundRows.reduce(
    (sum, p) => sum + Math.abs(Number(p.receivedAmount) || 0),
    0
  );
  const refundRemaining = Math.max(0, netRefundable - refundDisbursed);

  const unpaidObligationRows = payments.filter((p) => isUnpaidObligationRow(p));
  const partiallyPaidRows = payments.filter((p) => isPartiallyPaidRow(p));
  const voidedCount = payments.filter((p) => isVoidedPaymentStatus(p.status)).length;
  const primaryRefundRow = refundRows[0] ?? null;

  let settlementStatus: CancellationSettlementStatus;
  let settlementStatusLabel: string;

  if (grossCollected <= 0) {
    settlementStatus = 'no-payment-closed';
    settlementStatusLabel = 'Closed — Zero Funds Collected';
  } else if (netRefundable === 0) {
    settlementStatus = 'forfeited';
    settlementStatusLabel = 'Settled — 100% Cancellation Deduction Applied';
  } else if (refundRows.length === 0 && booking.status === 'Cancelled') {
    settlementStatus = 'unsettled-legacy';
    settlementStatusLabel = 'Settlement Pending Setup';
  } else if (refundDisbursed >= netRefundable) {
    settlementStatus = 'refunded';
    settlementStatusLabel = 'Refund Settled in Full';
  } else if (refundDisbursed > 0) {
    settlementStatus = 'partially-refunded';
    settlementStatusLabel = 'Partially Refunded';
  } else {
    settlementStatus = 'refund-pending';
    settlementStatusLabel = 'Refund Pending Disbursement';
  }

  return {
    grossCollected,
    cancellationFee,
    netRefundable,
    refundRows,
    refundScheduled,
    refundDisbursed,
    refundRemaining,
    unpaidObligationRows,
    partiallyPaidRows,
    voidedCount,
    primaryRefundRow,
    settlementStatus,
    settlementStatusLabel,
  };
}
