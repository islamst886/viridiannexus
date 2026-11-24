import type { Booking, BookingPayment } from '../types/index.js';
import {
  computeCancellationSettlement,
  isCancellationFeeRow,
  isRefundPaymentRow,
  isUnpaidObligationRow,
} from './bookingCancellation.js';
import {
  classifyPaymentDocumentCategory,
  type InvoiceCategory,
} from './invoiceBuilder.js';

export type BookingInvoiceDocumentKey =
  | 'booking-summary'
  | 'account-statement'
  | 'outstanding-bundle'
  | 'receipts-summary'
  | 'cancellation-settlement';

export type InvoiceReleaseStatus = 'issued' | 'withheld';

export interface IssuedBookingDocRecord {
  status: InvoiceReleaseStatus;
  issuedBy: string;
  issuedById?: string | null;
  issuedAt: string;
  verificationCode: string;
}

export interface IssuedPaymentDocRecord {
  paymentId: string;
  category: InvoiceCategory;
  status: InvoiceReleaseStatus;
  issuedBy: string;
  issuedById?: string | null;
  issuedAt: string;
  verificationCode: string;
}

export interface BookingInvoiceReleaseManifest {
  version: 1;
  bookingDocs: Partial<Record<BookingInvoiceDocumentKey, IssuedBookingDocRecord>>;
  paymentDocs: Record<string, IssuedPaymentDocRecord>;
}

export const BOOKING_INVOICE_DOC_LABELS: Record<BookingInvoiceDocumentKey, string> = {
  'booking-summary': 'Allotment Invoice',
  'account-statement': 'Statement of Account',
  'outstanding-bundle': 'Outstanding Invoice',
  'receipts-summary': 'Receipts Summary',
  'cancellation-settlement': 'Cancellation Settlement',
};

const MANIFEST_MARKER_START = '<!--VN_INVOICE_RELEASE:';
const MANIFEST_MARKER_END = '-->';
const MANIFEST_REGEX = /<!--VN_INVOICE_RELEASE:([\s\S]*?)-->/;

function createEmptyManifest(): BookingInvoiceReleaseManifest {
  return {
    version: 1,
    bookingDocs: {},
    paymentDocs: {},
  };
}

function generateVerificationCode(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `VN-${(hash >>> 0).toString(36).toUpperCase().padStart(7, '0')}`;
}

export function stripInvoiceReleaseManifestMarker(notes?: string | null): string {
  if (!notes || typeof notes !== 'string') return '';
  return notes.replace(MANIFEST_REGEX, '').trim();
}

export function parseInvoiceReleaseManifest(
  booking?: Pick<Booking, 'notes'> | null
): BookingInvoiceReleaseManifest {
  if (!booking?.notes || typeof booking.notes !== 'string') {
    return createEmptyManifest();
  }
  const match = booking.notes.match(MANIFEST_REGEX);
  if (!match?.[1]) {
    return createEmptyManifest();
  }

  try {
    const parsed = JSON.parse(match[1]) as Partial<BookingInvoiceReleaseManifest>;
    return {
      version: 1,
      bookingDocs:
        parsed.bookingDocs && typeof parsed.bookingDocs === 'object' ? parsed.bookingDocs : {},
      paymentDocs:
        parsed.paymentDocs && typeof parsed.paymentDocs === 'object' ? parsed.paymentDocs : {},
    };
  } catch {
    return createEmptyManifest();
  }
}

export function mergeInvoiceReleaseManifestIntoNotes(
  existingNotes: string | null | undefined,
  manifest: BookingInvoiceReleaseManifest
): string {
  const cleanNotes = stripInvoiceReleaseManifestMarker(existingNotes);
  const serialized = `${MANIFEST_MARKER_START}${JSON.stringify(manifest)}${MANIFEST_MARKER_END}`;
  return cleanNotes ? `${cleanNotes}\n\n${serialized}` : serialized;
}

export function isBookingDocKey(category: InvoiceCategory): category is BookingInvoiceDocumentKey {
  return (
    category === 'booking-summary' ||
    category === 'account-statement' ||
    category === 'outstanding-bundle' ||
    category === 'receipts-summary' ||
    category === 'cancellation-settlement'
  );
}

export type ReleaseToggleTarget =
  | { kind: 'booking-doc'; category: BookingInvoiceDocumentKey }
  | { kind: 'payment-doc'; payment: BookingPayment };

export interface DocumentIssuancePolicy {
  canPreview: boolean;
  canIssue: boolean;
  allowedForClient: boolean;
  reason?: string;
}

/**
 * Single source of truth governing whether any booking-level document or ledger row
 * may be previewed, verified/issued to the Client Portal, or displayed to the client.
 */
