import { supabase } from '../supabase';
import type {
  BookingDBRow,
  InventoryUnit,
  ParkingSpot,
  PropertyDBRow,
} from '../types';

export interface ActiveBookingAllocationRow {
  id: string;
  bookingRef: string;
  propertyId: string;
  inventoryId: string | null;
  unitNumber: string;
  unitType: string;
  parkingSpotIds: string[];
  parkingIncluded: string | null;
  status: string;
  clientName: string;
  createdAt?: string | null;
}

export interface PropertyAllocationTarget {
  id?: string;
  name?: string;
  inventory?: InventoryUnit[] | null;
  parkingInventory?: ParkingSpot[] | null;
}

export interface PropertyAllocationSnapshot {
  availableUnits: InventoryUnit[];
  lockedUnits: Array<{ unit: InventoryUnit; bookingRef?: string; reason: string }>;
  availableParkingSpots: ParkingSpot[];
  lockedParkingSpots: Array<{ spot: ParkingSpot; bookingRef?: string; reason: string }>;
  bookedUnitIds: Map<string, ActiveBookingAllocationRow>;
  bookedUnitPhysicalKeys: Map<string, ActiveBookingAllocationRow>;
  assignedParkingIds: Map<string, ActiveBookingAllocationRow>;
  assignedParkingKeys: Map<string, ActiveBookingAllocationRow>;
}

function normalizeToken(value?: string | null): string {
  if (!value || typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isActiveAllocationStatus(status?: string | null): boolean {
  return normalizeToken(status) !== 'cancelled';
}

export function formatBookingUnitNumber(
  unit: Pick<InventoryUnit, 'floor' | 'unitName' | 'unitType'>
): string {
  const floor = (unit.floor || '').trim();
  const unitName = (unit.unitName || '').trim();
  const unitType = (unit.unitType || '').trim();
  const unitPart =
    unitType && unitName && unitType.toLowerCase().includes(unitName.toLowerCase())
      ? unitName
      : `Unit ${unitName}`;
  return `Floor ${floor}, ${unitPart}`;
}

const EMPTY_UNIT_TOKENS = new Set(['tbd', 'unassigned', 'n/a']);

export function buildUnitPhysicalKey(floor?: string | null, unitName?: string | null): string {
  const cleanFloor = normalizeToken(floor).replace(/^floor\s+/i, '').trim();
  const cleanUnit = normalizeToken(unitName).replace(/^unit\s+/i, '').trim();
  if (!cleanUnit || EMPTY_UNIT_TOKENS.has(cleanUnit)) return '';
  return `${cleanFloor}::${cleanUnit}`;
}

export function extractUnitPhysicalKeyFromBooking(
  booking: Pick<ActiveBookingAllocationRow, 'unitNumber'>
): string {
  const raw = (booking.unitNumber || '').trim();
  const normRaw = normalizeToken(raw);
  if (!raw || EMPTY_UNIT_TOKENS.has(normRaw)) return '';

  const commaIdx = raw.indexOf(',');
  if (commaIdx !== -1) {
    return buildUnitPhysicalKey(raw.slice(0, commaIdx), raw.slice(commaIdx + 1));
  }

  const dashIdx = raw.indexOf(' - ');
  if (dashIdx !== -1) {
    return buildUnitPhysicalKey(raw.slice(0, dashIdx), raw.slice(dashIdx + 3));
  }

  return buildUnitPhysicalKey('', raw);
}

export function buildParkingPhysicalKey(label?: string | null, level?: string | null): string {
  const cleanLabel = normalizeToken(label);
  if (!cleanLabel) return '';
  const cleanLevel = normalizeToken(level);
  return `${cleanLabel}::${cleanLevel}`;
}

export function normalizeParkingSpotIds(raw: unknown): string[] {
  let source = raw;
  if (typeof source === 'string') {
    const trimmed = source.trim();
    if (!trimmed) return [];
    try {
      source = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(source)) return [];

  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of source) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

export function formatParkingDisplayList(spots: ParkingSpot[]): string | null {
  if (spots.length === 0) return null;
  const formatted = spots
    .map((s) => `${s.label}${s.level ? ` (${s.level})` : ''}`.trim())
    .filter(Boolean);
  return formatted.length > 0 ? formatted.join(', ') : null;
}

export function mapActiveBookingRow(row: BookingDBRow): ActiveBookingAllocationRow {
  return {
    id: row.id ?? '',
    bookingRef: row.booking_ref ?? '',
    propertyId: row.property_id ?? '',
    inventoryId: row.inventory_id ?? null,
    unitNumber: row.unit_number ?? '',
    unitType: row.unit_type ?? '',
    parkingSpotIds: normalizeParkingSpotIds(row.parking_spot_ids),
    parkingIncluded: row.parking_included ?? null,
    status: row.status ?? 'Active',
    clientName: row.client_name ?? '',
    createdAt: row.created_at ?? null,
  };
}

function parseLegacyParkingDisplayEntries(parkingIncluded?: string | null): string[] {
  if (!parkingIncluded || typeof parkingIncluded !== 'string') return [];
  return parkingIncluded
    .split(',')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const match = chunk.match(/^(.+?)\s*\(([^)]+)\)$/);
      if (match) {
        return buildParkingPhysicalKey(match[1], match[2]);
      }
      return buildParkingPhysicalKey(chunk, '');
    })
    .filter(Boolean);
}

