import { COMPANY_INFO } from '../data/companyInfo.js';
import type { Booking, BookingPayment } from '../types/index.js';
import {
  buildInvoiceDocument,
  classifyPaymentDocumentCategory,
  type InvoiceCategory,
  type InvoiceDocument,
} from './invoiceBuilder.js';
import {
  type BookingInvoiceDocumentKey,
  type ReleaseToggleTarget,
} from './invoicePolicy.js';

export type DocumentVerificationVerdict =
  | 'VERIFIED'
  | 'VERIFIED_HISTORICAL_CANCELLED'
  | 'REVOKED'
  | 'UNISSUED_DRAFT'
  | 'INVALID_CODE'
  | 'NOT_FOUND';

export interface VerifiedDocumentSummary {
  invoiceNumber: string;
  documentTitle: string;
  category: InvoiceCategory;
  bookingRef: string;
  verificationCodeMatched: boolean | null;
  issuedBy?: string;
  issuedAt?: string;
  clientNameMasked: string;
  propertyName: string;
  propertyLocation: string;
  unitSummary: string;
  bookingStatus: string;
  bookingStage: string;
  documentAmountLabel?: string;
  documentAmount?: number;
  refundStatusLabel?: string;
}

export interface DocumentVerificationResponse {
  verdict: DocumentVerificationVerdict;
  headline: string;
  message: string;
  verifiedAt: string;
  document: VerifiedDocumentSummary | null;
  adminBookingId?: string;
}

/**
 * Strips a leading "VN-" from canonical booking references (e.g. "VN-2026-8687" -> "2026-8687")
 * so invoice numbers read cleanly as "VN-CXL-2026-8687" instead of "VN-CXL-VN-2026-8687".
 */
export function normalizeInvoiceRefCode(bookingRef: string): string {
  const trimmed = bookingRef.trim();
  return /^VN-/i.test(trimmed) ? trimmed.slice(3) : trimmed;
}

/**
 * Privacy-safe masking for public verification screens (e.g. "Rahim Chowdhury" -> "R***m C*******y").
 */
export function maskClientName(name?: string | null): string {
  const cleaned = (name || '').trim();
  if (!cleaned) return 'Valued Client';

  return cleaned
    .split(/\s+/)
    .map((word) => {
      if (word.length <= 1) return '*';
      if (word.length === 2) return `${word[0]}*`;
      return `${word[0]}${'*'.repeat(word.length - 2)}${word[word.length - 1]}`;
    })
    .join(' ');
}

/**
 * Builds the live scannable `/verify` URL encoded in invoice, receipt, and refund voucher QR codes.
 */
export function buildDocumentVerificationUrl(params: {
  origin?: string;
  bookingRef: string;
  invoiceNumber: string;
  verificationCode?: string;
}): string {
  const rawOrigin = (params.origin || COMPANY_INFO.websiteUrl).trim().replace(/\/+$/, '');
  const query = new URLSearchParams({
    ref: params.bookingRef,
    doc: params.invoiceNumber,
  });
  if (params.verificationCode) {
    query.set('code', params.verificationCode);
  }
  return `${rawOrigin}/verify?${query.toString()}`;
}

export interface ResolvedDocumentMatch {
  category: InvoiceCategory;
  target: ReleaseToggleTarget;
  doc: InvoiceDocument;
  payment?: BookingPayment;
}

const BOOKING_LEVEL_CATEGORIES: BookingInvoiceDocumentKey[] = [
  'booking-summary',
  'account-statement',
  'outstanding-bundle',
  'receipts-summary',
  'cancellation-settlement',
];

function matchesInvoiceNumber(
  candidateInvoiceNumber: string,
  targetUpper: string,
  bookingRef: string
): boolean {
  const upperCandidate = candidateInvoiceNumber.toUpperCase();
  if (upperCandidate === targetUpper) return true;

  // Backward compatibility: also match historical double-prefix format (e.g. VN-CXL-VN-2026-8687)
  if (/^VN-/i.test(bookingRef)) {
    const shortRef = normalizeInvoiceRefCode(bookingRef).toUpperCase();
    const legacyCandidate = upperCandidate.replace(`-${shortRef}`, `-${bookingRef.toUpperCase()}`);
    if (legacyCandidate === targetUpper) return true;
  }

  return false;
}

/**
 * Maps an invoice / voucher / statement number back to its live booking document or payment row.
 */
export function resolveDocumentTargetFromInvoiceNumber(
  booking: Booking,
  payments: BookingPayment[],
  invoiceNumber: string
): ResolvedDocumentMatch | null {
  const targetUpper = (invoiceNumber || '').trim().toUpperCase();
  if (!targetUpper) return null;

  const ref = booking.bookingRef || `VN-${booking.id.slice(0, 8).toUpperCase()}`;

  for (const category of BOOKING_LEVEL_CATEGORIES) {
    const doc = buildInvoiceDocument({
      booking,
      payments,
      category,
      audience: 'client',
    });
    if (matchesInvoiceNumber(doc.invoiceNumber, targetUpper, ref)) {
      return {
        category,
        target: { kind: 'booking-doc', category },
        doc,
      };
    }
  }

  for (const payment of payments) {
    const { category } = classifyPaymentDocumentCategory(payment);
    const doc = buildInvoiceDocument({
      booking,
      payments,
      category,
      targetPaymentId: payment.id,
      audience: 'client',
    });
    if (matchesInvoiceNumber(doc.invoiceNumber, targetUpper, ref)) {
      return {
        category,
        target: { kind: 'payment-doc', payment },
        doc,
        payment,
      };
    }
  }

  return null;
}
