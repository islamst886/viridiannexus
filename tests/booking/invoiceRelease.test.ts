import { describe, expect, it } from 'vitest';
import type { Booking, BookingPayment } from '../../src/types';
import { buildInvoiceDocument } from '../../src/utils/invoiceBuilder';
import {
  getClientAuthorizedBookingCategories,
  getClientAuthorizedPayments,
  getClientTotalAuthorizedDocumentsCount,
  isBookingDocAuthorizedForClient,
  isPaymentInvoiceAuthorizedForClient,
  mergeInvoiceReleaseManifestIntoNotes,
  parseInvoiceReleaseManifest,
  resolveDefaultClientDocumentSelection,
  stripInvoiceReleaseManifestMarker,
  withBookingDocRelease,
  withPaymentDocRelease,
} from '../../src/utils/invoiceRelease';
import { createMockBooking } from '../helpers/mockData';

function makeBooking(overrides: Record<string, unknown> = {}): Booking {
  const mock = createMockBooking(overrides);
  return {
    id: String(mock.id || 'bkg-rel-01'),
    bookingRef: String(mock.bookingRef || 'VN-2026-6249'),
    propertyId: String(mock.propertyId || 'prop-01'),
    propertyName: String(mock.propertyName || 'The Sapphire Penthouse'),
    propertyLocation: 'Jolshiri Abashon, Dhaka',
    clientName: String(mock.clientName || 'Client'),
    clientEmail: String(mock.clientEmail || 'client@example.com'),
    clientPhone: String(mock.clientPhone || '+8801711000000'),
    linkedUserId: 'user-uid-1',
    unitType: 'Penthouse',
    unitNumber: 'Unit A',
    parkingSpotIds: [],
    parkingPrice: 0,
    totalPrice: 6250000,
    totalPaid: 350000,
    balanceDue: 5900000,
    downPaymentAmount: 350000,
    stage: 'Down Payment Paid',
    status: String(mock.status || 'Active'),
    notes: typeof overrides.notes === 'string' ? overrides.notes : undefined,
  };
}

function makePayments(): BookingPayment[] {
  return [
    {
      id: 'pay-dp',
      bookingId: 'bkg-rel-01',
      type: 'Down Payment',
      scheduledAmount: 350000,
      receivedAmount: 350000,
      status: 'Paid',
      dueDate: '2026-11-19',
      scheduledDate: '2026-11-19',
      paidDate: '2026-11-19',
      paymentMode: 'Bank Transfer',
      notes: 'Ref: EBL-7712 | VIP discount approved internally',
    },
    {
      id: 'pay-inst-1',
      bookingId: 'bkg-rel-01',
      type: 'Installment',
      installmentNumber: 1,
      scheduledAmount: 2950000,
      receivedAmount: 0,
      status: 'Scheduled',
      dueDate: '2026-11-20',
      scheduledDate: '2026-11-20',
      paymentMode: 'Cash',
      notes: 'Follow up with client before releasing',
    },
    {
      id: 'pay-inst-2',
      bookingId: 'bkg-rel-01',
      type: 'Installment',
      installmentNumber: 2,
      scheduledAmount: 2950000,
      receivedAmount: 0,
      status: 'Scheduled',
      dueDate: '2027-02-20',
      scheduledDate: '2027-02-20',
      paymentMode: 'Cash',
      notes: '',
    },
  ];
}