/**
 * Computes live asset locks and available units/parking spots by cross-checking
 * property inventory definitions against all non-cancelled bookings.
 */
export function computePropertyAllocationSnapshot(
  property: PropertyAllocationTarget,
  activeBookings: ActiveBookingAllocationRow[],
  excludeBookingId?: string
): PropertyAllocationSnapshot {
  const inventory = Array.isArray(property.inventory) ? property.inventory : [];
  const parkingInventory = Array.isArray(property.parkingInventory)
    ? property.parkingInventory
    : [];

  const unitById = new Map<string, InventoryUnit>();
  for (const unit of inventory) {
    if (unit?.id) unitById.set(unit.id, unit);
  }

  const spotById = new Map<string, ParkingSpot>();
  for (const spot of parkingInventory) {
    if (spot?.id) spotById.set(spot.id, spot);
  }

  const bookedUnitIds = new Map<string, ActiveBookingAllocationRow>();
  const bookedUnitPhysicalKeys = new Map<string, ActiveBookingAllocationRow>();
  const assignedParkingIds = new Map<string, ActiveBookingAllocationRow>();
  const assignedParkingKeys = new Map<string, ActiveBookingAllocationRow>();

  for (const booking of activeBookings) {
    if (!booking || !isActiveAllocationStatus(booking.status)) continue;
    if (excludeBookingId && booking.id === excludeBookingId) continue;

    if (booking.inventoryId) {
      if (!bookedUnitIds.has(booking.inventoryId)) {
        bookedUnitIds.set(booking.inventoryId, booking);
      }
      const matchedUnit = unitById.get(booking.inventoryId);
      if (matchedUnit) {
        const key = buildUnitPhysicalKey(matchedUnit.floor, matchedUnit.unitName);
        if (key && !bookedUnitPhysicalKeys.has(key)) {
          bookedUnitPhysicalKeys.set(key, booking);
        }
      }
    }

    const bookingUnitKey = extractUnitPhysicalKeyFromBooking(booking);
    if (bookingUnitKey && !bookedUnitPhysicalKeys.has(bookingUnitKey)) {
      bookedUnitPhysicalKeys.set(bookingUnitKey, booking);
    }

    for (const spotId of normalizeParkingSpotIds(booking.parkingSpotIds)) {
      if (!assignedParkingIds.has(spotId)) {
        assignedParkingIds.set(spotId, booking);
      }
      const spot = spotById.get(spotId);
      if (spot) {
        const key = buildParkingPhysicalKey(spot.label, spot.level);
        if (key && !assignedParkingKeys.has(key)) {
          assignedParkingKeys.set(key, booking);
        }
      }
    }

    // Also lock spots indicated by legacy `parking_included` strings when spot IDs are absent
    if (booking.parkingSpotIds.length === 0 && booking.parkingIncluded) {
      for (const legacyKey of parseLegacyParkingDisplayEntries(booking.parkingIncluded)) {
        if (!assignedParkingKeys.has(legacyKey)) {
          assignedParkingKeys.set(legacyKey, booking);
        }
      }
    }
  }

  const availableUnits: InventoryUnit[] = [];
  const lockedUnits: Array<{ unit: InventoryUnit; bookingRef?: string; reason: string }> = [];

  for (const unit of inventory) {
    const idHolder = bookedUnitIds.get(unit.id);
    const physKey = buildUnitPhysicalKey(unit.floor, unit.unitName);
    const physHolder = physKey ? bookedUnitPhysicalKeys.get(physKey) : undefined;
    const holder = idHolder || physHolder;
    const normStatus = normalizeToken(unit.status);

    if (holder) {
      lockedUnits.push({
        unit,
        bookingRef: holder.bookingRef,
        reason: `Locked by booking ${holder.bookingRef || holder.id}`,
      });
    } else if (normStatus !== 'available' && normStatus !== 'booked') {
      // Respect manual administrative holds (e.g. 'On Hold'), while treating unheld 'Booked' entries as released
      lockedUnits.push({
        unit,
        reason: `Inventory status is "${unit.status}"`,
      });
    } else {
      availableUnits.push(unit);
    }
  }

  const availableParkingSpots: ParkingSpot[] = [];
  const lockedParkingSpots: Array<{ spot: ParkingSpot; bookingRef?: string; reason: string }> = [];

  for (const spot of parkingInventory) {
    const idHolder = assignedParkingIds.get(spot.id);
    const physKey = buildParkingPhysicalKey(spot.label, spot.level);
    const physHolder = physKey ? assignedParkingKeys.get(physKey) : undefined;
    const holder = idHolder || physHolder;
    const normStatus = normalizeToken(spot.status);

    if (holder) {
      lockedParkingSpots.push({
        spot,
        bookingRef: holder.bookingRef,
        reason: `Assigned to booking ${holder.bookingRef || holder.id}`,
      });
    } else if (normStatus !== 'available' && normStatus !== 'assigned') {
      // Respect manual holds, while treating orphaned 'Assigned' spots without any active booking as released
      lockedParkingSpots.push({
        spot,
        reason: `Parking spot status is "${spot.status}"`,
      });
    } else {
      availableParkingSpots.push(spot);
    }
  }

  return {
    availableUnits,
    lockedUnits,
    availableParkingSpots,
    lockedParkingSpots,
    bookedUnitIds,
    bookedUnitPhysicalKeys,
    assignedParkingIds,
    assignedParkingKeys,
  };
}

