import { describe, expect, it } from 'vitest';
import type { Booking, BookingPayment } from '../../src/types';
import { CANCELLATION_FEE_TYPE, REFUND_PAYOUT_TYPE } from '../../src/utils/bookingCancellation';
import { normalizeInvoiceRefCode } from '../../src/utils/documentVerification';
import {
  buildInvoiceDocument,
  classifyPaymentDocumentCategory,
  escapeHtml,
  estimateLineItemRowHeight,
  numberToBDTWords,
  paginateInvoiceItems,
  sanitizeInvoiceFilename,
} from '../../src/utils/invoiceBuilder';
import { createMockBooking, createMockPayments } from '../helpers/mockData';

function toBooking(overrides: Record<string, unknown> = {}): Booking {
  const mock = createMockBooking(overrides);
  return {
    id: String(mock.id || 'bkg-uuid-001'),
    bookingRef: String(mock.bookingRef || 'BK-2026-001'),
    propertyId: String(mock.propertyId || 'prop-jolshiri-01'),
    propertyName: String(mock.propertyName || 'Viridian Jolshiri Exclusivity'),
    propertyLocation: 'Jolshiri Abashon, Sector 06, Dhaka',
    inventoryId: typeof mock.inventoryId === 'string' ? mock.inventoryId : null,
    clientName: String(mock.clientName || 'Client'),
    clientEmail: String(mock.clientEmail || 'client@example.com'),
    clientPhone: String(mock.clientPhone || '+8801711000000'),
    clientNid: typeof mock.clientNid === 'string' ? mock.clientNid : '',
    clientAddress: typeof mock.clientAddress === 'string' ? mock.clientAddress : '',
    linkedUserId: typeof mock.linkedUserId === 'string' ? mock.linkedUserId : null,
    unitNumber: typeof mock.unitNumber === 'string' ? mock.unitNumber : '',
    unitType: typeof mock.unitType === 'string' ? mock.unitType : '',
    parkingSpotIds: Array.isArray(mock.parkingSpotIds) ? (mock.parkingSpotIds as string[]) : [],
    parkingIncluded: typeof mock.parkingIncluded === 'string' ? mock.parkingIncluded : null,
    parkingPrice: 1200000,
    totalPrice: Number(mock.totalPrice ?? 0),
    totalPaid: Number(mock.totalPaid ?? 0),
    balanceDue: Number(mock.balanceDue ?? 0),
    downPaymentAmount: Number(mock.downPaymentAmount ?? 0),
    stage: String(mock.stage || 'Down Payment Paid'),
    status: String(mock.status || 'Active'),
    installmentPlan: typeof mock.installmentPlan === 'string' ? mock.installmentPlan : 'Quarterly',
    createdAt: typeof mock.createdAt === 'string' ? mock.createdAt : undefined,
  };
}

function toPayments(bookingId = 'bkg-uuid-001'): BookingPayment[] {
  const base: BookingPayment[] = createMockPayments(bookingId).map((p, idx) => ({
    id: String(p.id || `pay-mock-${idx}`),
    bookingId: String(p.bookingId || bookingId),
    type: String(p.type || 'Installment'),
    installmentNumber: typeof p.installmentNumber === 'number' ? p.installmentNumber : null,
    scheduledAmount: Number(p.scheduledAmount ?? 0),
    receivedAmount: Number(p.receivedAmount ?? 0),
    status: String(p.status || 'Scheduled'),
    dueDate: typeof p.dueDate === 'string' ? p.dueDate : null,
    scheduledDate: typeof p.dueDate === 'string' ? p.dueDate : null,
    paidDate: typeof p.paidDate === 'string' ? p.paidDate : null,
    paymentMode: String(p.paymentMode || 'Cash'),
    notes: typeof p.notes === 'string' ? p.notes : '',
  }));

  base.push(
    {
      id: 'pay-inst-partial',
      bookingId,
      type: 'Installment',
      installmentNumber: 2,
      scheduledAmount: 6000000,
      receivedAmount: 2500000,
      status: 'Partially Paid',
      dueDate: '2026-07-15',
      scheduledDate: '2026-07-15',
      paidDate: '2026-07-14',
      paymentMode: 'Cheque',
      notes: 'Ref: CHQ-9981 | Part tranche received',
    },
    {
      id: 'pay-parking-addon',
      bookingId,
      type: 'Add-on Invoice (Parking)',
      installmentNumber: null,
      scheduledAmount: 1200000,
      receivedAmount: 0,
      status: 'Scheduled',
      dueDate: '2026-02-01',
      scheduledDate: '2026-02-01',
      paidDate: null,
      paymentMode: 'Bank Transfer',
      notes: 'Additional basement spot P2-04',
    },
    {
      id: 'pay-parking-credit',
      bookingId,
      type: 'Credit Note (Parking Removed)',
      installmentNumber: null,
      scheduledAmount: -1000000,
      receivedAmount: -1000000,
      status: 'Paid',
      dueDate: '2026-02-10',
      scheduledDate: '2026-02-10',
      paidDate: '2026-02-10',
      paymentMode: 'System',
      notes: 'Released secondary parking spot',
    },
    {
      id: 'pay-waived',
      bookingId,
      type: 'Late Documentation Charge',
      installmentNumber: null,
      scheduledAmount: 50000,
      receivedAmount: 0,
      status: 'Waived',
      dueDate: '2026-02-15',
      scheduledDate: '2026-02-15',
      paidDate: null,
      paymentMode: 'Cash',
      notes: 'Management waiver',
    }
  );

  return base;
}

