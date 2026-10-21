// src/utils/mappers.js
// Converts Supabase snake_case rows to the camelCase shape all existing components expect,
// and vice-versa for saving back to the database.

// ─── Properties ───────────────────────────────────────────────────────────────

export function mapPropertyFromDB(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    price: row.price,
    status: row.status,
    propertyType: row.property_type || [],
    beds: row.beds,
    baths: row.baths,
    sqft: row.sqft,
    buildingType: row.building_type,
    unitsPerFloor: row.units_per_floor,
    totalUnits: row.total_units,
    landArea: row.land_area,
    architect: row.architect,
    parkingAvailable: row.parking_available,
    parkingPrice: row.parking_price,
    passengerLifts: row.passenger_lifts,
    frontRoadSize: row.front_road_size,
    totalShare: row.total_share,
    landmarks: row.landmarks,
    googleMapLink: row.google_map_link,
    completionDate: row.completion_date,
    overview: row.overview,
    brochureUrl: row.brochure_url,
    amenities: row.amenities || [],
    customAmenities: row.custom_amenities || [],
    availableUnits: row.available_units || [],
    inventory: row.inventory || [],
    parkingInventory: row.parking_inventory || [],
    milestones: row.milestones || [],
    images: row.images || { hero: '', map: '', floorPlan: '', video: '', gallery: [] },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPropertyToDB(formData) {
  const formatWithUnit = (value, defaultUnit) => {
    if (!value) return '';
    const strVal = String(value).trim();
    if (/[a-zA-Z]/.test(strVal)) return strVal;
    return `${strVal} ${defaultUnit}`;
  };

  return {
    id: formData.id,
    name: formData.name,
    location: formData.location,
    price: formData.price,
    status: formData.status,
    property_type: formData.propertyType || [],
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
    amenities: formData.amenities || [],
    custom_amenities: formData.customAmenities || [],
    available_units: formData.availableUnits || [],
    inventory: formData.inventory || [],
    parking_inventory: formData.parkingInventory || [],
    milestones: formData.milestones || [],
    images: formData.images || { hero: '', map: '', floorPlan: '', video: '', gallery: [] },
    updated_at: new Date().toISOString(),
  };
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

export function mapBookingFromDB(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookingRef: row.booking_ref,
    propertyId: row.property_id,
    propertyName: row.property_name,
    propertyLocation: row.property_location,
    inventoryId: row.inventory_id,
    clientName: row.client_name,
    clientEmail: row.client_email,
    clientPhone: row.client_phone,
    clientNid: row.client_nid,
    clientAddress: row.client_address,
    linkedUserId: row.linked_user_id,
    unitNumber: row.unit_number,
    unitType: row.unit_type,
    floorNumber: row.floor_number,
    parkingSlot: row.parking_slot,
    parkingSpotIds: row.parking_spot_ids || [],
    parkingIncluded: row.parking_included,
    parkingPrice: Number(row.parking_price) || 0,
    totalPrice: Number(row.total_price) || 0,
    totalPaid: Number(row.total_paid) || 0,
    balanceDue: Number(row.balance_due) || 0,
    tokenAmount: Number(row.token_amount) || 0,
    downPaymentAmount: Number(row.down_payment_amount) || 0,
    stage: row.stage,
    status: row.status,
    agreementDate: row.agreement_date,
    handoverDate: row.handover_date,
    notes: row.notes,
    internalNotes: row.internal_notes,
    installmentPlan: row.installment_plan,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    lastUpdatedBy: row.last_updated_by
  };
}

export function mapBookingToDB(data) {
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
    parking_spot_ids: data.parkingSpotIds || [],
    parking_included: data.parkingIncluded || null,
    parking_price: Number(data.parkingPrice) || 0,
    total_price: Number(data.totalPrice) || 0,
    total_paid: Number(data.totalPaid) || 0,
    balance_due: Number(data.balanceDue) || 0,
    token_amount: Number(data.tokenAmount) || 0,
    down_payment_amount: Number(data.downPaymentAmount) || 0,
    stage: data.stage || 'EOI',
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

export function mapPaymentFromDB(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookingId: row.booking_id,
    type: row.type,
    installmentNumber: row.installment_number,
    scheduledAmount: Number(row.scheduled_amount) || 0,
    receivedAmount: Number(row.received_amount) || 0,
    status: row.status,
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

export function mapActivityFromDB(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookingId: row.booking_id,
    type: row.type,
    action: row.type, // compatibility alias
    message: row.message,
    detail: row.message, // compatibility alias
    actorId: row.actor_id,
    actorName: row.actor_name,
    performedBy: row.actor_name, // compatibility alias
    metadata: row.metadata || {},
    createdAt: row.created_at,
    performedAt: row.created_at, // compatibility alias
  };
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export function mapProfileFromDB(data) {
  if (!data) return null;
  return {
    uid: data.id,
    id: data.id,
    displayName: data.display_name,
    email: data.email,
    phone: data.phone,
    role: data.role,
    isBanned: data.is_banned,
    referralCode: data.referral_code,
    avatar: data.avatar,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