/**
 * Reconciles `inventory` and `parkingInventory` statuses against all live active
 * bookings so neither manual edits nor concurrent mutations leave stale states.
 */
export function reconcilePropertyInventoryWithBookings(
  property: PropertyAllocationTarget,
  activeBookings: ActiveBookingAllocationRow[]
): { inventory: InventoryUnit[]; parkingInventory: ParkingSpot[] } {
  const snapshot = computePropertyAllocationSnapshot(property, activeBookings);
  const rawInventory = Array.isArray(property.inventory) ? property.inventory : [];
  const rawParking = Array.isArray(property.parkingInventory) ? property.parkingInventory : [];

  const reconciledInventory: InventoryUnit[] = rawInventory.map((unit) => {
    const physKey = buildUnitPhysicalKey(unit.floor, unit.unitName);
    const holder =
      snapshot.bookedUnitIds.get(unit.id) ||
      (physKey ? snapshot.bookedUnitPhysicalKeys.get(physKey) : undefined);

    if (holder) {
      return { ...unit, status: 'Booked' };
    }
    if (normalizeToken(unit.status) === 'booked') {
      return { ...unit, status: 'Available' };
    }
    return { ...unit };
  });

  const reconciledParking: ParkingSpot[] = rawParking.map((spot) => {
    const physKey = buildParkingPhysicalKey(spot.label, spot.level);
    const holder =
      snapshot.assignedParkingIds.get(spot.id) ||
      (physKey ? snapshot.assignedParkingKeys.get(physKey) : undefined);

    if (holder) {
      return {
        ...spot,
        status: 'Assigned',
        assignedBookingId: holder.id,
      };
    }
    return {
      ...spot,
      status: 'Available',
      assignedBookingId: null,
    };
  });

  return {
    inventory: reconciledInventory,
    parkingInventory: reconciledParking,
  };
}

