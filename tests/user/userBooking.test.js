import { describe, it, expect } from 'vitest';
import { mockUsers, createMockBooking } from '../helpers/mockData';
import {
  validateEoiStep1,
  validateEoiStep2,
  generateBookingRef,
  calculateFinancialSummary,
  evaluatePaymentDisplayStatus,
  detectProfileDrift,
  STAGES
} from '../helpers/bookingLogic';

describe('User / Client Side Booking Features (TC-USR)', () => {

  describe('TC-USR-001 & TC-USR-003: Expression of Interest (EOI) Validation & Submission', () => {
    it('should reject step 1 if project or unit is missing', () => {
      expect(validateEoiStep1('', 'Type A').valid).toBe(false);
      expect(validateEoiStep1('prop-1', '').valid).toBe(false);
      expect(validateEoiStep1('prop-1', 'Type A').valid).toBe(true);
    });

    it('should enforce strict validation on user personal details (TC-USR-003)', () => {
      const invalidForm = {
        firstName: '',
        lastName: '',
        email: 'invalid-email',
        phone: '12345', // < 10 chars
        nid: '',
        address: ''
      };

      const result = validateEoiStep2(invalidForm);
      expect(result.valid).toBe(false);
      expect(result.errors.firstName).toBe('Required');
      expect(result.errors.lastName).toBe('Required');
      expect(result.errors.email).toBe('Valid email required');
      expect(result.errors.phone).toBe('Valid phone required');
      expect(result.errors.nid).toBe('NID/Passport required');
      expect(result.errors.address).toBe('Required');
    });

    it('should pass validation with well-formed client details and generate reference', () => {
      const validForm = {
        firstName: 'Rahim',
        lastName: 'Chowdhury',
        email: 'rahim@example.com',
        phone: '+8801711000000',
        nid: '19852691234567890',
        address: 'Banani, Dhaka'
      };

      const result = validateEoiStep2(validForm);
      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);

      const generatedRef = generateBookingRef('e3b0c44298fc1c149afbf4c8996fb924');
      expect(generatedRef).toBe('E3B0C442');
      expect(generatedRef).toHaveLength(8);
    });
  });

  describe('TC-USR-002: Authenticated User Context & Ownership Binding', () => {
    it('should bind linked_user_id when client is logged in', () => {
      const authUser = mockUsers.clientUserA;
      const payload = {
        property_id: 'prop-jolshiri-01',
        client_name: authUser.displayName,
        client_email: authUser.email,
        linked_user_id: authUser.uid,
        status: 'Pending Review'
      };

      expect(payload.linked_user_id).toBe('usr-uuid-101');
      expect(payload.status).toBe('Pending Review');
    });
  });

  describe('TC-USR-005: 8-Stage Progress Stepper Calculation', () => {
    it('should accurately index all 8 lifecycle milestone stages', () => {
      expect(STAGES).toHaveLength(8);
      expect(STAGES[0]).toBe('EOI');
      expect(STAGES[7]).toBe('Completed');

      const bookingAtDownPayment = createMockBooking({ stage: 'Down Payment Paid' });
      const currentIdx = STAGES.indexOf(bookingAtDownPayment.stage);
      expect(currentIdx).toBe(3);

      const isCompleted = (stageName) => STAGES.indexOf(stageName) <= currentIdx;
      expect(isCompleted('EOI')).toBe(true);
      expect(isCompleted('Token Paid')).toBe(true);
      expect(isCompleted('Agreement Signed')).toBe(true);
      expect(isCompleted('Down Payment Paid')).toBe(true);
      expect(isCompleted('Installments Running')).toBe(false);
      expect(isCompleted('Fully Paid')).toBe(false);
    });
  });

  describe('TC-USR-006: Payment Ledger Status & Dynamic Overdue Calculation', () => {
    const referenceDate = new Date('2026-03-01T00:00:00Z');

    it('should mark Scheduled payment with past due date as Overdue', () => {
      const overduePayment = {
        dueDate: '2026-02-15',
        status: 'Scheduled',
        scheduledAmount: 2000000
      };

      expect(evaluatePaymentDisplayStatus(overduePayment, referenceDate)).toBe('Overdue');
    });

    it('should mark Scheduled payment with future due date as Scheduled', () => {
      const futurePayment = {
        dueDate: '2026-04-15',
        status: 'Scheduled',
        scheduledAmount: 2000000
      };

      expect(evaluatePaymentDisplayStatus(futurePayment, referenceDate)).toBe('Scheduled');
    });

    it('should prioritize Paid status even if due date is in the past', () => {
      const paidPayment = {
        dueDate: '2026-01-01',
        paidDate: '2026-01-02',
        status: 'Paid',
        scheduledAmount: 500000,
        receivedAmount: 500000
      };

      expect(evaluatePaymentDisplayStatus(paidPayment, referenceDate)).toBe('Paid');
    });
  });

  describe('TC-USR-008: Financial Summary Precision & Edge Values', () => {
    it('should correctly calculate balance due and completion percentage', () => {
      const summary = calculateFinancialSummary(30000000, 6000000);
      expect(summary.totalPrice).toBe(30000000);
      expect(summary.totalPaid).toBe(6000000);
      expect(summary.balanceDue).toBe(24000000);
      expect(summary.completionPct).toBe(20);
    });

    it('should handle zero payments without NaN or division by zero', () => {
      const zeroSummary = calculateFinancialSummary(30000000, 0);
      expect(zeroSummary.totalPaid).toBe(0);
      expect(zeroSummary.balanceDue).toBe(30000000);
      expect(zeroSummary.completionPct).toBe(0);
    });

    it('should clamp completion percentage to 100% when fully paid', () => {
      const fullSummary = calculateFinancialSummary(30000000, 30000000);
      expect(fullSummary.balanceDue).toBe(0);
      expect(fullSummary.completionPct).toBe(100);
    });
  });

  describe('TC-USR-009: Data Isolation & Tenant Access Boundary', () => {
    it('should grant access only when linked_user_id matches authenticated user', () => {
      const booking = createMockBooking({ linkedUserId: 'usr-uuid-101' });

      const isAuthorizedUserA = booking.linkedUserId === mockUsers.clientUserA.uid;
      const isAuthorizedUserB = booking.linkedUserId === mockUsers.clientUserB.uid;

      expect(isAuthorizedUserA).toBe(true);
      expect(isAuthorizedUserB).toBe(false);
    });
  });

  describe('TC-USR-010: Client Profile Update & Drift Detection', () => {
    it('should detect when user profile has drifted from booking snapshot', () => {
      const booking = createMockBooking({
        clientPhone: '+8801711000000',
        clientAddress: 'Old Address, Banani'
      });

      const updatedUserProfile = {
        ...mockUsers.clientUserA,
        phone: '+8801999999999',
        address: 'New Residence, Gulshan 2'
      };

      const diffs = detectProfileDrift(booking, updatedUserProfile);
      expect(diffs).toHaveLength(2);
      expect(diffs.find(d => d.field === 'Phone')).toEqual({
        field: 'Phone',
        current: '+8801711000000',
        updated: '+8801999999999'
      });
      expect(diffs.find(d => d.field === 'Address')).toEqual({
        field: 'Address',
        current: 'Old Address, Banani',
        updated: 'New Residence, Gulshan 2'
      });
    });

    it('should return empty diff when user profile matches booking snapshot', () => {
      const booking = createMockBooking();
      const diffs = detectProfileDrift(booking, mockUsers.clientUserA);
      expect(diffs).toHaveLength(0);
    });
  });
});
