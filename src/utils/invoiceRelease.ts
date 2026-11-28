import { supabase } from '../supabase';
import type { Booking, BookingPayment } from '../types';
import { classifyPaymentDocumentCategory, formatPaymentLabel } from './invoiceBuilder';
import {
  BOOKING_INVOICE_DOC_LABELS,
  evaluateDocumentIssuancePolicy,
  mergeInvoiceReleaseManifestIntoNotes,
  parseInvoiceReleaseManifest,
  withBookingDocRelease,
  withPaymentDocRelease,
  type BookingInvoiceDocumentKey,
  type InvoiceReleaseStatus,
  type ReleaseToggleTarget,
} from './invoicePolicy';

export {
  BOOKING_INVOICE_DOC_LABELS,
  evaluateDocumentIssuancePolicy,
  generateCanonicalBookingDocCode,
  generateCanonicalPaymentDocCode,
  getAcceptedVerificationCodes,
  getClientAuthorizedBookingCategories,
  getClientAuthorizedPayments,
  getClientTotalAuthorizedDocumentsCount,
  getDocumentVerificationInfo,
  isBookingDocAuthorizedForClient,
  isBookingDocKey,
  isPaymentInvoiceAuthorizedForClient,
  mergeInvoiceReleaseManifestIntoNotes,
  parseInvoiceReleaseManifest,
  resolveDefaultClientDocumentSelection,
  revokeActiveDocsOnCancellation,
  stripInvoiceReleaseManifestMarker,
  withBookingDocRelease,
  withPaymentDocRelease,
  type BookingInvoiceDocumentKey,
  type BookingInvoiceReleaseManifest,
  type DocumentIssuancePolicy,
  type InvoiceReleaseStatus,
  type IssuedBookingDocRecord,
  type IssuedPaymentDocRecord,
  type ReleaseToggleTarget,
} from './invoicePolicy';

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
  payments?: BookingPayment[];
}): Promise<Booking> {
  const { booking, target, nextStatus, actorName, actorId, payments = [] } = params;

  if (nextStatus === 'issued') {
    const policy = evaluateDocumentIssuancePolicy(booking, target, payments);
    if (!policy.canIssue) {
      throw new Error(policy.reason || 'Document cannot be issued for this booking status.');
    }
  }

  const currentManifest = parseInvoiceReleaseManifest(booking);
  const nowIso = new Date().toISOString();

  const nextManifest =
    target.kind === 'booking-doc'
      ? withBookingDocRelease(
          currentManifest,
          target.category as BookingInvoiceDocumentKey,
          nextStatus,
          { name: actorName, id: actorId },
          nowIso,
          booking.id
        )
      : withPaymentDocRelease(
          currentManifest,
          target.payment,
          nextStatus,
          { name: actorName, id: actorId },
          nowIso,
          booking.id
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
