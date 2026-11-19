import type {
  Booking,
  BookingActivity,
  BookingActivityDBRow,
  BookingDBRow,
  BookingPayment,
  BookingPaymentDBRow,
  CustomAmenity,
  ProfileDBRow,
  Property,
  PropertyDBRow,
  PropertyImages,
  UserProfile,
} from '../types';

// ─── Properties ───────────────────────────────────────────────────────────────

function parseCustomAmenityEntry(entry: unknown): CustomAmenity | null {
  let current: unknown = entry;

  // Unwrap JSON strings (handles Postgres TEXT[] storing JSON strings or double-encoded values)
  for (let pass = 0; pass < 2 && typeof current === 'string'; pass++) {
    const trimmed = current.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('{') || trimmed.startsWith('"') || trimmed.startsWith('[')) {
      try {
        current = JSON.parse(trimmed);
        continue;
      } catch {
        // Not valid JSON; treat plain string as an amenity name below
      }
    }
    if (pass === 0) {
      return { name: trimmed, icon: 'CheckCircle' };
    }
    return null;
  }

  if (typeof current === 'string') {
    const trimmed = current.trim();
    return trimmed ? { name: trimmed, icon: 'CheckCircle' } : null;
  }

  if (typeof current !== 'object' || current === null || Array.isArray(current)) {
    return null;
  }

  const record = current as Record<string, unknown>;

  // Recover objects accidentally created by spreading a JSON string (numeric keys '0','1',...)
  if (typeof record.name !== 'string' && typeof record['0'] === 'string') {
    const chars: string[] = [];
    for (let i = 0; typeof record[String(i)] === 'string'; i++) {
      chars.push(record[String(i)] as string);
    }
    if (chars.length > 0) {
      return parseCustomAmenityEntry(chars.join(''));
    }
  }

  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (!name) return null;

  const icon =
    typeof record.icon === 'string' && record.icon.trim()
      ? record.icon.trim()
      : 'CheckCircle';

  return { name, icon };
}

/**
 * Normalizes `custom_amenities` from either JSONB object arrays, Postgres TEXT[]
 * JSON-string arrays, or full JSON strings into validated `CustomAmenity[]` items.
 */
export function normalizeCustomAmenities(raw: unknown): CustomAmenity[] {
  let source = raw;
  if (typeof source === 'string') {
    const trimmed = source.trim();
    if (!trimmed) return [];
    try {
      source = JSON.parse(trimmed);
    } catch {
      return [{ name: trimmed, icon: 'CheckCircle' }];
    }
  }

  if (!Array.isArray(source)) return [];

  const result: CustomAmenity[] = [];
  for (const item of source) {
    const parsed = parseCustomAmenityEntry(item);
    if (parsed) result.push(parsed);
  }
  return result;
}

