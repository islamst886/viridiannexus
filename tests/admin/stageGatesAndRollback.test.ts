import { describe, it, expect } from 'vitest';
import { evaluateStagePrerequisites } from '../../src/utils/bookingStageGates';
import { createMockBooking, createMockPayments } from '../helpers/mockData';

describe('Admin Stage Gatekeeper & Progression Engine (TC-ADM-024 & TC-ADM-025)', () => {

  describe('Stage Gate: Down Payment Paid', () => {
    it('should block advancement to Down Payment Paid if down payment is unpaid', () => {
      const booking = createMockBooking({ stage: 'EOI', totalPaid: 0, balanceDue: 30000000 });
      const payments = [
        { type: 'Down Payment', scheduledAmount: 4500000, receivedAmount: 0, status: 'Scheduled' },
      ];

      const evaluation = evaluateStagePrerequisites('Down Payment Paid', booking, payments);
      expect(evaluation.allowed).toBe(false);
      expect(evaluation.requirements.find((r) => r.id === 'downpayment_payment')?.met).toBe(false);
      expect(evaluation.summary).toContain('Cannot advance to "Down Payment Paid"');
    });

    it('should allow advancement to Down Payment Paid once Down Payment is paid in ledger', () => {
      const booking = createMockBooking({ stage: 'EOI', totalPaid: 4500000, balanceDue: 25500000 });
      const payments = [
        { type: 'Down Payment', scheduledAmount: 4500000, receivedAmount: 4500000, status: 'Paid' },
      ];

      const evaluation = evaluateStagePrerequisites('Down Payment Paid', booking, payments);
      expect(evaluation.allowed).toBe(true);
      expect(evaluation.requirements[0].met).toBe(true);
      expect(evaluation.summary).toContain('All prerequisites for "Down Payment Paid" are satisfied');
    });

    it('should allow Down Payment Paid when booking is explicitly configured with zero down payment', () => {
      const booking = createMockBooking({
        stage: 'EOI',
        downPaymentAmount: 0,
        totalPaid: 0,
        balanceDue: 30000000,
      });

      const evaluation = evaluateStagePrerequisites('Down Payment Paid', booking, []);
      expect(evaluation.allowed).toBe(true);
    });
  });

  describe('Stage Gate: Agreement Signed', () => {
    it('should require down payment cleared before allowing Agreement Signed', () => {
      const booking = createMockBooking({ stage: 'EOI', totalPaid: 0 });
      const payments = [
        { type: 'Down Payment', scheduledAmount: 4500000, receivedAmount: 0, status: 'Scheduled' },
      ];

      const evaluation = evaluateStagePrerequisites('Agreement Signed', booking, payments);
      expect(evaluation.allowed).toBe(false);
      expect(evaluation.requirements.find((r) => r.id === 'downpayment_prereq')?.met).toBe(false);
    });

    it('should permit Agreement Signed once down payment is confirmed paid', () => {
      const booking = createMockBooking({ stage: 'Down Payment Paid', totalPaid: 4500000 });
      const payments = [
        { type: 'Down Payment', scheduledAmount: 4500000, receivedAmount: 4500000, status: 'Paid' },
      ];

      const evaluation = evaluateStagePrerequisites('Agreement Signed', booking, payments);
      expect(evaluation.allowed).toBe(true);
    });
  });

  describe('Stage Gate: Installments Running', () => {
    it('should require down payment settled and active installments to exist in ledger', () => {
      const booking = createMockBooking({ stage: 'Agreement Signed', totalPaid: 4500000 });
      const paymentsWithInstallments = [
        { type: 'Down Payment', status: 'Paid', scheduledAmount: 4500000, receivedAmount: 4500000 },
        { type: 'Installment #1', status: 'Scheduled', scheduledAmount: 2000000 },
      ];

      const evaluation = evaluateStagePrerequisites(
        'Installments Running',
        booking,
        paymentsWithInstallments
      );
      expect(evaluation.allowed).toBe(true);
    });
  });

  describe('Stage Gate: Fully Paid', () => {
    it('should block Fully Paid if outstanding balance remains', () => {
      const booking = createMockBooking({
        stage: 'Installments Running',
        totalPrice: 30000000,
        totalPaid: 25000000,
        balanceDue: 5000000,
      });
      const payments = [
        { type: 'Installment #10', status: 'Scheduled', scheduledAmount: 5000000 },
      ];

      const evaluation = evaluateStagePrerequisites('Fully Paid', booking, payments);
      expect(evaluation.allowed).toBe(false);
      expect(evaluation.requirements.find((r) => r.id === 'zero_balance')?.met).toBe(false);
      expect(evaluation.requirements.find((r) => r.id === 'ledger_all_cleared')?.met).toBe(false);
    });

    it('should allow Fully Paid when balance is zero and all payments are cleared', () => {
      const booking = createMockBooking({
        stage: 'Installments Running',
        totalPrice: 30000000,
        totalPaid: 30000000,
        balanceDue: 0,
      });
      const payments = [
        { type: 'Installment #1', status: 'Paid', scheduledAmount: 15000000, receivedAmount: 15000000 },
        { type: 'Installment #2', status: 'Paid', scheduledAmount: 15000000, receivedAmount: 15000000 },
      ];

      const evaluation = evaluateStagePrerequisites('Fully Paid', booking, payments);
      expect(evaluation.allowed).toBe(true);
      expect(evaluation.requirements.every((r) => r.met)).toBe(true);
    });
  });

  describe('Stage Gate: Handover', () => {
    it('CRITICAL: Property cannot be handed over with outstanding dues', () => {
      const booking = createMockBooking({
        stage: 'Installments Running',
        totalPrice: 30000000,
        totalPaid: 29000000,
        balanceDue: 1000000,
        agreementDate: '2026-02-01',
      });
      const payments = [
        { type: 'Installment #5', status: 'Scheduled', scheduledAmount: 1000000 },
      ];

      const evaluation = evaluateStagePrerequisites('Handover', booking, payments);
      expect(evaluation.allowed).toBe(false);
      expect(evaluation.requirements.find((r) => r.id === 'fully_paid_prereq')?.details).toContain(
        'Property cannot be handed over with outstanding dues'
      );
    });

    it('should allow Handover when zero balance due and agreement was executed', () => {
      const booking = createMockBooking({
        stage: 'Fully Paid',
        totalPrice: 30000000,
        totalPaid: 30000000,
        balanceDue: 0,
        agreementDate: '2026-02-01',
      });
      const payments = [
        { type: 'Down Payment', status: 'Paid', scheduledAmount: 5000000, receivedAmount: 5000000 },
        { type: 'Full Payment', status: 'Paid', scheduledAmount: 25000000, receivedAmount: 25000000 },
      ];

      const evaluation = evaluateStagePrerequisites('Handover', booking, payments);
      expect(evaluation.allowed).toBe(true);
    });
  });

  describe('TC-ADM-025: Backward Stage Rollback', () => {
    it('should detect rollback and display preservation warning when reverting stage', () => {
      const booking = createMockBooking({ stage: 'Agreement Signed' });
      const payments = createMockPayments();

      const evaluation = evaluateStagePrerequisites('Down Payment Paid', booking, payments);
      expect(evaluation.allowed).toBe(true);
      expect(evaluation.isRollback).toBe(true);
      expect(evaluation.requirements[0].details).toContain(
        'Reverting stage from "Agreement Signed" back to "Down Payment Paid"'
      );
    });
  });

  describe('Same Stage Evaluation', () => {
    it('should detect when booking is already at target stage', () => {
      const booking = createMockBooking({ stage: 'Down Payment Paid' });
      const evaluation = evaluateStagePrerequisites('Down Payment Paid', booking, []);
      expect(evaluation.allowed).toBe(true);
      expect(evaluation.isRollback).toBe(false);
      expect(evaluation.summary).toContain('Booking is currently at Down Payment Paid');
    });
  });
});
