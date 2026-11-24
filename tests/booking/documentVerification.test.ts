import { describe, expect, it } from 'vitest';
import type { Booking, BookingDBRow, BookingPayment, BookingPaymentDBRow } from '../../src/types';
import {
  buildDocumentVerificationUrl,
  maskClientName,
  normalizeInvoiceRefCode,
  resolveDocumentTargetFromInvoiceNumber,
  type DocumentVerificationResponse,
} from '../../src/utils/documentVerification';
import {
  handleVerifyDocumentRequest,
  type VerifyDocumentEnv,
} from '../../src/utils/documentVerificationServer';
import { buildInvoiceDocument } from '../../src/utils/invoiceBuilder';
import {
  getDocumentVerificationInfo,
  mergeInvoiceReleaseManifestIntoNotes,
  parseInvoiceReleaseManifest,
  withBookingDocRelease,
} from '../../src/utils/invoiceRelease';

const BASE_ENV: VerifyDocumentEnv = {
  SUPABASE_URL: 'https://demo.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
  SUPABASE_ANON_KEY: 'anon-key',
};

function makeDbBooking(overrides: Partial<BookingDBRow> = {}): BookingDBRow {
  return {
    id: 'bkg-secret-uuid-9991',
    booking_ref: 'VN-2026-8687',
    property_id: 'viridian-manor',
    property_name: 'Viridian Manor',
    property_location: 'Jolshiri Abashon, Dhaka',
    client_name: 'Rahim Chowdhury',
    client_email: 'rahim.private@example.com',
    client_phone: '+8801711998877',
    client_nid: '1990123456789',
    client_address: 'House 44, Road 12, Banani, Dhaka',
    linked_user_id: 'usr-123',
    unit_type: 'Unit A - 2850 sqft',
    unit_number: 'Floor 3, Unit A',
    parking_spot_ids: [],
    parking_price: 0,
    total_price: 12000000,
    total_paid: 100000,
    balance_due: 11900000,
    down_payment_amount: 100000,
    stage: 'Down Payment Paid',
    status: 'Active',
    internal_notes: 'Confidential VIP discount memo',
    ...overrides,
  };
}

function makeDbPayments(bookingId = 'bkg-secret-uuid-9991'): BookingPaymentDBRow[] {
  return [
    {
      id: 'pay-dp-1',
      booking_id: bookingId,
      type: 'Down Payment',
      installment_number: null,
      scheduled_amount: 100000,
      received_amount: 100000,
      status: 'Paid',
      due_date: '2026-11-19',
      paid_date: '2026-11-19',
      payment_mode: 'Bank Transfer',
      notes: 'Ref: EBL-9001',
    },
    {
      id: 'pay-inst-1',
      booking_id: bookingId,
      type: 'Installment',
      installment_number: 1,
      scheduled_amount: 1700000,
      received_amount: 0,
      status: 'Scheduled',
      due_date: '2026-12-20',
      paid_date: null,
      payment_mode: 'Cash',
      notes: '',
    },
  ];
}

