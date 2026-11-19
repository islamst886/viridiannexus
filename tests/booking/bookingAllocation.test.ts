import { describe, it, expect } from 'vitest';
import {
  buildParkingPhysicalKey,
  buildUnitPhysicalKey,
  computePropertyAllocationSnapshot,
  extractUnitPhysicalKeyFromBooking,
  formatBookingUnitNumber,
  formatParkingDisplayList,
  isActiveAllocationStatus,
  normalizeParkingSpotIds,
  reconcilePropertyInventoryWithBookings,
  validateParkingAssignment,
  validatePropertyInventoryIntegrity,
  validateUnitAssignment,
  type ActiveBookingAllocationRow,
  type PropertyAllocationTarget,
} from '../../src/utils/bookingAllocation';

function makeProperty(): PropertyAllocationTarget {
  return {
    id: 'prop-1',
    name: 'Emerald Heights',
    inventory: [
      { id: 'inv-1a', floor: '1', unitName: 'A', unitType: 'Type A - 1650 sqft', status: 'Available' },
      { id: 'inv-2a', floor: '2', unitName: 'A', unitType: 'Type A - 1650 sqft', status: 'Available' },
      { id: 'inv-3b', floor: '3', unitName: 'B', unitType: 'Type B - 1900 sqft', status: 'On Hold' },
      { id: 'inv-4c', floor: '4', unitName: 'C', unitType: 'Type C - 2100 sqft', status: 'Available' },
    ],
    parkingInventory: [
      { id: 'pkg-1', label: 'B1-01', level: 'Basement 1', zone: 'North', status: 'Available', assignedBookingId: null },
      { id: 'pkg-2', label: 'B1-02', level: 'Basement 1', zone: 'North', status: 'Available', assignedBookingId: null },
      { id: 'pkg-3', label: 'B2-01', level: 'Basement 2', zone: 'South', status: 'Assigned', assignedBookingId: 'bk-active' },
    ],
  };
}

function makeBooking(overrides: Partial<ActiveBookingAllocationRow> = {}): ActiveBookingAllocationRow {
  return {
    id: 'bk-active',
    bookingRef: 'VN-2026-1001',
    propertyId: 'prop-1',
    inventoryId: 'inv-1a',
    unitNumber: 'Floor 1, Unit A',
    unitType: 'Type A - 1650 sqft',
    parkingSpotIds: ['pkg-3'],
    parkingIncluded: 'B2-01 (Basement 2)',
    status: 'Active',
    clientName: 'Client One',
    ...overrides,
  };
}

