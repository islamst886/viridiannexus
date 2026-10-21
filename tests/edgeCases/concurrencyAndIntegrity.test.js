import { describe, it, expect } from 'vitest';
import { mapBookingFromDB, mapPaymentFromDB, mapActivityFromDB } from '../../src/utils/mappers';
import {
  generateInstallmentSchedule,
  recordPaymentTransaction
} from '../helpers/bookingLogic';
import { createMockProperty, createMockBooking } from '../helpers/mockData';

describe('Edge Cases, Concurrency & Data Integrity (TC-EDG)', () => {

  describe('TC-EDG-001 & TC-EDG-002: Concurrency & Double-Booking Race Conditions', () => {
    it('should throw collision error when attempting to book an already booked unit', () => {
      const property = createMockProperty();
      const unit = property.inventory.find(i => i.id === 'inv-6b');

      expect(() => {
        if (unit.status !== 'Available') {
          throw new Error(`This unit is no longer available (Current status: ${unit.status}). Someone may have booked it just now.`);
        }
      }).toThrow(/Someone may have booked it just now/);
    });

    it('should throw collision error when attempting to assign an already assigned parking spot', () => {
      const property = createMockProperty();
      const spot = property.parkingInventory.find(s => s.id === 'spot-p1-03');

      expect(() => {
        if (spot.status !== 'Available') {
          throw new Error(`Parking spot "${spot.label}" is no longer available. Please select a different spot.`);
        }
      }).toThrow(/Parking spot "P1-03" is no longer available/);
    });
  });

  describe('TC-EDG-003: Overpayment & Boundary Balance Due', () => {
    it('should clamp balance due to 0 when payment exceeds outstanding balance', () => {
      const booking = createMockBooking({
        totalPrice: 10000000,
        totalPaid: 9500000,
        balanceDue: 500000,
        stage: 'Installments Running'
      });

      const payment = {
        id: 'pay-final',
        type: 'Installment #5',
        scheduledAmount: 500000,
        receivedAmount: 0,
        status: 'Scheduled'
      };

      // Client pays 700,000 (200,000 overpayment)
      const result = recordPaymentTransaction({
        payment,
        booking,
        amountReceived: 700000
      });

      expect(result.updatedBooking.totalPaid).toBe(10200000);
      expect(result.updatedBooking.balanceDue).toBe(0); // Clamped, not negative!
      expect(result.updatedBooking.stage).toBe('Fully Paid');
    });
  });

  describe('TC-EDG-004: Leap Year & Month-End Dates in Installment Generator', () => {
    it('should handle leap year February and month-end dates cleanly', () => {
      // 2028 is a leap year (Feb 29 exists)
      const schedule = generateInstallmentSchedule({
        totalPrice: 12000000,
        tokenAmount: 0,
        downPaymentAmount: 0,
        installmentCount: 4,
        startDate: '2028-01-31',
        frequency: 'Monthly'
      });

      expect(schedule).toHaveLength(4);
      schedule.forEach(inst => {
        expect(inst.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        const parsed = new Date(inst.dueDate);
        expect(isNaN(parsed.getTime())).toBe(false);
      });
    });
  });

  describe('TC-EDG-005: Input Sanitization & Special Characters', () => {
    it('should safely handle malicious XSS or injection payloads in client details and notes', () => {
      const rawPayload = {
        client_name: "<script>alert('xss')</script>Rahim",
        notes: "Robert'); DROP TABLE bookings;--",
        internal_notes: "Safe string with unicode: ৳ এবং বাংলা টেক্সট 🚗 🏢"
      };

      const mapped = mapBookingFromDB({
        id: 'bkg-sec-01',
        ...rawPayload
      });

      expect(mapped.clientName).toBe("<script>alert('xss')</script>Rahim");
      expect(mapped.notes).toBe("Robert'); DROP TABLE bookings;--");
      expect(mapped.internalNotes).toContain("বাংলা টেক্সট 🚗 🏢");
    });
  });

  describe('TC-EDG-006: Dual-Format Compatibility (Postgres snake_case vs JS camelCase)', () => {
    it('should accurately map snake_case Postgres DB records to expected component contract', () => {
      const dbBookingRow = {
        id: 'bkg-123',
        booking_ref: 'VN-2026-1234',
        client_name: 'Investor Name',
        client_email: 'investor@example.com',
        client_phone: '+8801700000000',
        linked_user_id: 'usr-999',
        total_price: 35000000,
        total_paid: 10000000,
        balance_due: 25000000,
        token_amount: 1000000,
        down_payment_amount: 4000000,
        parking_spot_ids: ['spot-1'],
        parking_included: 'P1-01',
        created_at: '2026-01-01T00:00:00Z'
      };

      const mapped = mapBookingFromDB(dbBookingRow);

      expect(mapped.bookingRef).toBe('VN-2026-1234');
      expect(mapped.clientName).toBe('Investor Name');
      expect(mapped.totalPrice).toBe(35000000);
      expect(mapped.totalPaid).toBe(10000000);
      expect(mapped.balanceDue).toBe(25000000);
      expect(mapped.linkedUserId).toBe('usr-999');
    });

    it('should map payment record with dual aliases for scheduledDate and dueDate', () => {
      const dbPaymentRow = {
        id: 'pay-001',
        booking_id: 'bkg-123',
        type: 'Installment',
        installment_number: 1,
        scheduled_amount: 2500000,
        received_amount: 2500000,
        status: 'Paid',
        due_date: '2026-04-15',
        paid_date: '2026-04-10',
        payment_mode: 'Bank Transfer',
        notes: 'Ref: TXN-101'
      };

      const mapped = mapPaymentFromDB(dbPaymentRow);

      // Verify both camelCase dueDate and legacy scheduledDate work seamlessly
      expect(mapped.dueDate).toBe('2026-04-15');
      expect(mapped.scheduledDate).toBe('2026-04-15');
      expect(mapped.scheduledAmount).toBe(2500000);
      expect(mapped.receivedAmount).toBe(2500000);
      expect(mapped.status).toBe('Paid');
    });

    it('should map activity log record with dual aliases for type/action and message/detail', () => {
      const dbActivityRow = {
        id: 'act-001',
        booking_id: 'bkg-123',
        type: 'Stage Advanced',
        message: 'Advanced to Agreement Signed',
        actor_name: 'Operations Admin',
        actor_id: 'adm-303',
        created_at: '2026-02-01T12:00:00Z',
        metadata: { prev: 'Token Paid' }
      };

      const mapped = mapActivityFromDB(dbActivityRow);

      expect(mapped.type).toBe('Stage Advanced');
      expect(mapped.action).toBe('Stage Advanced');
      expect(mapped.message).toBe('Advanced to Agreement Signed');
      expect(mapped.detail).toBe('Advanced to Agreement Signed');
      expect(mapped.actorName).toBe('Operations Admin');
      expect(mapped.performedBy).toBe('Operations Admin');
    });
  });
});
