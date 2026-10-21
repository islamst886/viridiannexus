import { describe, it, expect } from 'vitest';
import { createMockProperty, createMockBooking } from '../helpers/mockData';
import {
  reassignBookingUnit,
  addParkingSpotToBooking,
  releaseParkingSpotFromBooking,
  swapParkingSpotForBooking,
  cancelBookingAndReleaseAssets
} from '../helpers/bookingLogic';

describe('Admin Parking & Inventory Lifecycle (TC-ADM)', () => {

  describe('TC-ADM-015 & TC-ADM-016: Unit Reassignment', () => {
    it('should swap booked unit in the same property releasing the old unit', () => {
      const property = createMockProperty();
      const booking = createMockBooking({ inventoryId: 'inv-4a' });

      const result = reassignBookingUnit({
        booking,
        currentProperty: property,
        targetProperty: property,
        newInventoryId: 'inv-5a'
      });

      const oldUnit = result.updatedTargetInventory.find(i => i.id === 'inv-4a');
      const newUnit = result.updatedTargetInventory.find(i => i.id === 'inv-5a');

      expect(oldUnit.status).toBe('Available');
      expect(newUnit.status).toBe('Booked');
      expect(result.updatedBooking.inventoryId).toBe('inv-5a');
      expect(result.updatedBooking.unitNumber).toContain('Unit 5A');
    });

    it('should reject reassignment if target unit is already booked', () => {
      const property = createMockProperty();
      const booking = createMockBooking({ inventoryId: 'inv-4a' });

      expect(() => reassignBookingUnit({
        booking,
        currentProperty: property,
        targetProperty: property,
        newInventoryId: 'inv-6b'
      })).toThrow(/Unit Unit 6B is not available/);
    });
  });

  describe('TC-ADM-017: Mid-Booking Parking Allocation (Add Parking)', () => {
    it('should assign spot and generate scheduled payment invoice', () => {
      const property = createMockProperty();
      const booking = createMockBooking({
        parkingSpotIds: ['spot-p1-01'],
        totalPrice: 30000000,
        balanceDue: 25000000
      });

      const result = addParkingSpotToBooking({
        booking,
        property,
        spotId: 'spot-p1-02',
        generateInvoice: true,
        dueDate: '2026-07-01'
      });

      const assignedSpot = result.updatedParkingInventory.find(s => s.id === 'spot-p1-02');
      expect(assignedSpot.status).toBe('Assigned');
      expect(assignedSpot.assignedBookingId).toBe(booking.id);

      expect(result.updatedBooking.parkingSpotIds).toContain('spot-p1-02');
      expect(result.updatedBooking.totalPrice).toBe(30500000);
      expect(result.updatedBooking.balanceDue).toBe(25500000);
      expect(result.newPayment.scheduledAmount).toBe(500000);
      expect(result.newPayment.dueDate).toBe('2026-07-01');
    });
  });

  describe('TC-ADM-018: Mid-Booking Parking Release (Credit Note)', () => {
    it('should release spot back to Available and adjust price when credit note issued', () => {
      const property = createMockProperty();
      property.parkingInventory[0].status = 'Assigned';
      property.parkingInventory[0].assignedBookingId = 'bkg-uuid-001';

      const booking = createMockBooking({
        parkingSpotIds: ['spot-p1-01'],
        totalPrice: 30500000,
        balanceDue: 25500000
      });

      const result = releaseParkingSpotFromBooking({
        booking,
        property,
        spotId: 'spot-p1-01',
        issueCreditNote: true
      });

      const releasedSpot = result.updatedParkingInventory.find(s => s.id === 'spot-p1-01');
      expect(releasedSpot.status).toBe('Available');
      expect(releasedSpot.assignedBookingId).toBeNull();
      expect(result.updatedBooking.parkingSpotIds).not.toContain('spot-p1-01');
      expect(result.updatedBooking.totalPrice).toBe(30000000);
      expect(result.updatedBooking.balanceDue).toBe(25000000);
    });
  });

  describe('TC-ADM-019: Mid-Booking Parking Swap (Zero Financial Impact)', () => {
    it('should swap spots cleanly without modifying pricing totals', () => {
      const property = createMockProperty();
      property.parkingInventory[0].status = 'Assigned';
      property.parkingInventory[0].assignedBookingId = 'bkg-uuid-001';

      const booking = createMockBooking({
        parkingSpotIds: ['spot-p1-01'],
        totalPrice: 30500000,
        balanceDue: 25500000
      });

      const result = swapParkingSpotForBooking({
        booking,
        property,
        currentSpotId: 'spot-p1-01',
        targetSpotId: 'spot-p1-02'
      });

      const oldSpot = result.updatedParkingInventory.find(s => s.id === 'spot-p1-01');
      const newSpot = result.updatedParkingInventory.find(s => s.id === 'spot-p1-02');

      expect(oldSpot.status).toBe('Available');
      expect(newSpot.status).toBe('Assigned');
      expect(newSpot.assignedBookingId).toBe(booking.id);
      expect(result.updatedBooking.parkingSpotIds).toEqual(['spot-p1-02']);
      expect(result.updatedBooking.totalPrice).toBe(30500000);
      expect(result.updatedBooking.balanceDue).toBe(25500000);
    });
  });

  describe('TC-ADM-027: Booking Cancellation & Automatic Asset Release', () => {
    it('should release unit and all parking spots to Available on cancellation', () => {
      const property = createMockProperty();
      property.inventory[0].status = 'Booked';
      property.parkingInventory[0].status = 'Assigned';

      const booking = createMockBooking({
        inventoryId: 'inv-4a',
        parkingSpotIds: ['spot-p1-01'],
        status: 'Active'
      });

      const result = cancelBookingAndReleaseAssets({
        booking,
        property,
        reason: 'Client relocated abroad; mutual termination agreement signed.',
        adminName: 'Operations Admin'
      });

      expect(result.updatedBooking.status).toBe('Cancelled');
      expect(result.updatedBooking.internalNotes).toContain('mutual termination agreement');

      const unit = result.updatedInventory.find(i => i.id === 'inv-4a');
      expect(unit.status).toBe('Available');

      const spot = result.updatedParkingInventory.find(s => s.id === 'spot-p1-01');
      expect(spot.status).toBe('Available');
      expect(spot.assignedBookingId).toBeNull();

      expect(result.activityLog.type).toBe('Booking Cancelled');
      expect(result.activityLog.metadata.reason).toContain('Client relocated abroad');
    });

    it('should enforce a mandatory cancellation reason', () => {
      const property = createMockProperty();
      const booking = createMockBooking();

      expect(() => cancelBookingAndReleaseAssets({
        booking,
        property,
        reason: ''
      })).toThrow(/Cancellation reason is required/);
    });
  });
});
