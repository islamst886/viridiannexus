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
  return {
    id: formData.id,
    name: formData.name,
    location: formData.location,
    price: formData.price,
    status: formData.status,
    property_type: formData.propertyType || [],
    beds: Number(formData.beds) || 0,
    baths: Number(formData.baths) || 0,
    sqft: formData.sqft,
    building_type: formData.buildingType,
    units_per_floor: formData.unitsPerFloor,
    total_units: formData.totalUnits,
    land_area: formData.landArea,
    architect: formData.architect,
    parking_available: formData.parkingAvailable,
    parking_price: formData.parkingPrice,
    passenger_lifts: formData.passengerLifts,
    front_road_size: formData.frontRoadSize,
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
    propertyId: row.property_id,
    propertyName: row.property_name,
    clientName: row.client_name,
    clientEmail: row.client_email,
    clientPhone: row.client_phone,
    clientAddress: row.client_address,
    linkedUserId: row.linked_user_id,
    unitNumber: row.unit_number,
    unitType: row.unit_type,
    floorNumber: row.floor_number,
    parkingSlot: row.parking_slot,
    parkingPrice: row.parking_price,
    totalPrice: row.total_price,
    totalPaid: row.total_paid,
    balanceDue: row.balance_due,
    tokenAmount: row.token_amount,
    downPaymentAmount: row.down_payment_amount,
    stage: row.stage,
    status: row.status,
    agreementDate: row.agreement_date,
    handoverDate: row.handover_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

export function mapBookingToDB(data) {
  return {
    property_id: data.propertyId,
    property_name: data.propertyName,
    client_name: data.clientName,
    client_email: data.clientEmail,
    client_phone: data.clientPhone,
    client_address: data.clientAddress,
    linked_user_id: data.linkedUserId || null,
    unit_number: data.unitNumber,
    unit_type: data.unitType,
    floor_number: data.floorNumber,
    parking_slot: data.parkingSlot || null,
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
    created_by: data.createdBy || null,
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
    scheduledAmount: row.scheduled_amount,
    receivedAmount: row.received_amount,
    status: row.status,
    dueDate: row.due_date,
    paidDate: row.paid_date,
    notes: row.notes,
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
    message: row.message,
    actorId: row.actor_id,
    actorName: row.actor_name,
    metadata: row.metadata || {},
    createdAt: row.created_at,
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
