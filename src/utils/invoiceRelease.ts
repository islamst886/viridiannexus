import { supabase } from '../supabase';
import type { Booking, BookingPayment } from '../types';
import { classifyPaymentDocumentCategory, formatPaymentLabel, type InvoiceCategory } from './invoiceBuilder';

export type BookingInvoiceDocumentKey =
  | 'booking-summary'
  | 'account-statement'
  | 'outstanding-bundle'
  | 'receipts-summary';

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
    category === 'receipts-summary'
  );
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
  const explicit = manifest.paymentDocs[payment.id];
  const isCancelled = booking.status === 'Cancelled';
  const isSettledPayment =
    (payment.status === 'Paid' || payment.status === 'Partially Paid') &&
    Number(payment.receivedAmount) > 0;

  if (explicit) {
    if (explicit.status === 'withheld') return false;
    if (explicit.status === 'issued') {
      // On cancelled bookings, hide uncollected demand invoices even if previously issued
      if (isCancelled && explicit.category === 'demand-invoice' && !isSettledPayment) {
        return false;
      }
      return true;
    }
  }

  // Payments already verified & recorded in Finance ledger (Paid / Partially Paid)
  // are automatically treated as verified Client Payment Receipts unless withheld.
  return isSettledPayment;
}

/**
 * Determines whether a booking-wide master document (Allotment Invoice,
 * Statement of Account, Outstanding Invoice, Receipts Summary) has been
 * explicitly verified & issued by Admin / Super Admin for client access.
 */
export function isBookingDocAuthorizedForClient(
  booking: Booking,
  category: BookingInvoiceDocumentKey,
  manifest = parseInvoiceReleaseManifest(booking)
): boolean {
  const explicit = manifest.bookingDocs[category];
  if (!explicit || explicit.status !== 'issued') return false;
  if (booking.status === 'Cancelled' && category === 'outstanding-bundle') {
    return false;
  }
  return true;
}

export function getClientAuthorizedBookingCategories(
  booking: Booking,
  manifest = parseInvoiceReleaseManifest(booking)
): BookingInvoiceDocumentKey[] {
  const order: BookingInvoiceDocumentKey[] = [
    'booking-summary',
    'account-statement',
    'outstanding-bundle',
    'receipts-summary',
  ];
  return order.filter((category) => isBookingDocAuthorizedForClient(booking, category, manifest));
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
  const bookingDocCount = getClientAuthorizedBookingCategories(booking, manifest).length;
  const paymentDocCount = getClientAuthorizedPayments(booking, payments, manifest).length;
  return bookingDocCount + paymentDocCount;
}

export function resolveDefaultClientDocumentSelection(
  booking: Booking,
  payments: BookingPayment[]
): { category: InvoiceCategory; paymentId?: string } | null {
  const manifest = parseInvoiceReleaseManifest(booking);
  const authorizedCategories = getClientAuthorizedBookingCategories(booking, manifest);
  const authorizedPayments = getClientAuthorizedPayments(booking, payments, manifest);

  const preferredOrder: BookingInvoiceDocumentKey[] = [
    'account-statement',
    'booking-summary',
    'outstanding-bundle',
    'receipts-summary',
  ];
  const firstCategory = preferredOrder.find((c) => authorizedCategories.includes(c));
  if (firstCategory) {
    return {
      category: firstCategory,
      paymentId: authorizedPayments[0]?.id,
    };
  }

  if (authorizedPayments.length > 0) {
    const preferredPayment =
      authorizedPayments.find((p) => p.status === 'Paid' || p.status === 'Partially Paid') ??
      authorizedPayments[0];
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
  payment?: BookingPayment | null
): { verified: boolean; issuedBy?: string; issuedAt?: string; verificationCode?: string } {
  const manifest = parseInvoiceReleaseManifest(booking);

  if (isBookingDocKey(category)) {
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
  if ((payment.status === 'Paid' || payment.status === 'Partially Paid') && Number(payment.receivedAmount) > 0) {
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

export type ReleaseToggleTarget =
  | { kind: 'booking-doc'; category: BookingInvoiceDocumentKey }
  | { kind: 'payment-doc'; payment: BookingPayment };

/**
 * Admin / Super Admin action that verifies & issues (or withdraws) a booking document
 * or individual payment invoice into the client-visible portal manifest stored on `bookings`.
 */
export async function persistBookingInvoiceRelease(params: {
  booking: Booking;
  target: ReleaseToggleTarget;
  nextStatus: InvoiceReleaseStatus;
  actorName: string;
  actorId?: string | null;
}): Promise<Booking> {
  const { booking, target, nextStatus, actorName, actorId } = params;
  const currentManifest = parseInvoiceReleaseManifest(booking);
  const nowIso = new Date().toISOString();

  const nextManifest =
    target.kind === 'booking-doc'
      ? withBookingDocRelease(
          currentManifest,
          target.category,
          nextStatus,
          { name: actorName, id: actorId },
          nowIso
        )
      : withPaymentDocRelease(
          currentManifest,
          target.payment,
          nextStatus,
          { name: actorName, id: actorId },
          nowIso
        );

  const nextNotes = mergeInvoiceReleaseManifestIntoNotes(booking.notes, nextManifest);

  const { error: updateErr } = await supabase
    .from('bookings')
    .update({
      notes: nextNotes,
      last_updated_by: actorId ?? null,
      updated_at: nowIso,
    })
    .eq('id', booking.id);
  if (updateErr) throw updateErr;

  const docLabel =
    target.kind === 'booking-doc'
      ? BOOKING_INVOICE_DOC_LABELS[target.category]
      : `${formatPaymentLabel(target.payment)} (${classifyPaymentDocumentCategory(target.payment).actionLabel})`;

  await supabase.from('booking_activity_log').insert({
    booking_id: booking.id,
    type: nextStatus === 'issued' ? 'Invoice Issued to Client' : 'Invoice Withheld from Client',
    message:
      nextStatus === 'issued'
        ? `${docLabel} verified & issued to Client Dashboard by ${actorName}`
        : `${docLabel} withdrawn from Client Dashboard visibility by ${actorName}`,
    actor_name: actorName,
    actor_id: actorId ?? null,
  });

  return {
    ...booking,
    notes: nextNotes,
    updatedAt: nowIso,
  };
}