export function evaluateDocumentIssuancePolicy(
  booking: Booking,
  target: ReleaseToggleTarget,
  payments: BookingPayment[] = []
): DocumentIssuancePolicy {
  const isCancelled = booking.status === 'Cancelled';
  const isOnHold = booking.status === 'On Hold';
  const settlement = computeCancellationSettlement(booking, payments);

  if (target.kind === 'booking-doc') {
    switch (target.category) {
      case 'booking-summary': {
        if (isCancelled) {
          return {
            canPreview: false,
            canIssue: false,
            allowedForClient: false,
            reason: 'Allotment invoices cannot be issued on cancelled bookings.',
          };
        }
        if (isOnHold) {
          return {
            canPreview: true,
            canIssue: false,
            allowedForClient: true,
            reason: 'New issuance paused while booking is On Hold.',
          };
        }
        return { canPreview: true, canIssue: true, allowedForClient: true };
      }

      case 'outstanding-bundle': {
        if (isCancelled) {
          return {
            canPreview: false,
            canIssue: false,
            allowedForClient: false,
            reason: 'No outstanding demand invoices on cancelled bookings.',
          };
        }
        if (isOnHold) {
          return {
            canPreview: true,
            canIssue: false,
            allowedForClient: false,
            reason: 'Demand billing is paused while booking is On Hold.',
          };
        }
        if ((Number(booking.balanceDue) || 0) <= 0) {
          return {
            canPreview: true,
            canIssue: false,
            allowedForClient: false,
            reason: 'Booking has zero outstanding balance.',
          };
        }
        return { canPreview: true, canIssue: true, allowedForClient: true };
      }

      case 'receipts-summary': {
        if (settlement.grossCollected <= 0) {
          return {
            canPreview: false,
            canIssue: false,
            allowedForClient: false,
            reason: 'No realized payments have been recorded yet.',
          };
        }
        return { canPreview: true, canIssue: true, allowedForClient: true };
      }

      case 'account-statement': {
        return { canPreview: true, canIssue: true, allowedForClient: true };
      }

      case 'cancellation-settlement': {
        if (isCancelled) {
          return { canPreview: true, canIssue: true, allowedForClient: true };
        }
        return {
          canPreview: false,
          canIssue: false,
          allowedForClient: false,
          reason: 'Available only for cancelled bookings.',
        };
      }

      default:
        return { canPreview: false, canIssue: false, allowedForClient: false };
    }
  }

  // Individual payment / ledger item policy
  const { payment } = target;
  if (payment.status === 'Voided') {
    return {
      canPreview: false,
      canIssue: false,
      allowedForClient: false,
      reason: 'Voided obligation — cannot be invoiced.',
    };
  }

  if (isCancellationFeeRow(payment)) {
    return {
      canPreview: false,
      canIssue: false,
      allowedForClient: false,
      reason: 'Reflected in Cancellation & Final Settlement Statement.',
    };
  }

  if (isRefundPaymentRow(payment)) {
    const disbursed = Math.abs(Number(payment.receivedAmount) || 0);
    if (disbursed > 0) {
      return { canPreview: true, canIssue: true, allowedForClient: true };
    }
    return {
      canPreview: true,
      canIssue: false,
      allowedForClient: false,
      reason: 'Disburse the refund before issuing an Official Refund Voucher.',
    };
  }

  const received = Number(payment.receivedAmount) || 0;
  const scheduled = Number(payment.scheduledAmount) || 0;

  if (scheduled < 0 || payment.status === 'Waived') {
    return { canPreview: true, canIssue: true, allowedForClient: true };
  }

  if (
    received > 0 &&
    (payment.status === 'Paid' ||
      payment.status === 'Partially Paid' ||
      payment.status === 'Partially Paid (Closed)')
  ) {
    return { canPreview: true, canIssue: true, allowedForClient: true };
  }

  // Unpaid demand invoice
  if (isCancelled) {
    return {
      canPreview: false,
      canIssue: false,
      allowedForClient: false,
      reason: 'Demand invoices are blocked on cancelled bookings.',
    };
  }
  if (isOnHold) {
    return {
      canPreview: true,
      canIssue: false,
      allowedForClient: false,
      reason: 'Demand invoices cannot be issued while booking is On Hold.',
    };
  }

  return { canPreview: true, canIssue: true, allowedForClient: true };
}

/**
 * Determines whether a single payment ledger entry has been verified/issued
 * for read-only viewing & download in the Client User Dashboard.
 */