export function validateUnitAssignment(params: {
  property: PropertyAllocationTarget;
  activeBookings: ActiveBookingAllocationRow[];
  inventoryId: string;
  excludeBookingId?: string;
}): { ok: true; unit: InventoryUnit } | { ok: false; error: string } {
  const { property, activeBookings, inventoryId, excludeBookingId } = params;
  const inventory = Array.isArray(property.inventory) ? property.inventory : [];
  const unit = inventory.find((u) => u.id === inventoryId);
  if (!unit) {
    return { ok: false, error: 'Selected unit was not found in property inventory.' };
  }

  const snapshot = computePropertyAllocationSnapshot(property, activeBookings, excludeBookingId);
  const physKey = buildUnitPhysicalKey(unit.floor, unit.unitName);
  const holder =
    snapshot.bookedUnitIds.get(unit.id) ||
    (physKey ? snapshot.bookedUnitPhysicalKeys.get(physKey) : undefined);

  if (holder) {
    return {
      ok: false,
      error: `Floor ${unit.floor || 'N/A'}, Unit ${unit.unitName || unit.id} is already assigned to booking ${holder.bookingRef || holder.id}.`,
    };
  }

  const normStatus = normalizeToken(unit.status);
  if (normStatus !== 'available' && normStatus !== 'booked') {
    return {
      ok: false,
      error: `This unit is currently held (${unit.status}) and cannot be assigned.`,
    };
  }

  return { ok: true, unit };
}

export function validateParkingAssignment(params: {
  property: PropertyAllocationTarget;
  activeBookings: ActiveBookingAllocationRow[];
  spotIds: string[];
  excludeBookingId?: string;
  existingOwnedSpotIds?: string[];
}): { ok: true; spots: ParkingSpot[] } | { ok: false; error: string } {
  const {
    property,
    activeBookings,
    spotIds,
    excludeBookingId,
    existingOwnedSpotIds = [],
  } = params;

  const parkingInventory = Array.isArray(property.parkingInventory)
    ? property.parkingInventory
    : [];
  const snapshot = computePropertyAllocationSnapshot(property, activeBookings, excludeBookingId);
  const ownedSet = new Set(existingOwnedSpotIds);
  const seenInRequest = new Set<string>();
  const seenPhysInRequest = new Set<string>();
  const validSpots: ParkingSpot[] = [];

  for (const rawId of spotIds) {
    const spotId = rawId.trim();
    if (!spotId) continue;

    if (seenInRequest.has(spotId)) {
      return { ok: false, error: `Duplicate parking spot "${spotId}" in selection.` };
    }
    seenInRequest.add(spotId);

    if (ownedSet.has(spotId)) {
      return { ok: false, error: 'Selected parking spot is already assigned to this booking.' };
    }

    const spot = parkingInventory.find((s) => s.id === spotId);
    if (!spot) {
      return { ok: false, error: `Parking spot ${spotId} no longer exists in inventory.` };
    }

    const physKey = buildParkingPhysicalKey(spot.label, spot.level);
    if (physKey) {
      if (seenPhysInRequest.has(physKey)) {
        return {
          ok: false,
          error: `Duplicate physical parking spot "${spot.label}" selected.`,
        };
      }
      seenPhysInRequest.add(physKey);
    }

    const holder =
      snapshot.assignedParkingIds.get(spot.id) ||
      (physKey ? snapshot.assignedParkingKeys.get(physKey) : undefined);

    if (holder) {
      return {
        ok: false,
        error: `Parking spot "${spot.label}" is already assigned to booking ${holder.bookingRef || holder.id}.`,
      };
    }

    const normSpotStatus = normalizeToken(spot.status);
    if (normSpotStatus !== 'available' && normSpotStatus !== 'assigned') {
      return {
        ok: false,
        error: `Parking spot "${spot.label}" is currently held (${spot.status}) and cannot be assigned.`,
      };
    }

    validSpots.push(spot);
  }

  return { ok: true, spots: validSpots };
}