function createMockFetch(params: {
  bookings: BookingDBRow[];
  payments: BookingPaymentDBRow[];
  authUserId?: string | null;
  profileRole?: string | null;
  isBanned?: boolean;
}): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.includes('/rest/v1/bookings?')) {
      return new Response(JSON.stringify(params.bookings), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/rest/v1/booking_payments?')) {
      return new Response(JSON.stringify(params.payments), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/auth/v1/user')) {
      const auth =
        init?.headers && !Array.isArray(init.headers)
          ? (init.headers as Record<string, string>).Authorization
          : '';
      if (!params.authUserId || !auth?.includes('valid-token')) {
        return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
      }
      return new Response(JSON.stringify({ id: params.authUserId }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/rest/v1/profiles?')) {
      return new Response(
        JSON.stringify(
          params.profileRole
            ? [{ role: params.profileRole, is_banned: Boolean(params.isBanned) }]
            : []
        ),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify([]), { status: 404 });
  }) as typeof fetch;
}

describe('Live Privacy-Safe Document Verification Subsystem', () => {
  it('normalizes booking refs, masks client names cleanly, and builds scannable /verify URLs', () => {
    expect(normalizeInvoiceRefCode('VN-2026-8687')).toBe('2026-8687');
    expect(normalizeInvoiceRefCode('vn-2026-8687')).toBe('2026-8687');
    expect(normalizeInvoiceRefCode('BK-2026-001')).toBe('BK-2026-001');

    expect(maskClientName('Rahim Chowdhury')).toBe('R***m C*******y');
    expect(maskClientName('vctsong')).toBe('v*****g');
    expect(maskClientName('Ab Cd')).toBe('A* C*');
    expect(maskClientName('')).toBe('Valued Client');

    const url = buildDocumentVerificationUrl({
      origin: 'https://viridiannexus.com/',
      bookingRef: 'VN-2026-8687',
      invoiceNumber: 'VN-CXL-2026-8687',
      verificationCode: 'VN-1234ABC',
    });
    expect(url).toBe(
      'https://viridiannexus.com/verify?ref=VN-2026-8687&doc=VN-CXL-2026-8687&code=VN-1234ABC'
    );
  });

  it('produces clean non-duplicated invoice numbers and resolves both clean and legacy double-prefix numbers', () => {
    const booking: Booking = {
      id: 'bkg-1',
      bookingRef: 'VN-2026-8687',
      propertyId: 'viridian-manor',
      propertyName: 'Viridian Manor',
      propertyLocation: 'Jolshiri Abashon',
      clientName: 'Rahim Chowdhury',
      clientEmail: 'r@example.com',
      clientPhone: '017',
      unitType: 'Unit A',
      unitNumber: 'Floor 3',
      parkingSpotIds: [],
      parkingPrice: 0,
      totalPrice: 12000000,
      totalPaid: 100000,
      balanceDue: 0,
      downPaymentAmount: 100000,
      stage: 'Cancelled',
      status: 'Cancelled',
    };
    const payments: BookingPayment[] = [
      {
        id: 'pay-dp-1',
        bookingId: 'bkg-1',
        type: 'Down Payment',
        scheduledAmount: 100000,
        receivedAmount: 100000,
        status: 'Paid',
        paymentMode: 'Bank Transfer',
        notes: '',
      },
    ];

    const cxlDoc = buildInvoiceDocument({
      booking,
      payments,
      category: 'cancellation-settlement',
      verificationCode: 'VN-CXLHASH',
      verificationOrigin: 'https://viridiannexus.com',
    });
    expect(cxlDoc.invoiceNumber).toBe('VN-CXL-2026-8687');
    expect(cxlDoc.qrPayload).toBe(
      'https://viridiannexus.com/verify?ref=VN-2026-8687&doc=VN-CXL-2026-8687&code=VN-CXLHASH'
    );

    const dpReceipt = buildInvoiceDocument({
      booking,
      payments,
      category: 'payment-receipt',
      targetPaymentId: 'pay-dp-1',
    });
    expect(dpReceipt.invoiceNumber).toBe('VN-REC-2026-8687-DP');

    expect(
      resolveDocumentTargetFromInvoiceNumber(booking, payments, 'VN-CXL-2026-8687')?.category
    ).toBe('cancellation-settlement');
    expect(
      resolveDocumentTargetFromInvoiceNumber(booking, payments, 'VN-CXL-VN-2026-8687')?.category
    ).toBe('cancellation-settlement');
    expect(
      resolveDocumentTargetFromInvoiceNumber(booking, payments, 'VN-REC-2026-8687-DP')?.payment?.id
    ).toBe('pay-dp-1');
  });

  it('verifies authentic documents across VERIFIED and VERIFIED_HISTORICAL_CANCELLED while masking all PII', async () => {
    const dbBooking = makeDbBooking();
    const dbPayments = makeDbPayments();

    const code = 'VN-' + getDocumentVerificationInfo(
      {
        id: dbBooking.id!,
        bookingRef: dbBooking.booking_ref!,
        propertyId: dbBooking.property_id!,
        propertyName: dbBooking.property_name!,
        propertyLocation: dbBooking.property_location!,
        clientName: dbBooking.client_name!,
        clientEmail: dbBooking.client_email!,
        clientPhone: dbBooking.client_phone!,
        parkingSpotIds: [],
        parkingPrice: 0,
        totalPrice: 12000000,
        totalPaid: 100000,
        balanceDue: 11900000,
        downPaymentAmount: 100000,
        stage: 'Down Payment Paid',
        status: 'Active',
      },
      'payment-receipt',
      {
        id: 'pay-dp-1',
        bookingId: dbBooking.id!,
        type: 'Down Payment',
        scheduledAmount: 100000,
        receivedAmount: 100000,
        status: 'Paid',
        paymentMode: 'Bank Transfer',
        notes: 'Ref: EBL-9001',
      }
    ).verificationCode?.slice(3);

    const req = new Request(
      `https://viridiannexus.com/api/verifyDocument?ref=VN-2026-8687&doc=VN-REC-2026-8687-DP&code=${code}`
    );
    const res = await handleVerifyDocumentRequest(req, BASE_ENV, {
      fetchFn: createMockFetch({ bookings: [dbBooking], payments: dbPayments }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as DocumentVerificationResponse;

    expect(body.verdict).toBe('VERIFIED');
    expect(body.document?.clientNameMasked).toBe('R***m C*******y');
    expect(body.document?.verificationCodeMatched).toBe(true);
    expect(body.document?.documentAmount).toBe(100000);
    expect(body.adminBookingId).toBeUndefined();

    // Strict PII privacy audit
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('Rahim Chowdhury');
    expect(serialized).not.toContain('rahim.private@example.com');
    expect(serialized).not.toContain('+8801711998877');
    expect(serialized).not.toContain('1990123456789');
    expect(serialized).not.toContain('House 44, Road 12');
    expect(serialized).not.toContain('Confidential VIP');
    expect(serialized).not.toContain('bkg-secret-uuid-9991');

    // Cancelled booking with verified Down Payment receipt returns VERIFIED_HISTORICAL_CANCELLED
    const cancelledRes = await handleVerifyDocumentRequest(req, BASE_ENV, {
      fetchFn: createMockFetch({
        bookings: [makeDbBooking({ status: 'Cancelled', stage: 'Cancelled', balance_due: 0 })],
        payments: dbPayments,
      }),
    });
    const cancelledBody = (await cancelledRes.json()) as DocumentVerificationResponse;
    expect(cancelledBody.verdict).toBe('VERIFIED_HISTORICAL_CANCELLED');
  });

  it('detects REVOKED, UNISSUED_DRAFT, INVALID_CODE, and NOT_FOUND verdicts accurately', async () => {
    const dbBooking = makeDbBooking();
    const dbPayments = makeDbPayments();

    // 1. Unissued internal statement -> UNISSUED_DRAFT with amount omitted
    const draftRes = await handleVerifyDocumentRequest(
      new Request('https://viridiannexus.com/api/verifyDocument?ref=VN-2026-8687&doc=VN-STM-2026-8687'),
      BASE_ENV,
      { fetchFn: createMockFetch({ bookings: [dbBooking], payments: dbPayments }) }
    );
    const draftBody = (await draftRes.json()) as DocumentVerificationResponse;
    expect(draftBody.verdict).toBe('UNISSUED_DRAFT');
    expect(draftBody.document?.documentAmount).toBeUndefined();

    // 2. Tampered verification code on paid receipt -> INVALID_CODE with null document
    const badCodeRes = await handleVerifyDocumentRequest(
      new Request(
        'https://viridiannexus.com/api/verifyDocument?ref=VN-2026-8687&doc=VN-REC-2026-8687-DP&code=VN-TAMPERED'
      ),
      BASE_ENV,
      { fetchFn: createMockFetch({ bookings: [dbBooking], payments: dbPayments }) }
    );
    const badCodeBody = (await badCodeRes.json()) as DocumentVerificationResponse;
    expect(badCodeBody.verdict).toBe('INVALID_CODE');
    expect(badCodeBody.document).toBeNull();

    // 3. Previously issued Allotment Invoice on Cancelled booking -> REVOKED
    let manifest = parseInvoiceReleaseManifest(undefined);
    manifest = withBookingDocRelease(manifest, 'booking-summary', 'issued', { name: 'Admin' });
    const cancelledAllotBooking = makeDbBooking({
      status: 'Cancelled',
      stage: 'Cancelled',
      balance_due: 0,
      notes: mergeInvoiceReleaseManifestIntoNotes('', manifest),
    });
    const revokedRes = await handleVerifyDocumentRequest(
      new Request(
        'https://viridiannexus.com/api/verifyDocument?ref=VN-2026-8687&doc=VN-INV-2026-8687-MASTER'
      ),
      BASE_ENV,
      { fetchFn: createMockFetch({ bookings: [cancelledAllotBooking], payments: dbPayments }) }
    );
    const revokedBody = (await revokedRes.json()) as DocumentVerificationResponse;
    expect(revokedBody.verdict).toBe('REVOKED');

    // 4. Unknown booking or doc -> NOT_FOUND
    const notFoundRes = await handleVerifyDocumentRequest(
      new Request('https://viridiannexus.com/api/verifyDocument?ref=VN-9999-0000&doc=VN-STM-9999-0000'),
      BASE_ENV,
      { fetchFn: createMockFetch({ bookings: [], payments: [] }) }
    );
    const notFoundBody = (await notFoundRes.json()) as DocumentVerificationResponse;
    expect(notFoundBody.verdict).toBe('NOT_FOUND');
    expect(notFoundBody.document).toBeNull();
  });

  it('includes adminBookingId shortcut only when caller presents a verified Admin token', async () => {
    const dbBooking = makeDbBooking();
    const dbPayments = makeDbPayments();
    const url = 'https://viridiannexus.com/api/verifyDocument?ref=VN-2026-8687&doc=VN-REC-2026-8687-DP';

    const adminRes = await handleVerifyDocumentRequest(
      new Request(url, { headers: { Authorization: 'Bearer valid-token' } }),
      BASE_ENV,
      {
        fetchFn: createMockFetch({
          bookings: [dbBooking],
          payments: dbPayments,
          authUserId: 'adm-1',
          profileRole: 'admin',
        }),
      }
    );
    const adminBody = (await adminRes.json()) as DocumentVerificationResponse;
    expect(adminBody.adminBookingId).toBe('bkg-secret-uuid-9991');

    const userRes = await handleVerifyDocumentRequest(
      new Request(url, { headers: { Authorization: 'Bearer valid-token' } }),
      BASE_ENV,
      {
        fetchFn: createMockFetch({
          bookings: [dbBooking],
          payments: dbPayments,
          authUserId: 'usr-1',
          profileRole: 'user',
        }),
      }
    );
    const userBody = (await userRes.json()) as DocumentVerificationResponse;
    expect(userBody.adminBookingId).toBeUndefined();
  });
});