export function isPaymentInvoiceAuthorizedForClient(
  booking: Booking,
  payment: BookingPayment,
  manifest = parseInvoiceReleaseManifest(booking)
): boolean {
  const policy = evaluateDocumentIssuancePolicy(booking, { kind: 'payment-doc', payment });
  if (!policy.allowedForClient) return false;

  const explicit = manifest.paymentDocs[payment.id];
  const isSettledPayment =
    !isRefundPaymentRow(payment) &&
    !isCancellationFeeRow(payment) &&
    Number(payment.scheduledAmount) >= 0 &&
    (payment.status === 'Paid' ||
      payment.status === 'Partially Paid' ||
      payment.status === 'Partially Paid (Closed)') &&
    Number(payment.receivedAmount) > 0;

  if (explicit) {
    if (explicit.status === 'withheld') return false;
    if (explicit.status === 'issued') return true;
  }

  return isSettledPayment;
}

/**
 * Determines whether a booking-wide master document has been
 * explicitly verified & issued by Admin / Super Admin for client access.
 */
export function isBookingDocAuthorizedForClient(
  booking: Booking,
  category: BookingInvoiceDocumentKey,
  manifest = parseInvoiceReleaseManifest(booking),
  payments: BookingPayment[] = []
): boolean {
  const policy = evaluateDocumentIssuancePolicy(
    booking,
    { kind: 'booking-doc', category },
    payments
  );
  if (!policy.allowedForClient) return false;

  const explicit = manifest.bookingDocs[category];
  return Boolean(explicit && explicit.status === 'issued');
}

export function getClientAuthorizedBookingCategories(
  booking: Booking,
  manifest = parseInvoiceReleaseManifest(booking),
  payments: BookingPayment[] = []
): BookingInvoiceDocumentKey[] {
  const order: BookingInvoiceDocumentKey[] = [
    'cancellation-settlement',
    'booking-summary',
    'account-statement',
    'outstanding-bundle',
    'receipts-summary',
  ];
  return order.filter((category) =>
    isBookingDocAuthorizedForClient(booking, category, manifest, payments)
  );
}

export function getClientAuthorizedPayments(
  booking: Booking,
  payments: BookingPayment[],
  manifest = parseInvoiceReleaseManifest(booking)
): BookingPayment[] {
  return payments.filter((p) => isPaymentInvoiceAuthorizedForClient(booking, p, manifest));
}

export function getClientTotalAuthorizedDocumentsCount(
  booking: Booking,
  payments: BookingPayment[]
): number {
  const manifest = parseInvoiceReleaseManifest(booking);
  const bookingDocCount = getClientAuthorizedBookingCategories(
    booking,
    manifest,
    payments
  ).length;
  const paymentDocCount = getClientAuthorizedPayments(booking, payments, manifest).length;
  return bookingDocCount + paymentDocCount;
}

export function resolveDefaultClientDocumentSelection(
  booking: Booking,
  payments: BookingPayment[]
): { category: InvoiceCategory; paymentId?: string } | null {
  const manifest = parseInvoiceReleaseManifest(booking);
  const authorizedCategories = getClientAuthorizedBookingCategories(booking, manifest, payments);
  const authorizedPayments = getClientAuthorizedPayments(booking, payments, manifest);

  const preferredOrder: BookingInvoiceDocumentKey[] =
    booking.status === 'Cancelled'
      ? ['cancellation-settlement', 'account-statement', 'receipts-summary']
      : ['account-statement', 'booking-summary', 'outstanding-bundle', 'receipts-summary'];

  const firstCategory = preferredOrder.find((c) => authorizedCategories.includes(c));
  if (firstCategory) {
    return {
      category: firstCategory,
      paymentId: authorizedPayments[0]?.id,
    };
  }

  if (authorizedPayments.length > 0) {
    const preferredPayment =
      authorizedPayments.find(
        (p) =>
          p.status === 'Refunded' ||
          p.status === 'Paid' ||
          p.status === 'Partially Paid' ||
          p.status === 'Partially Paid (Closed)'
      ) ?? authorizedPayments[0];
    if (preferredPayment) {
      return {
        category: classifyPaymentDocumentCategory(preferredPayment).category,
        paymentId: preferredPayment.id,
      };
    }
  }

  return null;
}

