import { describe, it, expect } from 'vitest';
import { createMockProperty, mockUsers } from '../helpers/mockData';
import {
  calculateBookingTotal,
  validateBookingWizardStep,
  generateInstallmentSchedule,
  simulateBookingCreation
} from '../helpers/bookingLogic';

describe('Admin Direct Booking Creation Engine (TC-ADM)', () => {

  describe('TC-ADM-004: Unit Pricing Rollup & Inventory Selection', () => {
    it('should accurately calculate total price combining base unit, parking spots, and adjustment', () => {
      const total = calculateBookingTotal({
        basePrice: 30000000,
        parkingPricePerSpot: 500000,
        parkingSpotIds: ['spot-p1-01', 'spot-p1-02'], // 2 spots = 1,000,000
        pricingAdjustment: -500000 // 500,000 discount
      });

      expect(total).toBe(30500000);
    });

    it('should validate step 1 requirements', () => {
      expect(validateBookingWizardStep(1, { propertyId: '', inventoryId: 'inv-1' }).valid).toBe(false);
      expect(validateBookingWizardStep(1, { propertyId: 'prop-1', inventoryId: '' }).valid).toBe(false);
      expect(validateBookingWizardStep(1, { propertyId: 'prop-1', inventoryId: 'inv-1' }).valid).toBe(true);
    });
  });

  describe('TC-ADM-005: Mandatory Client Account Linkage', () => {
    it('should reject step 2 when linkedUserId is missing', () => {
      const step2Form = {
        linkedUserId: null,
        clientName: 'Client Name',
        clientEmail: 'client@example.com',
        clientPhone: '01700000000',
        clientNid: '1234567890',
        clientAddress: 'Dhaka'
      };

      const result = validateBookingWizardStep(2, step2Form);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Linking a user account is mandatory.');
    });

    it('should pass step 2 when client account is linked and all details are present', () => {
      const step2Form = {
        linkedUserId: mockUsers.clientUserA.uid,
        clientName: mockUsers.clientUserA.displayName,
        clientEmail: mockUsers.clientUserA.email,
        clientPhone: mockUsers.clientUserA.phone,
        clientNid: mockUsers.clientUserA.nid,
        clientAddress: mockUsers.clientUserA.address
      };

      const result = validateBookingWizardStep(2, step2Form);
      expect(result.valid).toBe(true);
    });
  });

  describe('TC-ADM-006: Commercial Validation & Constraints', () => {
    it('should reject if token amount exceeds total price', () => {
      const step3Form = {
        totalPrice: 20000000,
        tokenAmount: 25000000,
        downPaymentAmount: 0,
        installmentCount: 10,
        installmentStartDate: '2026-05-01',
        installmentFrequency: 'Monthly'
      };

      const result = validateBookingWizardStep(3, step3Form);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token cannot exceed total price.');
    });
  });

  describe('TC-ADM-007 & TC-ADM-008: Multi-Frequency Installments & Penny Rounding Allocation', () => {
    it('should generate monthly installments with exact date progression', () => {
      const schedule = generateInstallmentSchedule({
        totalPrice: 30000000,
        tokenAmount: 500000,
        downPaymentAmount: 4500000,
        installmentCount: 3,
        startDate: '2026-01-01',
        frequency: 'Monthly'
      });

      expect(schedule).toHaveLength(3);
      expect(schedule[0].dueDate).toBe('2026-01-01');
      expect(schedule[1].dueDate).toBe('2026-02-01');
      expect(schedule[2].dueDate).toBe('2026-03-01');
    });

    it('should generate quarterly installments with 3-month gaps', () => {
      const schedule = generateInstallmentSchedule({
        totalPrice: 30000000,
        tokenAmount: 500000,
        downPaymentAmount: 4500000,
        installmentCount: 4,
        startDate: '2026-01-15',
        frequency: 'Quarterly'
      });

      expect(schedule).toHaveLength(4);
      expect(schedule[0].dueDate).toBe('2026-01-15');
      expect(schedule[1].dueDate).toBe('2026-04-15');
      expect(schedule[2].dueDate).toBe('2026-07-15');
      expect(schedule[3].dueDate).toBe('2026-10-15');
    });

    it('should strictly absorb rounding remainder on the final installment (TC-ADM-008)', () => {
      const schedule = generateInstallmentSchedule({
        totalPrice: 10000000,
        tokenAmount: 0,
        downPaymentAmount: 0,
        installmentCount: 3,
        startDate: '2026-06-01',
        frequency: 'Monthly'
      });

      expect(schedule).toHaveLength(3);
      expect(schedule[0].scheduledAmount).toBe(3333330);
      expect(schedule[1].scheduledAmount).toBe(3333330);
      expect(schedule[2].scheduledAmount).toBe(3333340);

      const totalInstallmentsSum = schedule.reduce((sum, item) => sum + item.scheduledAmount, 0);
      expect(totalInstallmentsSum).toBe(10000000);
    });
  });

  describe('TC-ADM-009: Atomic Persistence & Inventory State Mutation', () => {
    it('should lock unit to Booked and parking spots to Assigned with booking ID', () => {
      const property = createMockProperty();
      const form = {
        propertyId: property.id,
        inventoryId: 'inv-4a',
        parkingSpotIds: ['spot-p1-01', 'spot-p1-02'],
        clientName: 'Rahim Chowdhury',
        clientEmail: 'rahim@example.com',
        clientPhone: '01711000000',
        clientNid: '1234567890',
        clientAddress: 'Banani',
        linkedUserId: 'usr-101',
        totalPrice: 31000000,
        tokenAmount: 500000,
        downPaymentAmount: 4500000
      };

      const result = simulateBookingCreation({ property, form });

      expect(result.bookingDoc.id).toBe('bkg-new-999');
      expect(result.bookingDoc.bookingRef).toMatch(/^VN-2026-\d{4}$/);
      expect(result.bookingDoc.status).toBe('Active');
      expect(result.bookingDoc.stage).toBe('EOI');

      const updatedUnit = result.updatedInventory.find(i => i.id === 'inv-4a');
      expect(updatedUnit.status).toBe('Booked');

      const spot1 = result.updatedParkingInventory.find(s => s.id === 'spot-p1-01');
      const spot2 = result.updatedParkingInventory.find(s => s.id === 'spot-p1-02');
      expect(spot1.status).toBe('Assigned');
      expect(spot1.assignedBookingId).toBe('bkg-new-999');
      expect(spot2.status).toBe('Assigned');
      expect(spot2.assignedBookingId).toBe('bkg-new-999');
    });

    it('should throw an explicit error if unit is already booked (Concurrency test)', () => {
      const property = createMockProperty();
      const form = {
        propertyId: property.id,
        inventoryId: 'inv-6b',
        parkingSpotIds: ['spot-p1-01']
      };

      expect(() => simulateBookingCreation({ property, form })).toThrow(
        /This unit is no longer available/
      );
    });
  });
});