describe('Booking Allocation & Exclusivity Integrity', () => {
  it('normalizes unit & parking physical keys and active booking statuses', () => {
    expect(isActiveAllocationStatus('Active')).toBe(true);
    expect(isActiveAllocationStatus('On Hold')).toBe(true);
    expect(isActiveAllocationStatus('Cancelled')).toBe(false);
    expect(isActiveAllocationStatus('cancelled')).toBe(false);

    expect(buildUnitPhysicalKey('Floor 1', 'Unit A')).toBe('1::a');
    expect(extractUnitPhysicalKeyFromBooking({ unitNumber: 'Floor 1, Unit A' })).toBe('1::a');
    expect(extractUnitPhysicalKeyFromBooking({ unitNumber: 'floor 1 ,  A' })).toBe('1::a');

    expect(buildParkingPhysicalKey('B1-01', 'Basement 1')).toBe('b1-01::basement 1');
    expect(normalizeParkingSpotIds([' pkg-1 ', 'pkg-1', '', 'pkg-2'])).toEqual(['pkg-1', 'pkg-2']);
    expect(normalizeParkingSpotIds('["pkg-1","pkg-2","pkg-1"]')).toEqual(['pkg-1', 'pkg-2']);

    expect(
      formatBookingUnitNumber({ floor: '5', unitName: 'A', unitType: 'Type B - 1800 sqft' })
    ).toBe('Floor 5, Unit A');
    expect(
      formatParkingDisplayList([
        { id: 'pkg-1', label: 'B1-01', level: 'Basement 1', status: 'Available' },
      ])
    ).toBe('B1-01 (Basement 1)');
  });

  it('prevents double-booking the same unit even when property JSON status is stale', () => {
    const property = makeProperty(); // inv-1a still says Available in stale JSON
    const activeBooking = makeBooking();

    const snapshot = computePropertyAllocationSnapshot(property, [activeBooking]);
    expect(snapshot.availableUnits.map((u) => u.id)).toEqual(['inv-2a', 'inv-4c']);
    expect(snapshot.lockedUnits.map((l) => l.unit.id)).toContain('inv-1a');

    const result = validateUnitAssignment({
      property,
      activeBookings: [activeBooking],
      inventoryId: 'inv-1a',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('VN-2026-1001');
    }
  });

  it('blocks duplicate assignment by Floor + Unit even on legacy bookings without inventoryId', () => {
    const property = makeProperty();
    const legacyBooking = makeBooking({
      id: 'bk-legacy',
      bookingRef: 'VN-2026-LEGACY',
      inventoryId: null,
      unitNumber: 'Floor 2, Unit A',
      parkingSpotIds: [],
      parkingIncluded: 'B1-01 (Basement 1)',
    });

    const unitAttempt = validateUnitAssignment({
      property,
      activeBookings: [legacyBooking],
      inventoryId: 'inv-2a',
    });
    expect(unitAttempt.ok).toBe(false);
    if (!unitAttempt.ok) {
      expect(unitAttempt.error).toContain('VN-2026-LEGACY');
    }

    const parkingAttempt = validateParkingAssignment({
      property,
      activeBookings: [legacyBooking],
      spotIds: ['pkg-1'],
    });
    expect(parkingAttempt.ok).toBe(false);
    if (!parkingAttempt.ok) {
      expect(parkingAttempt.error).toContain('VN-2026-LEGACY');
    }
  });

  it('allows cancelled bookings resources to be re-booked cleanly', () => {
    const property = makeProperty();
    const cancelled = makeBooking({
      id: 'bk-cancelled',
      status: 'Cancelled',
      inventoryId: 'inv-1a',
      unitNumber: 'Floor 1, Unit A',
      parkingSpotIds: ['pkg-1'],
    });

    const unitRes = validateUnitAssignment({
      property,
      activeBookings: [cancelled],
      inventoryId: 'inv-1a',
    });
    expect(unitRes.ok).toBe(true);

    const parkingRes = validateParkingAssignment({
      property,
      activeBookings: [cancelled],
      spotIds: ['pkg-1'],
    });
    expect(parkingRes.ok).toBe(true);
  });

  it('respects excludeBookingId when reassigning or swapping and rejects On Hold / taken spots', () => {
    const property = makeProperty();
    const bookingA = makeBooking({
      id: 'bk-a',
      bookingRef: 'VN-A',
      inventoryId: 'inv-1a',
      unitNumber: 'Floor 1, Unit A',
      parkingSpotIds: ['pkg-1'],
    });
    const bookingB = makeBooking({
      id: 'bk-b',
      bookingRef: 'VN-B',
      inventoryId: 'inv-2a',
      unitNumber: 'Floor 2, Unit A',
      parkingSpotIds: ['pkg-3'],
    });

    // Cannot reassign bookingA to bookingB's unit or On Hold unit inv-3b
    expect(
      validateUnitAssignment({
        property,
        activeBookings: [bookingA, bookingB],
        inventoryId: 'inv-2a',
        excludeBookingId: 'bk-a',
      }).ok
    ).toBe(false);
    expect(
      validateUnitAssignment({
        property,
        activeBookings: [bookingA, bookingB],
        inventoryId: 'inv-3b',
        excludeBookingId: 'bk-a',
      }).ok
    ).toBe(false);

    // Can move bookingA to free unit inv-4c
    expect(
      validateUnitAssignment({
        property,
        activeBookings: [bookingA, bookingB],
        inventoryId: 'inv-4c',
        excludeBookingId: 'bk-a',
      }).ok
    ).toBe(true);

    // Cannot re-add already owned parking spot or duplicate spot in same request or another booking's spot
    expect(
      validateParkingAssignment({
        property,
        activeBookings: [bookingA, bookingB],
        spotIds: ['pkg-1'],
        excludeBookingId: 'bk-a',
        existingOwnedSpotIds: ['pkg-1'],
      }).ok
    ).toBe(false);

    expect(
      validateParkingAssignment({
        property,
        activeBookings: [bookingA, bookingB],
        spotIds: ['pkg-2', 'pkg-2'],
        excludeBookingId: 'bk-a',
      }).ok
    ).toBe(false);

    expect(
      validateParkingAssignment({
        property,
        activeBookings: [bookingA, bookingB],
        spotIds: ['pkg-3'],
        excludeBookingId: 'bk-a',
      }).ok
    ).toBe(false);

    expect(
      validateParkingAssignment({
        property,
        activeBookings: [bookingA, bookingB],
        spotIds: ['pkg-2'],
        excludeBookingId: 'bk-a',
      }).ok
    ).toBe(true);
  });

  it('validates property inventory integrity and reconciles stale asset statuses', () => {
    const property = makeProperty();
    const activeBooking = makeBooking({
      id: 'bk-1',
      bookingRef: 'VN-1',
      inventoryId: 'inv-1a',
      unitNumber: 'Floor 1, Unit A',
      parkingSpotIds: ['pkg-2'],
    });

    // Duplicate floor + unit in inventory fails validation
    const dupUnitCheck = validatePropertyInventoryIntegrity({
      inventory: [
        ...(property.inventory || []),
        { id: 'inv-dup', floor: '1', unitName: 'A', unitType: 'Type A - 1650 sqft', status: 'Available' },
      ],
      parkingInventory: property.parkingInventory || [],
      activeBookings: [],
    });
    expect(dupUnitCheck.valid).toBe(false);
    expect(dupUnitCheck.errors[0]).toContain('Duplicate inventory unit');

    // Deleting a unit locked by an active booking fails validation
    const deletedLockedCheck = validatePropertyInventoryIntegrity({
      inventory: (property.inventory || []).filter((u) => u.id !== 'inv-1a'),
      parkingInventory: property.parkingInventory || [],
      activeBookings: [activeBooking],
    });
    expect(deletedLockedCheck.valid).toBe(false);
    expect(deletedLockedCheck.errors[0]).toContain('Cannot remove unit');

    // Reconcile syncs inv-1a -> Booked, pkg-2 -> Assigned (bk-1), and clears stale pkg-3 -> Available
    const reconciled = reconcilePropertyInventoryWithBookings(property, [activeBooking]);
    expect(reconciled.inventory.find((u) => u.id === 'inv-1a')?.status).toBe('Booked');
    expect(reconciled.inventory.find((u) => u.id === 'inv-3b')?.status).toBe('On Hold');
    expect(reconciled.parkingInventory.find((p) => p.id === 'pkg-2')).toMatchObject({
      status: 'Assigned',
      assignedBookingId: 'bk-1',
    });
    expect(reconciled.parkingInventory.find((p) => p.id === 'pkg-3')).toMatchObject({
      status: 'Available',
      assignedBookingId: null,
    });
  });

  it('releases parking spots on an Active booking immediately even if stale JSON still references booking.id', () => {
    const base = makeProperty();
    const propertyWithStaleSpot: PropertyAllocationTarget = {
      ...base,
      parkingInventory: (base.parkingInventory || []).map((p) =>
        p.id === 'pkg-3' ? { ...p, status: 'Assigned', assignedBookingId: 'bk-active' } : p
      ),
    };
    const activeBookingAfterRelease = makeBooking({
      id: 'bk-active',
      parkingSpotIds: [],
      parkingIncluded: null,
      status: 'Active',
    });

    const snapshot = computePropertyAllocationSnapshot(propertyWithStaleSpot, [
      activeBookingAfterRelease,
    ]);
    expect(snapshot.availableParkingSpots.map((s) => s.id)).toContain('pkg-3');
    expect(
      validateParkingAssignment({
        property: propertyWithStaleSpot,
        activeBookings: [activeBookingAfterRelease],
        spotIds: ['pkg-3'],
      }).ok
    ).toBe(true);

    const reconciled = reconcilePropertyInventoryWithBookings(propertyWithStaleSpot, [
      activeBookingAfterRelease,
    ]);
    expect(reconciled.parkingInventory.find((s) => s.id === 'pkg-3')).toMatchObject({
      status: 'Available',
      assignedBookingId: null,
    });
  });

  it('frees old parking spot and locks new spot after parking swap despite stale JSON', () => {
    const base = makeProperty();
    const propertyWithOldSpotRef: PropertyAllocationTarget = {
      ...base,
      parkingInventory: (base.parkingInventory || []).map((p) =>
        p.id === 'pkg-1' ? { ...p, status: 'Assigned', assignedBookingId: 'bk-active' } : p
      ),
    };
    const activeBookingAfterSwap = makeBooking({
      id: 'bk-active',
      parkingSpotIds: ['pkg-2'],
      parkingIncluded: 'B1-02 (Basement 1)',
    });

    const reconciled = reconcilePropertyInventoryWithBookings(propertyWithOldSpotRef, [
      activeBookingAfterSwap,
    ]);
    expect(reconciled.parkingInventory.find((p) => p.id === 'pkg-1')).toMatchObject({
      status: 'Available',
      assignedBookingId: null,
    });
    expect(reconciled.parkingInventory.find((p) => p.id === 'pkg-2')).toMatchObject({
      status: 'Assigned',
      assignedBookingId: 'bk-active',
    });

    const snapshot = computePropertyAllocationSnapshot(propertyWithOldSpotRef, [
      activeBookingAfterSwap,
    ]);
    expect(snapshot.availableParkingSpots.map((s) => s.id)).toContain('pkg-1');
    expect(snapshot.availableParkingSpots.map((s) => s.id)).not.toContain('pkg-2');
  });

  it('frees old unit after reassignment and frees stale Booked/Assigned statuses on cancellation while keeping On Hold locked', () => {
    const base = makeProperty();
    const propertyAfterReassign: PropertyAllocationTarget = {
      ...base,
      inventory: (base.inventory || []).map((u) =>
        u.id === 'inv-1a' ? { ...u, status: 'Booked' } : u
      ),
      parkingInventory: (base.parkingInventory || []).map((p) =>
        p.id === 'pkg-3' ? { ...p, status: 'Assigned', assignedBookingId: 'bk-cancelled' } : p
      ),
    };
    const activeBookingMoved = makeBooking({
      id: 'bk-active',
      inventoryId: 'inv-2a',
      unitNumber: 'Floor 2, Unit A',
      parkingSpotIds: [],
      parkingIncluded: null,
    });
    const cancelledBooking = makeBooking({
      id: 'bk-cancelled',
      status: 'Cancelled',
      inventoryId: 'inv-1a',
      unitNumber: 'Floor 1, Unit A',
      parkingSpotIds: ['pkg-3'],
    });

    const snapAfterReassign = computePropertyAllocationSnapshot(propertyAfterReassign, [
      activeBookingMoved,
      cancelledBooking,
    ]);
    // Old unit inv-1a & released pkg-3 are available; new unit inv-2a & manual On Hold inv-3b stay locked
    expect(snapAfterReassign.availableUnits.map((u) => u.id)).toEqual(['inv-1a', 'inv-4c']);
    expect(snapAfterReassign.lockedUnits.map((l) => l.unit.id)).toEqual(['inv-2a', 'inv-3b']);
    expect(snapAfterReassign.availableParkingSpots.map((p) => p.id)).toContain('pkg-3');

    expect(
      validateUnitAssignment({
        property: propertyAfterReassign,
        activeBookings: [activeBookingMoved, cancelledBooking],
        inventoryId: 'inv-1a',
      }).ok
    ).toBe(true);
    expect(
      validateUnitAssignment({
        property: propertyAfterReassign,
        activeBookings: [activeBookingMoved, cancelledBooking],
        inventoryId: 'inv-3b',
      }).ok
    ).toBe(false);

    const reconciled = reconcilePropertyInventoryWithBookings(propertyAfterReassign, [
      activeBookingMoved,
      cancelledBooking,
    ]);
    expect(reconciled.inventory.find((u) => u.id === 'inv-1a')?.status).toBe('Available');
    expect(reconciled.inventory.find((u) => u.id === 'inv-2a')?.status).toBe('Booked');
    expect(reconciled.inventory.find((u) => u.id === 'inv-3b')?.status).toBe('On Hold');
    expect(reconciled.parkingInventory.find((p) => p.id === 'pkg-3')).toMatchObject({
      status: 'Available',
      assignedBookingId: null,
    });

    // Does not match TBD unit strings as floor locks
    expect(buildUnitPhysicalKey('1', 'TBD')).toBe('');
    expect(extractUnitPhysicalKeyFromBooking({ unitNumber: 'TBD' })).toBe('');
  });
});
