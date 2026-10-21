import { describe, it, expect } from 'vitest';
import { createMockBooking } from '../helpers/mockData';
import {
  recordPaymentTransaction,
  addCustomScheduledPayment
} from '../helpers/bookingLogic';

describe('Admin Payment Ledger & Financial Management (TC-ADM)', () => {

  describe('TC-ADM-020: Record Full Payment', () => {
    it('should mark scheduled payment as Paid and update booking totals', () => {
      const booking = createMockBooking({
        totalPrice: 30000000,
        totalPaid: 500000,
        balanceDue: 29500000,
        stage: 'Token Paid'
      });

      const payment = {
        id: 'pay-dp-01',
        type: 'Down Payment',
        scheduledAmount: 4500000,
        receivedAmount: 0,
        status: 'Scheduled'
      };

      const result = recordPaymentTransaction({
        payment,
        booking,
        amountReceived: 4500000,
        mode: 'Bank Transfer',
        ref: 'TXN-DP-12345',
        note: 'Eastern Bank remittance'
      });

      expect(result.updatedPayment.status).toBe('Paid');
      expect(result.updatedPayment.receivedAmount).toBe(4500000);
      expect(result.updatedPayment.notes).toBe('Ref: TXN-DP-12345 | Eastern Bank remittance');
      expect(result.updatedBooking.totalPaid).toBe(5000000);
      expect(result.updatedBooking.balanceDue).toBe(25000000);
      expect(result.activityMessage).toContain('Down Payment payment of ৳45,00,000 received via Bank Transfer (Ref: TXN-DP-12345)');
    });
  });

  describe('TC-ADM-021: Record Partial Payment', () => {
    it('should mark payment as Partially Paid when received amount is less than scheduled', () => {
      const booking = createMockBooking({
        totalPrice: 10000000,
        totalPaid: 0,
        balanceDue: 10000000
      });

      const payment = {
        id: 'pay-inst-1',
        type: 'Installment #1',
        scheduledAmount: 2000000,
        receivedAmount: 0,
        status: 'Scheduled'
      };

      const result = recordPaymentTransaction({
        payment,
        booking,
        amountReceived: 1200000,
        mode: 'Cash'
      });

      expect(result.updatedPayment.status).toBe('Partially Paid');
      expect(result.updatedPayment.receivedAmount).toBe(1200000);
      expect(result.updatedBooking.totalPaid).toBe(1200000);
      expect(result.updatedBooking.balanceDue).toBe(8800000);
    });
  });

  describe('TC-ADM-022: Automatic Stage Progression on Cleared Payments', () => {
    it('should automatically advance EOI to Token Paid upon full token payment', () => {
      const booking = createMockBooking({ stage: 'EOI', totalPaid: 0, balanceDue: 30000000 });
      const tokenPayment = {
        id: 'pay-token',
        type: 'Token',
        scheduledAmount: 500000,
        receivedAmount: 0,
        status: 'Scheduled'
      };

      const result = recordPaymentTransaction({
        payment: tokenPayment,
        booking,
        amountReceived: 500000
      });

      expect(result.updatedBooking.stage).toBe('Token Paid');
    });

    it('should automatically advance to Down Payment Paid upon full down payment', () => {
      const booking = createMockBooking({ stage: 'Agreement Signed', totalPaid: 500000 });
      const dpPayment = {
        id: 'pay-dp',
        type: 'Down Payment',
        scheduledAmount: 4500000,
        receivedAmount: 0,
        status: 'Scheduled'
      };

      const result = recordPaymentTransaction({
        payment: dpPayment,
        booking,
        amountReceived: 4500000
      });

      expect(result.updatedBooking.stage).toBe('Down Payment Paid');
    });

    it('should automatically advance to Fully Paid when balance reaches zero', () => {
      const booking = createMockBooking({
        stage: 'Installments Running',
        totalPrice: 10000000,
        totalPaid: 8000000,
        balanceDue: 2000000
      });

      const finalPayment = {
        id: 'pay-final',
        type: 'Installment #4',
        scheduledAmount: 2000000,
        receivedAmount: 0,
        status: 'Scheduled'
      };

      const result = recordPaymentTransaction({
        payment: finalPayment,
        booking,
        amountReceived: 2000000
      });

      expect(result.updatedBooking.balanceDue).toBe(0);
      expect(result.updatedBooking.stage).toBe('Fully Paid');
    });
  });

  describe('TC-ADM-023: Custom Scheduled Payments (Utility / Penalties)', () => {
    it('should add new scheduled payment and dynamically inflate total price & balance due', () => {
      const booking = createMockBooking({
        totalPrice: 30000000,
        totalPaid: 10000000,
        balanceDue: 20000000
      });

      const result = addCustomScheduledPayment({
        booking,
        type: 'Gas Connection & Rooftop Solar Fee',
        amount: 350000,
        dueDate: '2026-09-01'
      });

      expect(result.newPayment.scheduledAmount).toBe(350000);
      expect(result.newPayment.type).toBe('Gas Connection & Rooftop Solar Fee');
      expect(result.newPayment.dueDate).toBe('2026-09-01');
      expect(result.updatedBooking.totalPrice).toBe(30350000);
      expect(result.updatedBooking.balanceDue).toBe(20350000);
    });

    it('should reject custom payment with zero or negative amount', () => {
      const booking = createMockBooking();
      expect(() => addCustomScheduledPayment({
        booking,
        type: 'Invalid Fee',
        amount: 0,
        dueDate: '2026-09-01'
      })).toThrow(/Amount must be greater than zero/);
    });
  });
});