describe('Client Portal Invoice Issuance & Verification Governance', () => {
  it('hides unissued future scheduled installments and internal booking docs by default while allowing settled receipts', () => {
    const booking = makeBooking();
    const payments = makePayments();

    expect(getClientAuthorizedBookingCategories(booking)).toEqual([]);
    expect(isPaymentInvoiceAuthorizedForClient(booking, payments[0]!)).toBe(true); // Paid Down Payment receipt
    expect(isPaymentInvoiceAuthorizedForClient(booking, payments[1]!)).toBe(false); // Unissued Installment #1
    expect(isPaymentInvoiceAuthorizedForClient(booking, payments[2]!)).toBe(false); // Unissued Installment #2

    const authorizedPayments = getClientAuthorizedPayments(booking, payments);
    expect(authorizedPayments.map((p) => p.id)).toEqual(['pay-dp']);
    expect(getClientTotalAuthorizedDocumentsCount(booking, payments)).toBe(1);
    expect(resolveDefaultClientDocumentSelection(booking, payments)).toEqual({
      category: 'payment-receipt',
      paymentId: 'pay-dp',
    });
  });

  it('reveals only invoices & master documents explicitly verified/issued by Admin and lets Admin withdraw receipts', () => {
    const baseBooking = makeBooking({ notes: 'Handover clause agreed' });
    const payments = makePayments();

    let manifest = parseInvoiceReleaseManifest(baseBooking);
    // Admin verifies & issues Installment #1 demand invoice and Statement of Account
    manifest = withPaymentDocRelease(manifest, payments[1]!, 'issued', {
      name: 'Super Admin',
      id: 'adm-1',
    });
    manifest = withBookingDocRelease(manifest, 'account-statement', 'issued', {
      name: 'Super Admin',
      id: 'adm-1',
    });
    // Admin temporarily withdraws Down Payment receipt pending cheque realization
    manifest = withPaymentDocRelease(manifest, payments[0]!, 'withheld', {
      name: 'Super Admin',
      id: 'adm-1',
    });

    const updatedNotes = mergeInvoiceReleaseManifestIntoNotes(baseBooking.notes, manifest);
    expect(stripInvoiceReleaseManifestMarker(updatedNotes)).toBe('Handover clause agreed');

    const releasedBooking: Booking = { ...baseBooking, notes: updatedNotes };
    expect(getClientAuthorizedBookingCategories(releasedBooking)).toEqual(['account-statement']);
    expect(isBookingDocAuthorizedForClient(releasedBooking, 'booking-summary')).toBe(false);
    expect(getClientAuthorizedPayments(releasedBooking, payments).map((p) => p.id)).toEqual([
      'pay-inst-1',
    ]);
    expect(getClientTotalAuthorizedDocumentsCount(releasedBooking, payments)).toBe(2);
    expect(resolveDefaultClientDocumentSelection(releasedBooking, payments)).toEqual({
      category: 'account-statement',
      paymentId: 'pay-inst-1',
    });
  });

  it('suppresses unpaid demand invoices and outstanding bundles when a booking is Cancelled while keeping verified paid receipts', () => {
    const base = makeBooking({ status: 'Cancelled' });
    const payments = makePayments();
    let manifest = parseInvoiceReleaseManifest(base);
    manifest = withPaymentDocRelease(manifest, payments[1]!, 'issued', { name: 'Admin' });
    manifest = withBookingDocRelease(manifest, 'outstanding-bundle', 'issued', { name: 'Admin' });
    manifest = withBookingDocRelease(manifest, 'account-statement', 'issued', { name: 'Admin' });

    const cancelled: Booking = {
      ...base,
      notes: mergeInvoiceReleaseManifestIntoNotes(base.notes, manifest),
    };

    expect(getClientAuthorizedBookingCategories(cancelled)).toEqual(['account-statement']);
    expect(getClientAuthorizedPayments(cancelled, payments).map((p) => p.id)).toEqual(['pay-dp']);
  });

  it('strips internal staff notes from client-audience invoice builds while preserving payment Ref IDs', () => {
    const booking = makeBooking();
    const payments = makePayments();

    const adminDoc = buildInvoiceDocument({
      booking,
      payments,
      category: 'demand-invoice',
      targetPaymentId: 'pay-inst-1',
      audience: 'admin',
    });
    const clientDoc = buildInvoiceDocument({
      booking,
      payments,
      category: 'demand-invoice',
      targetPaymentId: 'pay-inst-1',
      audience: 'client',
    });

    expect(adminDoc.items[0]?.subtitle).toBe('Follow up with client before releasing');
    expect(clientDoc.items[0]?.subtitle).toBeUndefined();
    expect(JSON.stringify(clientDoc)).not.toContain('Follow up with client before releasing');

    const clientReceipt = buildInvoiceDocument({
      booking,
      payments,
      category: 'payment-receipt',
      targetPaymentId: 'pay-dp',
      audience: 'client',
    });
    expect(clientReceipt.items[0]?.reference).toBe('EBL-7712');
    expect(clientReceipt.items[0]?.subtitle).toBeUndefined();
  });
});
