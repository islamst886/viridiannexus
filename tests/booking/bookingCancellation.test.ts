import { describe, expect, it } from 'vitest';
import type { BookingPayment } from '../../src/types';
import {
  CANCELLATION_FEE_TYPE,
  REFUND_PAYOUT_TYPE,
  computeCancellationSettlement,
  evaluateCancellationGovernance,
  generateCancellationLegalRef,
  generateCashRefundVoucherRef,
  getRefundPayoutRefMeta,
} from '../../src/utils/bookingCancellation';

function makePay(overrides: Partial<BookingPayment> & { id: string }): BookingPayment {
  return {
    bookingId: 'bkg-cxl-01',
    type: 'Installment',
    installmentNumber: 1,
    scheduledAmount: 1700000,
    receivedAmount: 0,
    status: 'Scheduled',
    dueDate: '2026-11-20',
    scheduledDate: '2026-11-20',
    paidDate: null,
    paymentMode: 'Cash',
    notes: '',
    ...overrides,
  };
}

describe('Booking Cancellation Governance & Financial Settlement Engine', () => {
  describe('evaluateCancellationGovernance', () => {
    it('allows standard Admin cancellation at EOI and Down Payment Paid stages', () => {
      expect(evaluateCancellationGovernance({ stage: 'EOI', status: 'Active' }, false)).toEqual({
        allowed: true,
        requiresSuperAdmin: false,
        requiresLegalRef: false,
        tier: 'standard',
      });

      expect(
        evaluateCancellationGovernance({ stage: 'Down Payment Paid', status: 'Active' }, false)
      ).toEqual({
        allowed: true,
        requiresSuperAdmin: false,
        requiresLegalRef: false,
        tier: 'standard',
      });
    });

    it('blocks regular Admin but allows Super Admin with legal ref at Agreement Signed and Installments Running', () => {
      for (const stage of ['Agreement Signed', 'Installments Running']) {
        const adminRes = evaluateCancellationGovernance({ stage, status: 'Active' }, false);
        expect(adminRes.allowed).toBe(false);
        expect(adminRes.requiresSuperAdmin).toBe(true);
        expect(adminRes.requiresLegalRef).toBe(true);
        expect(adminRes.tier).toBe('post-agreement');

        const superRes = evaluateCancellationGovernance({ stage, status: 'Active' }, true);
        expect(superRes.allowed).toBe(true);
        expect(superRes.requiresSuperAdmin).toBe(true);
        expect(superRes.requiresLegalRef).toBe(true);
        expect(superRes.tier).toBe('post-agreement');
      }
    });

    it('blocks regular Admin and requires Super Admin reversal at Fully Paid, Handover, and Completed', () => {
      for (const stage of ['Fully Paid', 'Handover', 'Completed']) {
        const adminRes = evaluateCancellationGovernance({ stage, status: 'Active' }, false);
        expect(adminRes.allowed).toBe(false);
        expect(adminRes.tier).toBe('post-completion');

        const superRes = evaluateCancellationGovernance({ stage, status: 'Completed' }, true);
        expect(superRes.allowed).toBe(true);
        expect(superRes.requiresLegalRef).toBe(true);
        expect(superRes.tier).toBe('post-completion');
      }
    });

    it('prevents cancelling an already-cancelled booking even for Super Admin', () => {
      const res = evaluateCancellationGovernance(
        { stage: 'Cancelled', status: 'Cancelled' },
        true
      );
      expect(res.allowed).toBe(false);
      expect(res.tier).toBe('already-cancelled');
    });
  });

  describe('computeCancellationSettlement', () => {
    it('closes with zero funds collected when cancelled at EOI with no paid installments', () => {
      const payments = [
        makePay({ id: 'dp', type: 'Down Payment', installmentNumber: null, scheduledAmount: 100000 }),
        makePay({ id: 'ins-1', scheduledAmount: 1700000 }),
      ];
      const summary = computeCancellationSettlement({ totalPaid: 0, status: 'Cancelled' }, payments);
      expect(summary.grossCollected).toBe(0);
      expect(summary.cancellationFee).toBe(0);
      expect(summary.netRefundable).toBe(0);
      expect(summary.unpaidObligationRows).toHaveLength(2);
      expect(summary.settlementStatus).toBe('no-payment-closed');
    });

    it('computes net refundable after down payment, full installments, and 5% fee', () => {
      const payments = [
        makePay({
          id: 'dp',
          type: 'Down Payment',
          installmentNumber: null,
          scheduledAmount: 100000,
          receivedAmount: 100000,
          status: 'Paid',
        }),
        makePay({
          id: 'ins-1',
          scheduledAmount: 1700000,
          receivedAmount: 1700000,
          status: 'Paid',
        }),
        makePay({
          id: 'ins-2',
          installmentNumber: 2,
          scheduledAmount: 1700000,
          receivedAmount: 0,
          status: 'Scheduled',
        }),
      ];
      // Total collected = 1,800,000; 5% fee = 90,000; net refundable = 1,710,000
      const summary = computeCancellationSettlement(
        { totalPaid: 1800000, status: 'Active' },
        payments,
        90000
      );
      expect(summary.grossCollected).toBe(1800000);
      expect(summary.cancellationFee).toBe(90000);
      expect(summary.netRefundable).toBe(1710000);
      expect(summary.unpaidObligationRows.map((p) => p.id)).toEqual(['ins-2']);
      expect(summary.settlementStatus).toBe('refund-pending');
    });

    it('includes realized partial payment and paid parking add-on while excluding unpaid parking', () => {
      const payments = [
        makePay({
          id: 'dp',
          type: 'Down Payment',
          installmentNumber: null,
          scheduledAmount: 100000,
          receivedAmount: 100000,
          status: 'Paid',
        }),
        makePay({
          id: 'ins-partial',
          scheduledAmount: 1700000,
          receivedAmount: 500000,
          status: 'Partially Paid',
        }),
        makePay({
          id: 'pkg-paid',
          type: 'Add-on Invoice (Parking)',
          installmentNumber: null,
          scheduledAmount: 500000,
          receivedAmount: 500000,
          status: 'Paid',
        }),
        makePay({
          id: 'pkg-unpaid',
          type: 'Add-on Invoice (Parking)',
          installmentNumber: null,
          scheduledAmount: 500000,
          receivedAmount: 0,
          status: 'Scheduled',
        }),
      ];

      const summary = computeCancellationSettlement({ totalPaid: 1100000, status: 'Active' }, payments);
      expect(summary.grossCollected).toBe(1100000);
      expect(summary.partiallyPaidRows.map((r) => r.id)).toEqual(['ins-partial']);
      expect(summary.unpaidObligationRows.map((r) => r.id)).toEqual(['pkg-unpaid']);
    });

    it('handles 100% forfeiture deduction and partial/full refund disbursements', () => {
      const basePaid = makePay({
        id: 'dp',
        type: 'Down Payment',
        installmentNumber: null,
        scheduledAmount: 200000,
        receivedAmount: 200000,
        status: 'Paid',
      });

      const forfeited = computeCancellationSettlement(
        { totalPaid: 200000, status: 'Cancelled' },
        [
          basePaid,
          makePay({
            id: 'fee-1',
            type: CANCELLATION_FEE_TYPE,
            installmentNumber: null,
            scheduledAmount: 200000,
            receivedAmount: 0,
            status: 'Deducted',
          }),
        ]
      );
      expect(forfeited.netRefundable).toBe(0);
      expect(forfeited.settlementStatus).toBe('forfeited');

      const partialRefund = computeCancellationSettlement(
        { totalPaid: 200000, status: 'Cancelled' },
        [
          basePaid,
          makePay({
            id: 'fee-1',
            type: CANCELLATION_FEE_TYPE,
            installmentNumber: null,
            scheduledAmount: 20000,
            status: 'Deducted',
          }),
          makePay({
            id: 'rfn-1',
            type: REFUND_PAYOUT_TYPE,
            installmentNumber: null,
            scheduledAmount: -180000,
            receivedAmount: -100000,
            status: 'Partially Refunded',
          }),
        ]
      );
      expect(partialRefund.netRefundable).toBe(180000);
      expect(partialRefund.refundDisbursed).toBe(100000);
      expect(partialRefund.refundRemaining).toBe(80000);
      expect(partialRefund.settlementStatus).toBe('partially-refunded');

      const fullRefund = computeCancellationSettlement(
        { totalPaid: 200000, status: 'Cancelled' },
        [
          basePaid,
          makePay({
            id: 'rfn-2',
            type: REFUND_PAYOUT_TYPE,
            installmentNumber: null,
            scheduledAmount: -200000,
            receivedAmount: -200000,
            status: 'Refunded',
          }),
        ]
      );
      expect(fullRefund.refundRemaining).toBe(0);
      expect(fullRefund.settlementStatus).toBe('refunded');
    });

    it('detects legacy cancelled bookings with collected funds but no Refund Payout row', () => {
      const legacy = computeCancellationSettlement(
        { totalPaid: 350000, status: 'Cancelled' },
        [
          makePay({
            id: 'dp',
            type: 'Down Payment',
            installmentNumber: null,
            scheduledAmount: 350000,
            receivedAmount: 350000,
            status: 'Paid',
          }),
        ]
      );
      expect(legacy.settlementStatus).toBe('unsettled-legacy');
      expect(legacy.netRefundable).toBe(350000);
    });
  });

  describe('generateCancellationLegalRef', () => {
    it('generates a deterministic VN-CXL-YYYY-CODE reference from a bookingRef and falls back cleanly', () => {
      const refDate = new Date('2026-11-24T12:00:00Z');
      expect(generateCancellationLegalRef('VN-2026-9354', refDate)).toBe('VN-CXL-2026-9354');
      expect(generateCancellationLegalRef('bk-abc12345', refDate)).toBe('VN-CXL-2026-C12345');
      expect(generateCancellationLegalRef(null, refDate)).toMatch(/^VN-CXL-2026-\d{4}$/);
      expect(generateCancellationLegalRef('', refDate)).toMatch(/^VN-CXL-2026-\d{4}$/);
    });
  });

  describe('generateCashRefundVoucherRef & getRefundPayoutRefMeta', () => {
    it('generates cash voucher numbers and adapts reference metadata by payout mode', () => {
      const refDate = new Date('2026-11-24T12:00:00Z');
      expect(generateCashRefundVoucherRef('VN-2026-8687', refDate)).toBe('CV-2026-8687');
      expect(generateCashRefundVoucherRef('', refDate)).toMatch(/^CV-2026-\d{4}$/);

      expect(getRefundPayoutRefMeta('Cash')).toMatchObject({
        label: 'Cash Payment Voucher No.',
        supportsAutoGenerate: true,
      });
      expect(getRefundPayoutRefMeta('Bank Transfer (BEFTN/RTGS)')).toMatchObject({
        label: 'BEFTN / RTGS Transaction Ref',
        supportsAutoGenerate: false,
      });
      expect(getRefundPayoutRefMeta('Account Payee Cheque')).toMatchObject({
        label: 'Cheque Number',
        supportsAutoGenerate: false,
      });
      expect(getRefundPayoutRefMeta('Pay Order')).toMatchObject({
        label: 'Pay Order Number',
        supportsAutoGenerate: false,
      });
      expect(getRefundPayoutRefMeta('Mobile Banking (bKash/Nagad)')).toMatchObject({
        label: 'Mobile Banking TrxID',
        supportsAutoGenerate: false,
      });
    });
  });
});