export function mapPropertyFromDB(row: PropertyDBRow): Property;
export function mapPropertyFromDB(row: null | undefined): null;
export function mapPropertyFromDB(row: PropertyDBRow | null | undefined): Property | null;
export function mapPropertyFromDB(row: PropertyDBRow | null | undefined): Property | null {
  if (!row) return null;
  const fallbackImages: PropertyImages = {
    hero: '',
    map: '',
    floorPlan: '',
    video: '',
    gallery: [],
  };

  return {
    id: row.id,
    name: row.name,
    location: row.location,
    price: row.price ?? '',
    status: row.status ?? '',
    propertyType: Array.isArray(row.property_type)
      ? row.property_type
      : row.property_type
        ? [row.property_type]
        : [],
    beds: row.beds ?? 0,
    baths: row.baths ?? 0,
    sqft: row.sqft ?? '',
    buildingType: row.building_type ?? '',
    unitsPerFloor: row.units_per_floor ?? '',
    totalUnits: row.total_units ?? '',
    landArea: row.land_area ?? '',
    architect: row.architect ?? '',
    parkingAvailable: row.parking_available ?? '',
    parkingPrice: row.parking_price ?? '',
    passengerLifts: row.passenger_lifts ?? '',
    frontRoadSize: row.front_road_size ?? '',
    totalShare: row.total_share ?? '',
    landmarks: row.landmarks ?? '',
    googleMapLink: row.google_map_link ?? '',
    completionDate: row.completion_date ?? '',
    overview: row.overview ?? '',
    brochureUrl: row.brochure_url ?? '',
    amenities: row.amenities ?? [],
    customAmenities: normalizeCustomAmenities(row.custom_amenities),
    availableUnits: row.available_units ?? [],
    inventory: row.inventory ?? [],
    parkingInventory: row.parking_inventory ?? [],
    milestones: row.milestones ?? [],
    images: row.images ? ({ ...fallbackImages, ...row.images } as PropertyImages) : fallbackImages,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPropertyToDB(formData: Partial<Property>): Record<string, unknown> {
  const formatWithUnit = (
    value: string | number | undefined | null,
    defaultUnit: string
  ): string => {
    if (value === undefined || value === null || value === '') return '';
    const strVal = String(value).trim();
    if (!strVal) return '';
    if (/[a-zA-Z]/.test(strVal)) return strVal;
    return `${strVal} ${defaultUnit}`;
  };

  return {
    id: formData.id,
    name: formData.name,
    location: formData.location,
    price: formData.price,
    status: formData.status,
    property_type: formData.propertyType ?? [],
    beds: Number(formData.beds) || 0,
    baths: Number(formData.baths) || 0,
    sqft: formatWithUnit(formData.sqft, 'Sq. FT'),
    building_type: formData.buildingType,
    units_per_floor: formData.unitsPerFloor,
    total_units: formData.totalUnits,
    land_area: formatWithUnit(formData.landArea, 'Katha'),
    architect: formData.architect,
    parking_available: formData.parkingAvailable,
    parking_price: formData.parkingPrice,
    passenger_lifts: formData.passengerLifts,
    front_road_size: formatWithUnit(formData.frontRoadSize, 'FT'),
    total_share: formData.totalShare,
    landmarks: formData.landmarks,
    google_map_link: formData.googleMapLink,
    completion_date: formData.completionDate,
    overview: formData.overview,
    brochure_url: formData.brochureUrl,
    amenities: formData.amenities ?? [],
    custom_amenities: normalizeCustomAmenities(formData.customAmenities ?? []),
    available_units: formData.availableUnits ?? [],
    inventory: formData.inventory ?? [],
    parking_inventory: formData.parkingInventory ?? [],
    milestones: formData.milestones ?? [],
    images: formData.images ?? { hero: '', map: '', floorPlan: '', video: '', gallery: [] },
    updated_at: new Date().toISOString(),
  };
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

export function mapBookingFromDB(row: BookingDBRow): Booking;
export function mapBookingFromDB(row: null | undefined): null;
export function mapBookingFromDB(row: BookingDBRow | null | undefined): Booking | null;
export function mapBookingFromDB(row: BookingDBRow | null | undefined): Booking | null {
  if (!row) return null;
  return {
    id: row.id ?? '',
    bookingRef: row.booking_ref ?? '',
    propertyId: row.property_id ?? '',
    propertyName: row.property_name ?? '',
    propertyLocation: row.property_location ?? '',
    inventoryId: row.inventory_id,
    clientName: row.client_name ?? '',
    clientEmail: row.client_email ?? '',
    clientPhone: row.client_phone ?? '',
    clientNid: row.client_nid,
    clientAddress: row.client_address,
    linkedUserId: row.linked_user_id,
    clientId: row.client_id,
    unitNumber: row.unit_number,
    unitType: row.unit_type,
    floorNumber: row.floor_number,
    parkingSlot: row.parking_slot,
    parkingSpotIds: row.parking_spot_ids ?? [],
    parkingIncluded: row.parking_included,
    parkingPrice: Number(row.parking_price) || 0,
    totalPrice: Number(row.total_price) || 0,
    totalPaid: Number(row.total_paid) || 0,
    balanceDue: Number(row.balance_due) || 0,
    downPaymentAmount: Number(row.down_payment_amount) || 0,
    stage: row.stage === 'Token Paid' ? 'EOI' : (row.stage ?? 'EOI'),
    status: row.status ?? 'Active',
    agreementDate: row.agreement_date,
    handoverDate: row.handover_date,
    notes: row.notes ?? undefined,
    internalNotes: row.internal_notes ?? undefined,
    installmentPlan: row.installment_plan ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    lastUpdatedBy: row.last_updated_by,
  };
}

export function mapBookingToDB(data: Partial<Booking>): Record<string, unknown> {
  return {
    property_id: data.propertyId,
    property_name: data.propertyName,
    property_location: data.propertyLocation,
    inventory_id: data.inventoryId,
    client_name: data.clientName,
    client_email: data.clientEmail,
    client_phone: data.clientPhone,
    client_nid: data.clientNid || '',
    client_address: data.clientAddress,
    linked_user_id: data.linkedUserId || null,
    unit_number: data.unitNumber,
    unit_type: data.unitType,
    floor_number: data.floorNumber,
    parking_slot: data.parkingSlot || null,
    parking_spot_ids: data.parkingSpotIds ?? [],
    parking_included: data.parkingIncluded || null,
    parking_price: Number(data.parkingPrice) || 0,
    total_price: Number(data.totalPrice) || 0,
    total_paid: Number(data.totalPaid) || 0,
    balance_due: Number(data.balanceDue) || 0,
    down_payment_amount: Number(data.downPaymentAmount) || 0,
    stage: data.stage === 'Token Paid' ? 'EOI' : (data.stage || 'EOI'),
    status: data.status || 'Active',
    agreement_date: data.agreementDate || null,
    handover_date: data.handoverDate || null,
    notes: data.notes || '',
    internal_notes: data.internalNotes || '',
    installment_plan: data.installmentPlan || '',
    booking_ref: data.bookingRef,
    created_by: data.createdBy || null,
    last_updated_by: data.lastUpdatedBy || null,
    updated_at: new Date().toISOString(),
  };
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export function mapPaymentFromDB(row: BookingPaymentDBRow): BookingPayment;
export function mapPaymentFromDB(row: null | undefined): null;
export function mapPaymentFromDB(
  row: BookingPaymentDBRow | null | undefined
): BookingPayment | null;
export function mapPaymentFromDB(
  row: BookingPaymentDBRow | null | undefined
): BookingPayment | null {
  if (!row) return null;
  return {
    id: row.id,
    bookingId: row.booking_id,
    type: row.type,
    installmentNumber: row.installment_number,
    scheduledAmount: Number(row.scheduled_amount) || 0,
    receivedAmount: Number(row.received_amount) || 0,
    status: row.status ?? 'Scheduled',
    dueDate: row.due_date,
    scheduledDate: row.due_date, // compatibility alias
    paidDate: row.paid_date,
    paymentMode: row.payment_mode || '',
    recordedBy: row.recorded_by,
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export function mapActivityFromDB(row: BookingActivityDBRow): BookingActivity;
export function mapActivityFromDB(row: null | undefined): null;
export function mapActivityFromDB(
  row: BookingActivityDBRow | null | undefined
): BookingActivity | null;
export function mapActivityFromDB(
  row: BookingActivityDBRow | null | undefined
): BookingActivity | null {
  if (!row) return null;
  return {
    id: row.id,
    bookingId: row.booking_id,
    type: row.type ?? '',
    action: row.type ?? '', // compatibility alias
    message: row.message ?? '',
    detail: row.message ?? '', // compatibility alias
    actorId: row.actor_id,
    actorName: row.actor_name,
    performedBy: row.actor_name, // compatibility alias
    metadata: row.metadata || {},
    createdAt: row.created_at,
    performedAt: row.created_at, // compatibility alias
  };
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export function mapProfileFromDB(data: ProfileDBRow): UserProfile;
export function mapProfileFromDB(data: null | undefined): null;
export function mapProfileFromDB(data: ProfileDBRow | null | undefined): UserProfile | null;
export function mapProfileFromDB(data: ProfileDBRow | null | undefined): UserProfile | null {
  if (!data) return null;
  return {
    uid: data.id,
    id: data.id,
    displayName: data.display_name ?? '',
    email: data.email ?? '',
    phone: data.phone ?? '',
    role: data.role ?? 'user',
    isBanned: Boolean(data.is_banned),
    referralCode: data.referral_code ?? undefined,
    avatar: data.avatar ?? undefined,
    emergencyPhone: data.emergency_phone ?? undefined,
    nidType: data.nid_type ?? undefined,
    nid: data.nid ?? undefined,
    address: data.address ?? undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
