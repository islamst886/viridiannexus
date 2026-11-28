import type {
  Booking,
  BookingDBRow,
  BookingPayment,
  BookingPaymentDBRow,
} from '../types/index.js';
import { computeCancellationSettlement } from './bookingCancellation.js';
import {
  maskClientName,
  resolveDocumentTargetFromInvoiceNumber,
  type DocumentVerificationResponse,
  type VerifiedDocumentSummary,
} from './documentVerification.js';
import {
  evaluateDocumentIssuancePolicy,
  getAcceptedVerificationCodes,
  getDocumentVerificationInfo,
  isBookingDocKey,
  parseInvoiceReleaseManifest,
} from './invoicePolicy.js';
import { mapBookingFromDB, mapPaymentFromDB } from './mappers.js';

export interface VerifyDocumentEnv {
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

export interface VerifyDocumentDeps {
  fetchFn?: typeof fetch;
  now?: () => Date;
}

interface SupabaseAuthUserResponse {
  id?: string;
}

interface ProfileRoleRow {
  role?: string | null;
  is_banned?: boolean | null;
}

const SUPABASE_API_SUFFIX_RE = /\/+(?:rest|auth|storage|realtime)\/v1\/?$/i;
const SAFE_DOC_TOKEN_RE = /^[A-Za-z0-9._-]+$/;

function jsonVerifyResponse(payload: DocumentVerificationResponse, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      'cache-control': 'no-store',
    },
  });
}

function normalizeSupabaseBaseUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    if (parsed.username || parsed.password) return '';
    const cleanedPath = parsed.pathname.replace(SUPABASE_API_SUFFIX_RE, '').replace(/\/+$/, '');
    return `${parsed.origin}${cleanedPath}`;
  } catch {
    return '';
  }
}

function isValidToken(value: string, maxLen: number): boolean {
  return value.length > 0 && value.length <= maxLen && SAFE_DOC_TOKEN_RE.test(value);
}