describe('Booking Management Invoice Builder', () => {
  const refDate = new Date('2026-03-01T12:00:00Z');

  it('builds a Booking Allotment Invoice with canonical branding and contract summary', () => {
    const booking = toBooking();
    const payments = toPayments(booking.id);

    const doc = buildInvoiceDocument({
      booking,
      payments,
      category: 'booking-summary',
      issueDate: refDate,
    });

    expect(doc.documentTitle).toBe('BOOKING ALLOTMENT INVOICE');
    expect(doc.invoiceNumber).toBe(`VN-INV-${normalizeInvoiceRefCode(booking.bookingRef)}-MASTER`);
    expect(doc.company.legalName).toBe('Viridian Nexus Development Ltd.');
    expect(doc.company.enlistments.rajuk).toBe('RAJUK Enlisted');
    expect(doc.company.enlistments.canttBoard).toBe('Cantt. Board Enlisted');
    expect(doc.financialSummary.totalAgreedPrice).toBe(30500000);
    expect(doc.items.length).toBe(payments.length);
    expect(doc.qrPayload).toContain(booking.bookingRef);
  });

  it('builds a fallback single-line allocation when a booking has no scheduled payment rows yet', () => {
    const booking = toBooking({ totalPaid: 0, balanceDue: 30500000, stage: 'EOI' });

    const doc = buildInvoiceDocument({
      booking,
      payments: [],
      category: 'booking-summary',
      issueDate: refDate,
    });

    expect(doc.items).toHaveLength(1);
    expect(doc.items[0]?.title).toContain(booking.propertyName);
    expect(doc.items[0]?.scheduledAmount).toBe(30500000);
  });

  it('builds a Comprehensive Statement of Account flagging overdue items and waived totals', () => {
    const booking = toBooking({ totalPaid: 7000000, balanceDue: 23500000 });
    const payments = toPayments(booking.id);

    const doc = buildInvoiceDocument({
      booking,
      payments,
      category: 'account-statement',
      issueDate: refDate,
    });

    expect(doc.documentTitle).toBe('STATEMENT OF ACCOUNT');
    expect(doc.statusLabel).toBe('OVERDUE ITEMS');
    expect(doc.statusTone).toBe('overdue');
    expect(doc.financialSummary.overallWaivedAmount).toBe(50000);
    const addon = doc.items.find((i) => i.id === 'pay-parking-addon');
    expect(addon?.isOverdue).toBe(true);
    expect(addon?.status).toBe('Overdue');
  });

  it('builds Consolidated Outstanding Invoice excluding Paid, Waived, and negative credit rows', () => {
    const booking = toBooking();
    const payments = toPayments(booking.id);

    const doc = buildInvoiceDocument({
      booking,
      payments,
      category: 'outstanding-bundle',
      issueDate: refDate,
    });

    expect(doc.documentTitle).toBe('OUTSTANDING PAYMENT INVOICE');
    const itemIds = doc.items.map((i) => i.id);
    expect(itemIds).toEqual(['pay-inst-01', 'pay-inst-partial', 'pay-parking-addon']);
    // 6,375,000 + (6,000,000 - 2,500,000) + 1,200,000 = 11,075,000
    expect(doc.financialSummary.documentNetAmount).toBe(11075000);
    expect(doc.statusTone).toBe('overdue');
  });

  it('builds Consolidated Receipts Summary aggregating only realized positive receipts', () => {
    const booking = toBooking();
    const payments = toPayments(booking.id);

    const doc = buildInvoiceDocument({
      booking,
      payments,
      category: 'receipts-summary',
      issueDate: refDate,
    });

    expect(doc.documentTitle).toBe('CONSOLIDATED RECEIPT SUMMARY');
    expect(doc.items.map((i) => i.id)).toEqual(['pay-dp-01', 'pay-inst-partial']);
    expect(doc.financialSummary.totalPaidInDoc).toBe(7000000);
  });

  it('builds Official Payment Receipt and Partial Payment Receipt with extracted txn reference', () => {
    const booking = toBooking();
    const payments = toPayments(booking.id);

    const fullReceipt = buildInvoiceDocument({
      booking,
      payments,
      category: 'payment-receipt',
      targetPaymentId: 'pay-dp-01',
      issueDate: refDate,
    });

    expect(fullReceipt.documentTitle).toBe('OFFICIAL PAYMENT RECEIPT');
    expect(fullReceipt.statusLabel).toBe('PAID IN FULL');
    expect(fullReceipt.statusTone).toBe('paid');
    expect(fullReceipt.items[0]?.reference).toBe('TXN-DP-01');
    expect(fullReceipt.financialSummary.documentNetAmount).toBe(4500000);

    const partialReceipt = buildInvoiceDocument({
      booking,
      payments,
      category: 'payment-receipt',
      targetPaymentId: 'pay-inst-partial',
      issueDate: refDate,
    });

    expect(partialReceipt.documentTitle).toBe('PARTIAL PAYMENT RECEIPT');
    expect(partialReceipt.statusLabel).toBe('PARTIALLY PAID');
    expect(partialReceipt.statusTone).toBe('partial');
    expect(partialReceipt.items[0]?.reference).toBe('CHQ-9981');
    expect(partialReceipt.financialSummary.documentNetAmount).toBe(2500000);
  });

  it('builds specialized Parking Add-on Demand Invoice, Official Credit Note, and Waiver Memo', () => {
    const booking = toBooking();
    const payments = toPayments(booking.id);

    const parkingDemand = buildInvoiceDocument({
      booking,
      payments,
      category: 'demand-invoice',
      targetPaymentId: 'pay-parking-addon',
      issueDate: refDate,
    });
    expect(parkingDemand.documentTitle).toBe('PARKING ADD-ON INVOICE');
    expect(parkingDemand.statusLabel).toBe('OVERDUE');
    expect(parkingDemand.financialSummary.documentNetAmount).toBe(1200000);

    const creditNote = buildInvoiceDocument({
      booking,
      payments,
      category: 'credit-note',
      targetPaymentId: 'pay-parking-credit',
      issueDate: refDate,
    });
    expect(creditNote.documentTitle).toBe('OFFICIAL CREDIT NOTE');
    expect(creditNote.statusLabel).toBe('CREDITED');
    expect(creditNote.financialSummary.documentNetAmount).toBe(1000000);

    const waiverMemo = buildInvoiceDocument({
      booking,
      payments,
      category: 'credit-note',
      targetPaymentId: 'pay-waived',
      issueDate: refDate,
    });
    expect(waiverMemo.documentTitle).toBe('WAIVER & ADJUSTMENT MEMO');
    expect(waiverMemo.statusLabel).toBe('WAIVED');
  });

  it('classifies ledger rows accurately across paid, partial, credit, waived, and demand items', () => {
    const payments = toPayments('bkg-uuid-001');
    expect(classifyPaymentDocumentCategory(payments[0]!).actionLabel).toBe('Receipt');
    expect(classifyPaymentDocumentCategory(payments[1]!).actionLabel).toBe('Invoice');
    expect(classifyPaymentDocumentCategory(payments[2]!).actionLabel).toBe('Partial Receipt');
    expect(classifyPaymentDocumentCategory(payments[4]!).actionLabel).toBe('Credit Note');
    expect(classifyPaymentDocumentCategory(payments[5]!).actionLabel).toBe('Waiver Memo');
  });

  it('converts BDT amounts into formal Crore/Lac words, balances multi-page chunks, and sanitizes outputs', () => {
    expect(numberToBDTWords(30500000)).toBe('BDT Three Crore Five Lac Taka Only');
    expect(numberToBDTWords(0)).toBe('Zero Taka Only');
    expect(numberToBDTWords(-1000000)).toBe('Credit of BDT Ten Lac Taka Only');

    const booking = toBooking();
    const largeItems = Array.from({ length: 18 }, (_, i) => ({
      id: `item-${i + 1}`,
      sl: i + 1,
      title: `Installment #${i + 1}`,
      status: 'Scheduled',
      scheduledAmount: 1000000,
      receivedAmount: 0,
      netPayableOrCredit: 1000000,
    }));
    const pages = paginateInvoiceItems(largeItems);
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages.flat().length).toBe(18);
    expect(pages[pages.length - 1]!.length).toBeLessThanOrEqual(9);

    // 11 standard items (Down Payment + 10 installments) fit on a single A4 page without spilling
    const elevenPayments = Array.from({ length: 11 }, (_, i) => ({
      id: `std-${i + 1}`,
      bookingId: booking.id,
      type: i === 0 ? 'Down Payment' : 'Installment',
      installmentNumber: i === 0 ? null : i,
      scheduledAmount: 3690000,
      receivedAmount: i === 0 ? 3690000 : 0,
      status: i === 0 ? 'Paid' : 'Scheduled',
      dueDate: `2027-0${(i % 9) + 1}-01`,
      scheduledDate: `2027-0${(i % 9) + 1}-01`,
      paidDate: i === 0 ? '2026-11-15' : null,
      paymentMode: 'Cash',
      notes: '',
    }));
    const elevenDoc = buildInvoiceDocument({
      booking,
      payments: elevenPayments,
      category: 'account-statement',
      issueDate: refDate,
    });
    expect(paginateInvoiceItems(elevenDoc.items, elevenDoc)).toHaveLength(1);

    // Tall multi-line remarks/notes reserve extra vertical room accurately
    const tallRowHeight = estimateLineItemRowHeight({
      id: 'tall-1',
      sl: 1,
      title: 'Parking Add-on Invoice with Extended Floor Designation & Allotment Clause',
      subtitle: 'Basement P2-04 reserved allocation pending clearance from engineering desk and accounts verification department',
      paymentMode: 'Bank Transfer',
      reference: 'TXN-LONG-REF-9910',
      status: 'Scheduled',
      scheduledAmount: 1200000,
      receivedAmount: 0,
      netPayableOrCredit: 1200000,
    });
    expect(tallRowHeight).toBeGreaterThan(estimateLineItemRowHeight(largeItems[0]!));

    // When 14 compact items fit on Page 1 without Summary/Signatories, Page 1 keeps all 14 rows
    // and Page 2 carries only the final Reconciliation Summary & Signatories ([]).
    const fourteenItems = largeItems.slice(0, 14);
    const fourteenPages = paginateInvoiceItems(fourteenItems);
    expect(fourteenPages).toEqual([fourteenItems, []]);

    expect(sanitizeInvoiceFilename(`VN/INV ${booking.bookingRef} *?`)).toBe(`VN-INV-${booking.bookingRef}`);
    expect(escapeHtml('<script>"alert"</script>')).toBe('&lt;script&gt;&quot;alert&quot;&lt;/script&gt;');
  });

  it('builds Cancellation Settlement, Refund Voucher, and watermarked historical statements for cancelled bookings', () => {
    const cancelledZero = toBooking({
      status: 'Cancelled',
      stage: 'Cancelled',
      unitNumber: 'Floor 3, A',
      parkingIncluded: 'P-3 (Ground)',
      totalPaid: 0,
      balanceDue: 12000000,
    });
    const zeroUnpaid: BookingPayment[] = [
      {
        id: 'pay-void-1',
        bookingId: cancelledZero.id,
        type: 'Installment',
        installmentNumber: 1,
        scheduledAmount: 1700000,
        receivedAmount: 0,
        status: 'Voided',
        dueDate: '2026-01-01',
        scheduledDate: '2026-01-01',
        paymentMode: 'Cash',
        notes: '',
      },
    ];

    const zeroSettlementDoc = buildInvoiceDocument({
      booking: cancelledZero,
      payments: zeroUnpaid,
      category: 'cancellation-settlement',
      issueDate: refDate,
    });
    expect(zeroSettlementDoc.documentTitle).toBe('CANCELLATION & FINAL SETTLEMENT');
    expect(zeroSettlementDoc.watermarkText).toBe('CANCELLED');
    expect(zeroSettlementDoc.statusLabel).toBe('CANCELLED · CLOSED');
    expect(zeroSettlementDoc.propertySummary.unitNumber).toContain('(Released)');
    expect(zeroSettlementDoc.propertySummary.parking).toContain('(Released)');
    expect(zeroSettlementDoc.financialSummary.overallBalanceDue).toBe(0);
    expect(zeroSettlementDoc.items[0]?.status).toBe('Closed');

    const cancelledStmt = buildInvoiceDocument({
      booking: cancelledZero,
      payments: zeroUnpaid,
      category: 'account-statement',
      issueDate: refDate,
    });
    expect(cancelledStmt.watermarkText).toBe('CANCELLED');
    expect(cancelledStmt.statusLabel).toBe('CANCELLED');
    expect(cancelledStmt.financialSummary.overallBalanceDue).toBe(0);
    expect(cancelledStmt.items[0]?.status).toBe('Voided');
    expect(cancelledStmt.items[0]?.isOverdue).toBe(false);

    // Cancelled after Down Payment + Fee + Disbursed Refund
    const cancelledPaid = toBooking({
      status: 'Cancelled',
      stage: 'Cancelled',
      unitNumber: 'Floor 5, B',
      parkingIncluded: null,
      totalPaid: 1000000,
      balanceDue: 0,
    });
    const refundPayments: BookingPayment[] = [
      {
        id: 'dp-paid',
        bookingId: cancelledPaid.id,
        type: 'Down Payment',
        scheduledAmount: 1000000,
        receivedAmount: 1000000,
        status: 'Paid',
        dueDate: '2026-01-10',
        scheduledDate: '2026-01-10',
        paidDate: '2026-01-10',
        paymentMode: 'Bank Transfer',
        notes: 'Ref: TXN-551',
      },
      {
        id: 'fee-cxl',
        bookingId: cancelledPaid.id,
        type: CANCELLATION_FEE_TYPE,
        scheduledAmount: 50000,
        receivedAmount: 0,
        status: 'Deducted',
        dueDate: '2026-02-01',
        scheduledDate: '2026-02-01',
        paymentMode: 'Deduction',
        notes: '',
      },
      {
        id: 'rfn-payout',
        bookingId: cancelledPaid.id,
        type: REFUND_PAYOUT_TYPE,
        scheduledAmount: -950000,
        receivedAmount: -950000,
        status: 'Refunded',
        dueDate: '2026-02-15',
        scheduledDate: '2026-02-15',
        paidDate: '2026-02-14',
        paymentMode: 'Account Payee Cheque',
        notes: 'Ref: CHQ-77101',
      },
    ];

    const paidSettlementDoc = buildInvoiceDocument({
      booking: cancelledPaid,
      payments: refundPayments,
      category: 'cancellation-settlement',
      issueDate: refDate,
    });
    expect(paidSettlementDoc.statusLabel).toBe('REFUND SETTLED');
    expect(paidSettlementDoc.cancellationSummary).toMatchObject({
      grossCollected: 1000000,
      cancellationFee: 50000,
      netRefundable: 950000,
      refundDisbursed: 950000,
      refundRemaining: 0,
    });

    const voucher = buildInvoiceDocument({
      booking: cancelledPaid,
      payments: refundPayments,
      category: 'refund-voucher',
      targetPaymentId: 'rfn-payout',
      issueDate: refDate,
    });
    expect(voucher.documentTitle).toBe('OFFICIAL REFUND VOUCHER');
    expect(voucher.statusLabel).toBe('REFUND DISBURSED');
    expect(voucher.invoiceNumber).toBe(`VN-RFN-${normalizeInvoiceRefCode(cancelledPaid.bookingRef)}-RFN`);
    expect(voucher.financialSummary.documentNetAmount).toBe(950000);
    expect(voucher.items[0]?.reference).toBe('CHQ-77101');

    const cancelledReceiptsSum = buildInvoiceDocument({
      booking: cancelledPaid,
      payments: refundPayments,
      category: 'receipts-summary',
      issueDate: refDate,
    });
    expect(cancelledReceiptsSum.statusLabel).toBe('CANCELLED · HISTORICAL RECEIPTS');
    expect(cancelledReceiptsSum.items.map((i) => i.id)).toEqual(['dp-paid']);

    const historicalReceipt = buildInvoiceDocument({
      booking: cancelledPaid,
      payments: refundPayments,
      category: 'payment-receipt',
      targetPaymentId: 'dp-paid',
      issueDate: refDate,
    });
    expect(historicalReceipt.watermarkText).toBe('CANCELLED');
    expect(historicalReceipt.remarks.some((r) => r.includes('Historical receipt preserved'))).toBe(
      true
    );
  });
});
