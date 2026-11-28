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
  generateCanonicalBookingDocCode,
  generateCanonicalPaymentDocCode,
  getDocumentVerificationInfo,
  mergeInvoiceReleaseManifestIntoNotes,
  parseInvoiceReleaseManifest,
  withBookingDocRelease,
  withPaymentDocRelease,
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

  it('keeps booking-level verification codes & QR payloads identical across withhold and re-issue by different admins', async () => {
    const baseManifest = parseInvoiceReleaseManifest(undefined);
    const issuedFirst = withBookingDocRelease(
      baseManifest,
      'account-statement',
      'issued',
      { name: 'Admin One', id: 'adm-1' },
      '2026-11-20T10:00:00.000Z',
      'bkg-secret-uuid-9991'
    );
    const withheld = withBookingDocRelease(
      issuedFirst,
      'account-statement',
      'withheld',
      { name: 'Admin Two', id: 'adm-2' },
      '2026-11-21T12:00:00.000Z',
      'bkg-secret-uuid-9991'
    );
    const reissuedLater = withBookingDocRelease(
      withheld,
      'account-statement',
      'issued',
      { name: 'Super Admin', id: 'sa-1' },
      '2026-11-28T18:00:00.000Z',
      'bkg-secret-uuid-9991'
    );

    const codeFirst = issuedFirst.bookingDocs['account-statement']?.verificationCode;
    const codeReissued = reissuedLater.bookingDocs['account-statement']?.verificationCode;
    expect(codeFirst).toBe(generateCanonicalBookingDocCode('bkg-secret-uuid-9991', 'account-statement'));
    expect(codeReissued).toBe(codeFirst);

    const dbBooking = makeDbBooking({
      notes: mergeInvoiceReleaseManifestIntoNotes('', reissuedLater),
    });
    const res = await handleVerifyDocumentRequest(
      new Request(
        `https://viridiannexus.com/api/verifyDocument?ref=VN-2026-8687&doc=VN-STM-2026-8687&code=${codeFirst}`
      ),
      BASE_ENV,
      { fetchFn: createMockFetch({ bookings: [dbBooking], payments: makeDbPayments() }) }
    );
    const body = (await res.json()) as DocumentVerificationResponse;
    expect(body.verdict).toBe('VERIFIED');
    expect(body.document?.verificationCodeMatched).toBe(true);
  });

  it('keeps paid receipt QR codes identical when auto-verified receipts are later explicitly issued/toggled', async () => {
    const dbPayments = makeDbPayments();
    const dpPayment: BookingPayment = {
      id: 'pay-dp-1',
      bookingId: 'bkg-secret-uuid-9991',
      type: 'Down Payment',
      scheduledAmount: 100000,
      receivedAmount: 100000,
      status: 'Paid',
      paymentMode: 'Bank Transfer',
      notes: 'Ref: EBL-9001',
    };

    const bookingModel: Booking = {
      id: 'bkg-secret-uuid-9991',
      bookingRef: 'VN-2026-8687',
      propertyId: 'viridian-manor',
      propertyName: 'Viridian Manor',
      propertyLocation: 'Jolshiri Abashon',
      clientName: 'Rahim Chowdhury',
      clientEmail: 'r@example.com',
      clientPhone: '+8801711998877',
      parkingSpotIds: [],
      parkingPrice: 0,
      totalPrice: 12000000,
      totalPaid: 100000,
      balanceDue: 11900000,
      downPaymentAmount: 100000,
      stage: 'Down Payment Paid',
      status: 'Active',
    };

    const autoCode = getDocumentVerificationInfo(bookingModel, 'payment-receipt', dpPayment, [
      dpPayment,
    ]).verificationCode;
    expect(autoCode).toBe(generateCanonicalPaymentDocCode('bkg-secret-uuid-9991', 'pay-dp-1'));

    const explicitManifest = withPaymentDocRelease(
      parseInvoiceReleaseManifest(undefined),
      dpPayment,
      'issued',
      { name: 'Super Admin', id: 'sa-1' },
      '2026-11-28T20:00:00.000Z',
      'bkg-secret-uuid-9991'
    );
    expect(explicitManifest.paymentDocs['pay-dp-1']?.verificationCode).toBe(autoCode);

    const updatedDbBooking = makeDbBooking({
      notes: mergeInvoiceReleaseManifestIntoNotes('', explicitManifest),
    });
    const res = await handleVerifyDocumentRequest(
      new Request(
        `https://viridiannexus.com/api/verifyDocument?ref=VN-2026-8687&doc=VN-REC-2026-8687-DP&code=${autoCode}`
      ),
      BASE_ENV,
      { fetchFn: createMockFetch({ bookings: [updatedDbBooking], payments: dbPayments }) }
    );
    const body = (await res.json()) as DocumentVerificationResponse;
    expect(body.verdict).toBe('VERIFIED');
    expect(body.document?.verificationCodeMatched).toBe(true);
  });

  it('verifies previously printed Demand Invoice QR as VERIFIED (Already Settled) after full payment is recorded', async () => {
    // 1. Pre-payment: Admin issued Demand Invoice for Installment #1
    const unpaidInst: BookingPayment = {
      id: 'pay-inst-1',
      bookingId: 'bkg-secret-uuid-9991',
      type: 'Installment',
      installmentNumber: 1,
      scheduledAmount: 1700000,
      receivedAmount: 0,
      status: 'Scheduled',
      paymentMode: 'Cash',
      notes: '',
    };
    const manifestWithDemandIssued = withPaymentDocRelease(
      parseInvoiceReleaseManifest(undefined),
      unpaidInst,
      'issued',
      { name: 'Admin', id: 'adm-1' },
      '2026-11-19T10:00:00.000Z',
      'bkg-secret-uuid-9991'
    );
    const prePaymentCode = manifestWithDemandIssued.paymentDocs['pay-inst-1']!.verificationCode;

    // Client printed VN-INV-2026-8687-INS-01 before paying
    const printedDocUrl = buildDocumentVerificationUrl({
      origin: 'https://viridiannexus.com',
      bookingRef: 'VN-2026-8687',
      invoiceNumber: 'VN-INV-2026-8687-INS-01',
      verificationCode: prePaymentCode,
    });
    expect(printedDocUrl).toContain('doc=VN-INV-2026-8687-INS-01');

    // 2. Later Admin records full payment on pay-inst-1
    const settledPayments = makeDbPayments().map((p) =>
      p.id === 'pay-inst-1'
        ? { ...p, received_amount: 1700000, status: 'Paid', paid_date: '2026-11-28', payment_mode: 'Bank Transfer' }
        : p
    );
    const settledBooking = makeDbBooking({
      total_paid: 1800000,
      balance_due: 10200000,
      stage: 'Installments Running',
      notes: mergeInvoiceReleaseManifestIntoNotes('', manifestWithDemandIssued),
    });

    // Scanning the old printed Demand Invoice QR still verifies cleanly!
    const res = await handleVerifyDocumentRequest(
      new Request(
        `https://viridiannexus.com/api/verifyDocument?ref=VN-2026-8687&doc=VN-INV-2026-8687-INS-01&code=${prePaymentCode}`
      ),
      BASE_ENV,
      { fetchFn: createMockFetch({ bookings: [settledBooking], payments: settledPayments }) }
    );
    const body = (await res.json()) as DocumentVerificationResponse;
    expect(body.verdict).toBe('VERIFIED');
    expect(body.headline).toContain('Already Settled');
    expect(body.message).toContain('VN-REC-2026-8687-INS-01');
    expect(body.document?.verificationCodeMatched).toBe(true);
  });

  it('keeps sequence codes & QR URLs immutable across due-date changes, added charges, and booking metadata edits', () => {
    const customFirst: BookingPayment = {
      id: 'pay-tx-1',
      bookingId: 'bkg-secret-uuid-9991',
      type: 'Custom Charge',
      scheduledAmount: 50000,
      receivedAmount: 50000,
      status: 'Paid',
      dueDate: '2026-12-15',
      paymentMode: 'Cash',
      notes: '',
      createdAt: '2026-11-10T10:00:00.000Z',
    };
    const customEarlierDueLaterCreated: BookingPayment = {
      id: 'pay-tx-2',
      bookingId: 'bkg-secret-uuid-9991',
      type: 'Custom Charge',
      scheduledAmount: 25000,
      receivedAmount: 25000,
      status: 'Paid',
      dueDate: '2026-11-01', // Earlier due date, created AFTER pay-tx-1
      paymentMode: 'Cash',
      notes: '',
      createdAt: '2026-11-20T10:00:00.000Z',
    };
    const parkingFirst: BookingPayment = {
      id: 'pay-pk-1',
      bookingId: 'bkg-secret-uuid-9991',
      type: 'Add-on Invoice (Parking)',
      scheduledAmount: 500000,
      receivedAmount: 500000,
      status: 'Paid',
      dueDate: '2026-12-01',
      paymentMode: 'Bank Transfer',
      notes: '',
      createdAt: '2026-11-12T10:00:00.000Z',
    };
    const parkingSecond: BookingPayment = {
      id: 'pay-pk-2',
      bookingId: 'bkg-secret-uuid-9991',
      type: 'Add-on Invoice (Parking)',
      scheduledAmount: 500000,
      receivedAmount: 0,
      status: 'Scheduled',
      dueDate: '2026-11-05',
      paymentMode: 'Bank Transfer',
      notes: '',
      createdAt: '2026-11-22T10:00:00.000Z',
    };

    const baseBooking: Booking = {
      id: 'bkg-secret-uuid-9991',
      bookingRef: 'VN-2026-8687',
      propertyId: 'viridian-manor',
      propertyName: 'Viridian Manor',
      propertyLocation: 'Jolshiri Abashon',
      clientName: 'Rahim Chowdhury',
      clientEmail: 'r@example.com',
      clientPhone: '017',
      unitType: 'Unit A',
      unitNumber: 'Floor 3, Unit A',
      parkingSpotIds: [],
      parkingPrice: 500000,
      totalPrice: 12000000,
      totalPaid: 75000,
      balanceDue: 11925000,
      downPaymentAmount: 0,
      stage: 'Down Payment Paid',
      status: 'Active',
    };

    const code = generateCanonicalPaymentDocCode(baseBooking.id, 'pay-tx-1');
    const initialDoc = buildInvoiceDocument({
      booking: baseBooking,
      payments: [customFirst, parkingFirst],
      category: 'payment-receipt',
      targetPaymentId: 'pay-tx-1',
      verificationCode: code,
      verificationOrigin: 'https://viridiannexus.com',
    });

    // Mutate array order (by earlier dueDate), add 2nd parking + 2nd custom charge, change unit/client/stage
    const updatedBooking: Booking = {
      ...baseBooking,
      clientName: 'Rahim Uddin Chowdhury',
      unitNumber: 'Floor 7, Unit B',
      stage: 'Agreement Signed',
    };
    const reorderedPayments = [customEarlierDueLaterCreated, parkingSecond, parkingFirst, customFirst];
    const afterEditsDoc = buildInvoiceDocument({
      booking: updatedBooking,
      payments: reorderedPayments,
      category: 'payment-receipt',
      targetPaymentId: 'pay-tx-1',
      verificationCode: code,
      verificationOrigin: 'https://viridiannexus.com',
    });

    expect(initialDoc.invoiceNumber).toBe('VN-REC-2026-8687-TX-01');
    expect(afterEditsDoc.invoiceNumber).toBe('VN-REC-2026-8687-TX-01');
    expect(afterEditsDoc.qrPayload).toBe(initialDoc.qrPayload);

    // Distinct non-colliding parking add-on numbers: 1st = PK, 2nd = PK-02
    const pk1Doc = buildInvoiceDocument({
      booking: updatedBooking,
      payments: reorderedPayments,
      category: 'payment-receipt',
      targetPaymentId: 'pay-pk-1',
    });
    const pk2Doc = buildInvoiceDocument({
      booking: updatedBooking,
      payments: reorderedPayments,
      category: 'demand-invoice',
      targetPaymentId: 'pay-pk-2',
    });
    expect(pk1Doc.invoiceNumber).toBe('VN-REC-2026-8687-PK');
    expect(pk2Doc.invoiceNumber).toBe('VN-INV-2026-8687-PK-02');
  });
});