async function resolveAdminRole(params: {
  authHeader: string | null;
  baseUrl: string;
  serviceKey: string;
  anonKey: string;
  fetchFn: typeof fetch;
}): Promise<boolean> {
  const { authHeader, baseUrl, serviceKey, anonKey, fetchFn } = params;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  if (!token) return false;

  try {
    const userRes = await fetchFn(`${baseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey || serviceKey,
      },
    });
    if (!userRes.ok) return false;
    const userData = (await userRes.json().catch(() => null)) as SupabaseAuthUserResponse | null;
    if (!userData?.id) return false;

    const profileRes = await fetchFn(
      `${baseUrl}/rest/v1/profiles?select=role,is_banned&id=eq.${encodeURIComponent(userData.id)}&limit=1`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
      }
    );
    if (!profileRes.ok) return false;
    const rows = (await profileRes.json().catch(() => null)) as ProfileRoleRow[] | null;
    const profile = Array.isArray(rows) ? rows[0] : undefined;
    if (!profile || profile.is_banned) return false;
    return profile.role === 'admin' || profile.role === 'super_admin';
  } catch {
    return false;
  }
}

function resolveAmountField(
  category: VerifiedDocumentSummary['category'],
  booking: Booking,
  doc: ReturnType<typeof resolveDocumentTargetFromInvoiceNumber>,
  settlement: ReturnType<typeof computeCancellationSettlement>
): { label: string; amount: number } {
  if (!doc) return { label: 'Amount', amount: 0 };
  switch (category) {
    case 'booking-summary':
      return { label: 'Agreed Contract Value', amount: doc.doc.financialSummary.totalAgreedPrice };
    case 'account-statement':
      return { label: 'Balance Due', amount: doc.doc.financialSummary.overallBalanceDue };
    case 'outstanding-bundle':
      return { label: 'Outstanding Amount', amount: doc.doc.financialSummary.documentNetAmount };
    case 'receipts-summary':
      return { label: 'Total Realized', amount: doc.doc.financialSummary.totalPaidInDoc };
    case 'payment-receipt':
      return { label: 'Amount Received', amount: doc.doc.financialSummary.totalPaidInDoc };
    case 'demand-invoice':
      return { label: 'Amount Payable', amount: doc.doc.financialSummary.documentNetAmount };
    case 'credit-note':
      return { label: 'Credited / Adjusted', amount: doc.doc.financialSummary.documentNetAmount };
    case 'cancellation-settlement':
      return settlement.grossCollected > 0
        ? { label: 'Net Refundable', amount: settlement.netRefundable }
        : { label: 'Closing Balance', amount: 0 };
    case 'refund-voucher':
      return doc.doc.financialSummary.totalPaidInDoc > 0
        ? { label: 'Refund Disbursed', amount: doc.doc.financialSummary.documentNetAmount }
        : { label: 'Net Refundable', amount: doc.doc.financialSummary.documentNetAmount };
    default:
      return {
        label: booking.status === 'Cancelled' ? 'Closing Balance' : 'Balance Due',
        amount: doc.doc.financialSummary.overallBalanceDue,
      };
  }
}

/**
 * Verifies an invoice, statement, payment receipt, cancellation settlement, or refund voucher
 * against live Supabase records without exposing sensitive PII to unauthenticated scanners.
 */
export async function handleVerifyDocumentRequest(
  request: Request,
  env: VerifyDocumentEnv,
  deps: VerifyDocumentDeps = {}
): Promise<Response> {
  const fetchFn = deps.fetchFn ?? fetch;
  const nowDate = deps.now ? deps.now() : new Date();
  const verifiedAt = nowDate.toISOString();

  if (request.method !== 'GET' && request.method !== 'POST') {
    return jsonVerifyResponse(
      {
        verdict: 'NOT_FOUND',
        headline: 'Method Not Allowed',
        message: 'Only GET and POST requests are supported.',
        verifiedAt,
        document: null,
      },
      405
    );
  }

  let ref = '';
  let doc = '';
  let code = '';

  if (request.method === 'GET') {
    const reqUrl = new URL(request.url, 'https://viridiannexus.local');
    ref = (reqUrl.searchParams.get('ref') || '').trim();
    doc = (reqUrl.searchParams.get('doc') || '').trim();
    code = (reqUrl.searchParams.get('code') || '').trim();
  } else {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    ref = typeof body?.ref === 'string' ? body.ref.trim() : '';
    doc = typeof body?.doc === 'string' ? body.doc.trim() : '';
    code = typeof body?.code === 'string' ? body.code.trim() : '';
  }

  if (!isValidToken(ref, 80) || !isValidToken(doc, 80)) {
    return jsonVerifyResponse(
      {
        verdict: 'NOT_FOUND',
        headline: 'Invalid Verification Request',
        message: 'Please provide both a valid Booking Reference and Invoice / Document Number.',
        verifiedAt,
        document: null,
      },
      400
    );
  }

  const baseUrl = normalizeSupabaseBaseUrl(env.SUPABASE_URL || env.VITE_SUPABASE_URL);
  const serviceKey = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const anonKey = (env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (!baseUrl || !serviceKey) {
    return jsonVerifyResponse(
      {
        verdict: 'NOT_FOUND',
        headline: 'Verification Service Unavailable',
        message: 'Document verification environment is not configured on the server.',
        verifiedAt,
        document: null,
      },
      503
    );
  }

  const serviceHeaders = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    'Content-Type': 'application/json',
  };

  try {
    const bookingRes = await fetchFn(
      `${baseUrl}/rest/v1/bookings?select=*&booking_ref=eq.${encodeURIComponent(ref)}&limit=1`,
      { method: 'GET', headers: serviceHeaders }
    );
    if (!bookingRes.ok) {
      return jsonVerifyResponse(
        {
          verdict: 'NOT_FOUND',
          headline: 'Verification Lookup Failed',
          message: 'Unable to query booking registry at this moment.',
          verifiedAt,
          document: null,
        },
        502
      );
    }

    const bookingRows = (await bookingRes.json().catch(() => null)) as BookingDBRow[] | null;
    const rawBooking = Array.isArray(bookingRows) ? bookingRows[0] : undefined;
    if (!rawBooking?.id) {
      return jsonVerifyResponse({
        verdict: 'NOT_FOUND',
        headline: 'Document Not Found',
        message: 'No booking record matches the provided Booking Reference.',
        verifiedAt,
        document: null,
      });
    }

    const booking = mapBookingFromDB(rawBooking);

    const paymentsRes = await fetchFn(
      `${baseUrl}/rest/v1/booking_payments?select=*&booking_id=eq.${encodeURIComponent(booking.id)}&order=due_date.asc.nullslast,installment_number.asc.nullslast,created_at.asc`,
      { method: 'GET', headers: serviceHeaders }
    );
    const rawPayments = paymentsRes.ok
      ? ((await paymentsRes.json().catch(() => [])) as BookingPaymentDBRow[] | null)
      : [];
    const payments: BookingPayment[] = Array.isArray(rawPayments)
      ? rawPayments.map((r) => mapPaymentFromDB(r))
      : [];

    const match = resolveDocumentTargetFromInvoiceNumber(booking, payments, doc);
    if (!match) {
      return jsonVerifyResponse({
        verdict: 'NOT_FOUND',
        headline: 'Document Not Found',
        message: 'No matching invoice, statement, receipt, or voucher was found for this booking.',
        verifiedAt,
        document: null,
      });
    }

    const isAdmin = await resolveAdminRole({
      authHeader: request.headers.get('authorization'),
      baseUrl,
      serviceKey,
      anonKey,
      fetchFn,
    });
    const adminBookingId = isAdmin ? booking.id : undefined;

    const policy = evaluateDocumentIssuancePolicy(booking, match.target, payments);
    const manifest = parseInvoiceReleaseManifest(booking);
    const verificationInfo = getDocumentVerificationInfo(
      booking,
      match.category,
      match.payment,
      payments
    );
    const settlement = computeCancellationSettlement(booking, payments);

    const isExplicitlyWithheld = isBookingDocKey(match.category)
      ? manifest.bookingDocs[match.category]?.status === 'withheld'
      : Boolean(match.payment && manifest.paymentDocs[match.payment.id]?.status === 'withheld');

    const unitSummary = `${match.doc.propertySummary.unitType}${
      match.doc.propertySummary.unitNumber !== 'TBD'
        ? ` (${match.doc.propertySummary.unitNumber})`
        : ''
    }`;
    const amountField = resolveAmountField(match.category, booking, match, settlement);

    const buildSummary = (
      codeMatched: boolean | null,
      includeAmount: boolean
    ): VerifiedDocumentSummary => ({
      invoiceNumber: match.doc.invoiceNumber,
      documentTitle: match.doc.documentTitle,
      category: match.category,
      bookingRef: booking.bookingRef,
      verificationCodeMatched: codeMatched,
      issuedBy: verificationInfo.issuedBy,
      issuedAt: verificationInfo.issuedAt,
      clientNameMasked: maskClientName(booking.clientName),
      propertyName: booking.propertyName || 'Viridian Nexus Residence',
      propertyLocation: booking.propertyLocation || 'Dhaka, Bangladesh',
      unitSummary,
      bookingStatus: booking.status || 'Active',
      bookingStage: booking.stage || 'EOI',
      ...(includeAmount
        ? {
            documentAmountLabel: amountField.label,
            documentAmount: amountField.amount,
          }
        : {}),
      ...(booking.status === 'Cancelled'
        ? { refundStatusLabel: settlement.settlementStatusLabel }
        : {}),
    });

    if (!policy.allowedForClient) {
      return jsonVerifyResponse({
        verdict: 'REVOKED',
        headline: 'Document Revoked / No Longer Valid',
        message:
          policy.reason ||
          'This document is no longer valid under the current booking status.',
        verifiedAt,
        document: buildSummary(null, true),
        ...(adminBookingId ? { adminBookingId } : {}),
      });
    }

    if (isExplicitlyWithheld) {
      return jsonVerifyResponse({
        verdict: 'REVOKED',
        headline: 'Document Withdrawn by Finance',
        message:
          'This document has been withdrawn from active issuance by Viridian Nexus Finance.',
        verifiedAt,
        document: buildSummary(null, false),
        ...(adminBookingId ? { adminBookingId } : {}),
      });
    }

    if (!verificationInfo.verified) {
      return jsonVerifyResponse({
        verdict: 'UNISSUED_DRAFT',
        headline: 'Unissued Internal Copy',
        message:
          'A matching booking exists, but this document has not been formally verified and issued by Finance yet.',
        verifiedAt,
        document: buildSummary(null, false),
        ...(adminBookingId ? { adminBookingId } : {}),
      });
    }

    const acceptedCodes = getAcceptedVerificationCodes(
      booking,
      match.category,
      match.payment,
      payments
    );
    const providedCode = code.toUpperCase();
    if (providedCode) {
      if (!SAFE_DOC_TOKEN_RE.test(code) || !acceptedCodes.includes(providedCode)) {
        return jsonVerifyResponse({
          verdict: 'INVALID_CODE',
          headline: 'Verification Code Mismatch',
          message:
            'The scanned or entered verification code does not match our official Finance registry. This document may have been altered.',
          verifiedAt,
          document: null,
          ...(adminBookingId ? { adminBookingId } : {}),
        });
      }
    }

    const codeMatched = providedCode ? true : null;

    if (
      booking.status === 'Cancelled' &&
      (match.category === 'payment-receipt' || match.category === 'receipts-summary')
    ) {
      return jsonVerifyResponse({
        verdict: 'VERIFIED_HISTORICAL_CANCELLED',
        headline: 'Authentic Historical Receipt (Booking Cancelled)',
        message:
          'This payment receipt is authentic and reflects realized funds, though the booking was subsequently cancelled. Please consult the Cancellation & Final Settlement Statement for refund status.',
        verifiedAt,
        document: buildSummary(codeMatched, true),
        ...(adminBookingId ? { adminBookingId } : {}),
      });
    }

    if (match.supersededBySettledReceipt) {
      return jsonVerifyResponse({
        verdict: 'VERIFIED',
        headline: 'Official Invoice Verified · Already Settled',
        message: `This demand invoice is authentic and has since been settled under ${match.doc.documentTitle} (${match.doc.invoiceNumber}).`,
        verifiedAt,
        document: buildSummary(codeMatched, true),
        ...(adminBookingId ? { adminBookingId } : {}),
      });
    }

    return jsonVerifyResponse({
      verdict: 'VERIFIED',
      headline: 'Authentic Official Document Verified',
      message:
        'This document is authentic and matches the live Viridian Nexus Development Ltd. Finance ledger.',
      verifiedAt,
      document: buildSummary(codeMatched, true),
      ...(adminBookingId ? { adminBookingId } : {}),
    });
  } catch (err) {
    console.error('verifyDocument error:', err);
    return jsonVerifyResponse(
      {
        verdict: 'NOT_FOUND',
        headline: 'Verification Error',
        message: 'An unexpected error occurred while verifying this document.',
        verifiedAt,
        document: null,
      },
      500
    );
  }
}