export function getDocumentVerificationInfo(
  booking: Booking,
  category: InvoiceCategory,
  payment?: BookingPayment | null,
  payments: BookingPayment[] = []
): { verified: boolean; issuedBy?: string; issuedAt?: string; verificationCode?: string } {
  const manifest = parseInvoiceReleaseManifest(booking);

  if (isBookingDocKey(category)) {
    const policy = evaluateDocumentIssuancePolicy(
      booking,
      { kind: 'booking-doc', category },
      payments
    );
    if (!policy.allowedForClient) return { verified: false };
    const entry = manifest.bookingDocs[category];
    if (entry?.status === 'issued') {
      return {
        verified: true,
        issuedBy: entry.issuedBy,
        issuedAt: entry.issuedAt,
        verificationCode: entry.verificationCode,
      };
    }
    return { verified: false };
  }

  if (!payment) return { verified: false };
  const policy = evaluateDocumentIssuancePolicy(
    booking,
    { kind: 'payment-doc', payment },
    payments
  );
  if (!policy.allowedForClient) return { verified: false };

  const pEntry = manifest.paymentDocs[payment.id];
  if (pEntry?.status === 'withheld') return { verified: false };
  if (pEntry?.status === 'issued') {
    return {
      verified: true,
      issuedBy: pEntry.issuedBy,
      issuedAt: pEntry.issuedAt,
      verificationCode: pEntry.verificationCode,
    };
  }
  if (
    !isRefundPaymentRow(payment) &&
    !isCancellationFeeRow(payment) &&
    (payment.status === 'Paid' ||
      payment.status === 'Partially Paid' ||
      payment.status === 'Partially Paid (Closed)') &&
    Number(payment.receivedAmount) > 0
  ) {
    return {
      verified: true,
      issuedBy: 'Viridian Nexus Finance',
      issuedAt: payment.paidDate || payment.updatedAt,
      verificationCode: generateVerificationCode(`${booking.id}:${payment.id}`),
    };
  }

  return { verified: false };
}

export function withBookingDocRelease(
  manifest: BookingInvoiceReleaseManifest,
  category: BookingInvoiceDocumentKey,
  status: InvoiceReleaseStatus,
  actor: { name: string; id?: string | null },
  timestamp = new Date().toISOString()
): BookingInvoiceReleaseManifest {
  return {
    ...manifest,
    bookingDocs: {
      ...manifest.bookingDocs,
      [category]: {
        status,
        issuedBy: actor.name,
        issuedById: actor.id ?? null,
        issuedAt: timestamp,
        verificationCode: generateVerificationCode(`${category}:${actor.name}:${timestamp}`),
      },
    },
  };
}

export function withPaymentDocRelease(
  manifest: BookingInvoiceReleaseManifest,
  payment: BookingPayment,
  status: InvoiceReleaseStatus,
  actor: { name: string; id?: string | null },
  timestamp = new Date().toISOString()
): BookingInvoiceReleaseManifest {
  const docMeta = classifyPaymentDocumentCategory(payment);
  return {
    ...manifest,
    paymentDocs: {
      ...manifest.paymentDocs,
      [payment.id]: {
        paymentId: payment.id,
        category: docMeta.category,
        status,
        issuedBy: actor.name,
        issuedById: actor.id ?? null,
        issuedAt: timestamp,
        verificationCode: generateVerificationCode(`${payment.id}:${docMeta.category}`),
      },
    },
  };
}

/**
 * Automatically withdraws active allotment, outstanding demand bundles, and unpaid demand invoices
 * when a booking is cancelled, while preserving historical Statements of Account, Receipts, and Credit Notes.
 */
export function revokeActiveDocsOnCancellation(
  manifest: BookingInvoiceReleaseManifest,
  payments: BookingPayment[],
  actor: { name: string; id?: string | null },
  timestamp = new Date().toISOString()
): BookingInvoiceReleaseManifest {
  const nextBookingDocs = { ...manifest.bookingDocs };
  const nextPaymentDocs = { ...manifest.paymentDocs };

  const withdrawBookingDoc = (category: BookingInvoiceDocumentKey) => {
    const existing = nextBookingDocs[category];
    if (existing?.status === 'issued') {
      nextBookingDocs[category] = {
        ...existing,
        status: 'withheld',
        issuedBy: actor.name,
        issuedById: actor.id ?? null,
        issuedAt: timestamp,
      };
    }
  };

  withdrawBookingDoc('booking-summary');
  withdrawBookingDoc('outstanding-bundle');

  const grossCollected = payments.reduce((sum, p) => {
    if (isRefundPaymentRow(p) || isCancellationFeeRow(p) || Number(p.scheduledAmount) < 0) {
      return sum;
    }
    return sum + Math.max(0, Number(p.receivedAmount) || 0);
  }, 0);
  if (grossCollected <= 0) {
    withdrawBookingDoc('receipts-summary');
  }

  for (const payment of payments) {
    const existing = nextPaymentDocs[payment.id];
    const shouldWithdraw =
      isUnpaidObligationRow(payment) ||
      payment.status === 'Voided' ||
      existing?.category === 'demand-invoice';
    if (shouldWithdraw && existing?.status === 'issued') {
      nextPaymentDocs[payment.id] = {
        ...existing,
        status: 'withheld',
        issuedBy: actor.name,
        issuedById: actor.id ?? null,
        issuedAt: timestamp,
      };
    }
  }

  return {
    ...manifest,
    bookingDocs: nextBookingDocs,
    paymentDocs: nextPaymentDocs,
  };
}