export function validatePropertyInventoryIntegrity(params: {
  inventory: InventoryUnit[];
  parkingInventory: ParkingSpot[];
  activeBookings: ActiveBookingAllocationRow[];
}): { valid: boolean; errors: string[] } {
  const { inventory, parkingInventory, activeBookings } = params;
  const errors: string[] = [];

  const unitKeyMap = new Map<string, InventoryUnit>();
  for (const unit of inventory) {
    const floor = (unit.floor || '').trim();
    const unitName = (unit.unitName || '').trim();
    if (!floor || !unitName) {
      errors.push('Every inventory unit must specify both a floor number and unit name.');
      continue;
    }
    const physKey = buildUnitPhysicalKey(floor, unitName);
    if (physKey && unitKeyMap.has(physKey)) {
      errors.push(`Duplicate inventory unit defined for Floor ${floor}, Unit ${unitName}.`);
    } else if (physKey) {
      unitKeyMap.set(physKey, unit);
    }
  }

  const parkingKeyMap = new Map<string, ParkingSpot>();
  for (const spot of parkingInventory) {
    const label = (spot.label || '').trim();
    if (!label) {
      errors.push('Every parking spot must specify a spot label.');
      continue;
    }
    const physKey = buildParkingPhysicalKey(label, spot.level);
    if (physKey && parkingKeyMap.has(physKey)) {
      errors.push(
        `Duplicate parking spot "${label}"${spot.level ? ` (${spot.level})` : ''} in parking inventory.`
      );
    } else if (physKey) {
      parkingKeyMap.set(physKey, spot);
    }
  }

  const unitById = new Map(inventory.map((u) => [u.id, u]));
  const spotById = new Map(parkingInventory.map((s) => [s.id, s]));

  for (const booking of activeBookings) {
    if (!isActiveAllocationStatus(booking.status)) continue;

    if (booking.inventoryId) {
      const matched = unitById.get(booking.inventoryId);
      if (!matched) {
        errors.push(
          `Cannot remove unit assigned to active booking ${booking.bookingRef || booking.id}.`
        );
      } else {
        const expectedPhysKey = extractUnitPhysicalKeyFromBooking(booking);
        const actualPhysKey = buildUnitPhysicalKey(matched.floor, matched.unitName);
        if (expectedPhysKey && actualPhysKey !== expectedPhysKey) {
          errors.push(
            `Cannot change floor or unit name for unit locked by booking ${booking.bookingRef || booking.id}.`
          );
        }
        if (matched.status !== 'Booked') {
          errors.push(
            `Floor ${matched.floor}, Unit ${matched.unitName} is locked by booking ${booking.bookingRef || booking.id} and must remain Booked.`
          );
        }
      }
    }

    for (const spotId of normalizeParkingSpotIds(booking.parkingSpotIds)) {
      const spot = spotById.get(spotId);
      if (!spot) {
        errors.push(
          `Cannot remove parking spot "${spotId}" assigned to active booking ${booking.bookingRef || booking.id}.`
        );
      } else if (spot.status !== 'Assigned') {
        errors.push(
          `Parking spot "${spot.label}" is assigned to active booking ${booking.bookingRef || booking.id} and cannot be marked Available.`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function fetchFreshPropertyAndActiveBookings(propertyId: string): Promise<{
  propertyRow: PropertyDBRow;
  property: PropertyAllocationTarget;
  activeBookings: ActiveBookingAllocationRow[];
}> {
  const [{ data: propData, error: propErr }, { data: bookingsData, error: bErr }] =
    await Promise.all([
      supabase.from('properties').select('*').eq('id', propertyId).single(),
      supabase.from('bookings').select('*').eq('property_id', propertyId),
    ]);

  if (propErr || !propData) {
    throw new Error('Property record could not be loaded.');
  }
  if (bErr) {
    throw new Error('Unable to verify live booking allocations.');
  }

  const propertyRow = propData as PropertyDBRow;
  const property: PropertyAllocationTarget = {
    id: propertyRow.id,
    name: propertyRow.name,
    inventory: Array.isArray(propertyRow.inventory) ? propertyRow.inventory : [],
    parkingInventory: Array.isArray(propertyRow.parking_inventory)
      ? propertyRow.parking_inventory
      : [],
  };

  const activeBookings = ((bookingsData || []) as BookingDBRow[])
    .map(mapActiveBookingRow)
    .filter((b) => isActiveAllocationStatus(b.status));

  return { propertyRow, property, activeBookings };
}

function compareBookingCreationOrder(
  a: ActiveBookingAllocationRow,
  b: ActiveBookingAllocationRow
): number {
  const aMs = a.createdAt ? Date.parse(a.createdAt) : Number.MAX_SAFE_INTEGER;
  const bMs = b.createdAt ? Date.parse(b.createdAt) : Number.MAX_SAFE_INTEGER;
  if (Number.isFinite(aMs) && Number.isFinite(bMs) && aMs !== bMs) {
    return aMs - bMs;
  }
  return a.id.localeCompare(b.id);
}

/**
 * Re-queries non-cancelled bookings after writing to detect parallel concurrent writes
 * on the same unit, floor+unit combination, or parking spots when DB-level triggers are absent.
 */
export async function detectConcurrentAllocationConflict(params: {
  propertyId: string;
  bookingId: string;
  inventoryId?: string | null;
  unitNumber?: string | null;
  parkingSpotIds?: string[];
  mode: 'insert' | 'update';
}): Promise<{ hasConflict: boolean; message?: string }> {
  const {
    propertyId,
    bookingId,
    inventoryId,
    unitNumber,
    parkingSpotIds = [],
    mode,
  } = params;

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('property_id', propertyId);

  if (error || !data) {
    return {
      hasConflict: true,
      message: 'Could not verify booking exclusivity after save.',
    };
  }

  const activeRows = (data as BookingDBRow[])
    .map(mapActiveBookingRow)
    .filter((row) => isActiveAllocationStatus(row.status));

  const selfRow = activeRows.find((r) => r.id === bookingId);
  const selfKey = extractUnitPhysicalKeyFromBooking({ unitNumber: unitNumber || '' });
  const targetSpots = new Set(normalizeParkingSpotIds(parkingSpotIds));

  for (const other of activeRows) {
    if (other.id === bookingId) continue;

    // On new inserts, let an earlier concurrent insert keep the asset and abort the later one.
    if (mode === 'insert' && selfRow && compareBookingCreationOrder(other, selfRow) >= 0) {
      continue;
    }

    if (inventoryId && other.inventoryId && other.inventoryId === inventoryId) {
      return {
        hasConflict: true,
        message: `Conflict detected: this unit was just booked by ${other.bookingRef || other.id}.`,
      };
    }

    const otherKey = extractUnitPhysicalKeyFromBooking(other);
    if (selfKey && otherKey && selfKey === otherKey) {
      return {
        hasConflict: true,
        message: `Conflict detected: ${unitNumber || 'this unit'} is already locked by ${other.bookingRef || other.id}.`,
      };
    }

    if (targetSpots.size > 0) {
      const overlap = other.parkingSpotIds.find((sid) => targetSpots.has(sid));
      if (overlap) {
        return {
          hasConflict: true,
          message: `Conflict detected: parking spot ${overlap} was just assigned to ${other.bookingRef || other.id}.`,
        };
      }
    }
  }

  return { hasConflict: false };
}
