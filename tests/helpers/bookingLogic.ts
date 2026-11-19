/**
 * Core Domain Business Logic for Viridian Nexus Booking System
 * Extracted for clean unit testing and enterprise test suite architecture.
 */

export const STAGES: string[] = [
  'EOI',
  'Down Payment Paid',
  'Agreement Signed',
  'Installments Running',
  'Fully Paid',
  'Handover',
  'Completed',
];

export interface MockInventoryItem {
  id: string;
  unitName: string;
  unitType: string;
  floor: string;
  status: string;
  price?: string | number;
  [key: string]: unknown;
}

export interface MockParkingSpot {
  id: string;
  label: string;
  level: string;
  status: string;
  assignedBookingId?: string | null;
  [key: string]: unknown;
}

export interface MockPropertyForBooking {
  id: string;
  name: string;
  location?: string;
  parkingPrice?: string | number;
  inventory: MockInventoryItem[];
  parkingInventory: MockParkingSpot[];
  [key: string]: unknown;
}

export interface MockBookingRecord {
  id: string;
  bookingRef?: string;
  booking_ref?: string;
  clientName?: string;
  client_name?: string;
  clientEmail?: string;
  client_email?: string;
  clientPhone?: string;
  client_phone?: string;
  clientNid?: string;
  client_nid?: string;
  clientAddress?: string;
  client_address?: string;
  linkedUserId?: string;
  linked_user_id?: string;
  propertyId?: string;
  property_id?: string;
  propertyName?: string;
  property_name?: string;
  inventoryId?: string;
  inventory_id?: string;
  unitNumber?: string;
  unit_number?: string;
  unitType?: string;
  unit_type?: string;
  parkingSpotIds?: string[];
  parking_spot_ids?: string[];
  parkingIncluded?: string;
  parking_included?: string;
  totalPrice?: number;
  total_price?: number;
  totalPaid?: number;
  total_paid?: number;
  balanceDue?: number;
  balance_due?: number;
  downPaymentAmount?: number;
  down_payment_amount?: number;
  stage: string;
  status?: string;
  internalNotes?: string;
  internal_notes?: string;
  createdBy?: string;
  [key: string]: unknown;
}

export interface MockPaymentRecord {
  id?: string;
  bookingId?: string;
  type: string;
  scheduledAmount: number;
  receivedAmount?: number;
  status?: string;
  dueDate?: string | null;
  due_date?: string | null;
  scheduledDate?: string | null;
  paidDate?: string | null;
  paymentMode?: string;
  notes?: string | null;
  recordedBy?: string;
  [key: string]: unknown;
}

export interface InstallmentItem {
  installmentNumber: number;
  dueDate: string;
  scheduledAmount: number;
  receivedAmount: number;
  status: string;
}

export function validateEoiStep1(
  selectedProject: unknown,
  selectedUnit: unknown
): { valid: boolean; error?: string } {
  if (!selectedProject) return { valid: false, error: 'Please select a project.' };
  if (!selectedUnit) return { valid: false, error: 'Please select a unit.' };
  return { valid: true };
}

export interface EoiStep2Form {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  nid?: string | null;
  address?: string | null;
}

export function validateEoiStep2(form: EoiStep2Form): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  if (!form.firstName?.trim()) errors.firstName = 'Required';
  if (!form.lastName?.trim()) errors.lastName = 'Required';
  if (!form.email?.trim() || !/\S+@\S+\.\S+/.test(form.email)) errors.email = 'Valid email required';
  if (!form.phone?.trim() || form.phone.length < 10) errors.phone = 'Valid phone required';
  if (!form.nid?.trim()) errors.nid = 'NID/Passport required';
  if (!form.address?.trim()) errors.address = 'Required';
  return { valid: Object.keys(errors).length === 0, errors };
}

export function generateBookingRef(rawId: string): string {
  return rawId.slice(0, 8).toUpperCase();
}

export function calculateFinancialSummary(
  totalPrice: number | string | null | undefined,
  totalPaid: number | string | null | undefined
): {
  totalPrice: number;
  totalPaid: number;
  balanceDue: number;
  completionPct: number;
} {
  const price = Number(totalPrice) || 0;
  const paid = Number(totalPaid) || 0;
  const balanceDue = Math.max(0, price - paid);
  const completionPct = price > 0 ? Math.min(100, Math.round((paid / price) * 100)) : 0;
  return { totalPrice: price, totalPaid: paid, balanceDue, completionPct };
}

export function evaluatePaymentDisplayStatus(
  payment: Partial<MockPaymentRecord>,
  referenceDate: Date = new Date()
): string {
  if (payment.status === 'Paid') return 'Paid';
  if (payment.status === 'Partially Paid') return 'Partially Paid';

  const dueDateStr = payment.dueDate || payment.due_date || payment.scheduledDate;
  if (dueDateStr) {
    const dueDate = new Date(dueDateStr);
    if (!Number.isNaN(dueDate.getTime()) && dueDate < referenceDate) {
      return 'Overdue';
    }
  }
  return payment.status || 'Scheduled';
}

export interface ProfileDriftDiff {
  field: string;
  current: string | undefined;
  updated: string;
}

export interface LinkedUserProfileMock {
  displayName?: string;
  phone?: string;
  email?: string;
  nid?: string;
  nidType?: string;
  address?: string;
}

export function detectProfileDrift(
  booking: Partial<MockBookingRecord> | null | undefined,
  linkedUser: LinkedUserProfileMock | null | undefined
): ProfileDriftDiff[] {
  if (!booking || !linkedUser) return [];
  const diffs: ProfileDriftDiff[] = [];

  const bName = booking.clientName || booking.client_name;
  if (linkedUser.displayName && bName !== linkedUser.displayName) {
    diffs.push({ field: 'Name', current: bName, updated: linkedUser.displayName });
  }

  const bPhone = booking.clientPhone || booking.client_phone;
  if (linkedUser.phone && bPhone !== linkedUser.phone) {
    diffs.push({ field: 'Phone', current: bPhone, updated: linkedUser.phone });
  }

  const bEmail = booking.clientEmail || booking.client_email;
  if (linkedUser.email && bEmail !== linkedUser.email) {
    diffs.push({ field: 'Email', current: bEmail, updated: linkedUser.email });
  }

  const bNid = booking.clientNid || booking.client_nid;
  if (linkedUser.nid && bNid !== linkedUser.nid) {
    diffs.push({
      field: linkedUser.nidType || 'NID',
      current: bNid || 'Not set',
      updated: linkedUser.nid,
    });
  }

  const bAddr = booking.clientAddress || booking.client_address;
  if (linkedUser.address && bAddr !== linkedUser.address) {
    diffs.push({ field: 'Address', current: bAddr || 'Not set', updated: linkedUser.address });
  }

  return diffs;
}

export function calculateBookingTotal({
  basePrice,
  parkingPricePerSpot,
  parkingSpotIds = [],
  pricingAdjustment = 0,
}: {
  basePrice?: number | string;
  parkingPricePerSpot?: number | string;
  parkingSpotIds?: string[];
  pricingAdjustment?: number | string;
}): number {
  const base = Number(basePrice) || 0;
  const parkingQty = (parkingSpotIds || []).length;
  const parkingTotal = (Number(parkingPricePerSpot) || 0) * parkingQty;
  const adj = Number(pricingAdjustment) || 0;
  return base + parkingTotal + adj;
}

export interface BookingWizardFormInput {
  propertyId?: string | null;
  inventoryId?: string | null;
  parkingSpotIds?: string[];
  linkedUserId?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientNid?: string | null;
  clientAddress?: string | null;
  totalPrice?: number | string | null;
  downPaymentAmount?: number | string | null;
  installmentCount?: number | string | null;
  installmentStartDate?: string | null;
  installmentFrequency?: string | null;
}

export function validateBookingWizardStep(
  step: number,
  form: BookingWizardFormInput
): { valid: boolean; error?: string } {
  if (step === 1) {
    if (!form.propertyId || !form.inventoryId) {
      return { valid: false, error: 'Please select a property and a specific unit.' };
    }
  }
  if (step === 2) {
    if (!form.linkedUserId) {
      return { valid: false, error: 'Linking a user account is mandatory.' };
    }
    if (!form.clientName || !form.clientEmail || !form.clientPhone) {
      return { valid: false, error: 'Client name, email, and phone are required.' };
    }
    if (!form.clientNid) {
      return { valid: false, error: 'Client NID number is required.' };
    }
    if (!form.clientAddress) {
      return { valid: false, error: 'Current Address is required.' };
    }
  }
  if (step === 3) {
    if (!form.totalPrice || Number(form.totalPrice) <= 0) {
      return { valid: false, error: 'Total price is required.' };
    }
    if (form.downPaymentAmount === undefined || form.downPaymentAmount === null || form.downPaymentAmount === '') {
      return { valid: false, error: 'Down payment is required. Enter 0 if none.' };
    }
    if (Number(form.downPaymentAmount) < 0) {
      return { valid: false, error: 'Down payment cannot be negative.' };
    }
    if (Number(form.downPaymentAmount) > Number(form.totalPrice)) {
      return { valid: false, error: 'Down payment cannot exceed total price.' };
    }
    if (!form.installmentCount || Number(form.installmentCount) <= 0) {
      return { valid: false, error: 'Total installments count is required.' };
    }
    if (!form.installmentStartDate) {
      return { valid: false, error: 'Installment start date is required.' };
    }
    if (!form.installmentFrequency) {
      return { valid: false, error: 'Installment frequency is required.' };
    }
  }
  return { valid: true };
}

export function generateInstallmentSchedule({
  totalPrice,
  downPaymentAmount = 0,
  installmentCount,
  startDate,
  frequency,
}: {
  totalPrice: number | string;
  downPaymentAmount?: number | string;
  installmentCount: number | string;
  startDate: string | Date;
  frequency?: string;
}): InstallmentItem[] {
  const total = Number(totalPrice);
  const dp = Number(downPaymentAmount || 0);
  const count = Number(installmentCount);

  const amountRemaining = total - dp;
  if (amountRemaining <= 0 || count <= 0) return [];

  const baseInstAmount = Math.round(amountRemaining / count / 10) * 10;
  const installments: InstallmentItem[] = [];
  const currentDate = new Date(startDate);

  for (let i = 1; i <= count; i++) {
    const currentInstAmount =
      i === count ? amountRemaining - baseInstAmount * (count - 1) : baseInstAmount;

    installments.push({
      installmentNumber: i,
      dueDate: new Date(currentDate).toISOString().split('T')[0] ?? '',
      scheduledAmount: currentInstAmount,
      receivedAmount: 0,
      status: 'Scheduled',
    });

    switch (frequency) {
      case 'Monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      case 'Bi-Monthly':
        currentDate.setMonth(currentDate.getMonth() + 2);
        break;
      case 'Quarterly':
        currentDate.setMonth(currentDate.getMonth() + 3);
        break;
      case 'Tri-Annual':
        currentDate.setMonth(currentDate.getMonth() + 4);
        break;
      case 'Semi-Annual':
        currentDate.setMonth(currentDate.getMonth() + 6);
        break;
      case 'Annual':
        currentDate.setMonth(currentDate.getMonth() + 12);
        break;
      default:
        currentDate.setMonth(currentDate.getMonth() + 1);
    }
  }

  return installments;
}

export function simulateBookingCreation({
  property,
  form,
  adminUid = 'adm-101',
}: {
  property: MockPropertyForBooking;
  form: BookingWizardFormInput;
  adminUid?: string;
}): {
  bookingDoc: MockBookingRecord;
  updatedInventory: MockInventoryItem[];
  updatedParkingInventory: MockParkingSpot[];
} {
  const invIndex = property.inventory.findIndex((inv) => inv.id === form.inventoryId);
  if (invIndex === -1) throw new Error('Selected unit not found in inventory.');
  const targetInv = property.inventory[invIndex];
  if (targetInv && targetInv.status !== 'Available') {
    throw new Error(`This unit is no longer available (Current status: ${targetInv.status}).`);
  }

  const selectedSpotIds = form.parkingSpotIds || [];
  for (const spotId of selectedSpotIds) {
    const spot = property.parkingInventory.find((s) => s.id === spotId);
    if (!spot) throw new Error(`Parking spot ${spotId} not found.`);
    if (spot.status !== 'Available') {
      throw new Error(`Parking spot "${spot.label}" is no longer available.`);
    }
  }

  const newBookingId = 'bkg-new-999';
  const bookingRef = 'VN-2026-9999';

  const updatedInventory = property.inventory.map((inv) =>
    inv.id === form.inventoryId ? { ...inv, status: 'Booked' } : inv
  );

  const updatedParkingInventory = property.parkingInventory.map((s) =>
    selectedSpotIds.includes(s.id)
      ? { ...s, status: 'Assigned', assignedBookingId: newBookingId }
      : s
  );

  const numericTotalPrice = Number(form.totalPrice ?? 0);

  const bookingDoc: MockBookingRecord = {
    id: newBookingId,
    bookingRef,
    clientName: form.clientName ?? '',
    clientEmail: form.clientEmail ?? '',
    clientPhone: form.clientPhone ?? '',
    clientNid: form.clientNid ?? '',
    clientAddress: form.clientAddress ?? '',
    linkedUserId: form.linkedUserId ?? '',
    propertyId: form.propertyId ?? '',
    inventoryId: form.inventoryId ?? '',
    parkingSpotIds: selectedSpotIds,
    totalPrice: numericTotalPrice,
    downPaymentAmount: Number(form.downPaymentAmount ?? 0),
    totalPaid: 0,
    balanceDue: numericTotalPrice,
    stage: 'EOI',
    status: 'Active',
    createdBy: adminUid,
  };

  return { bookingDoc, updatedInventory, updatedParkingInventory };
}

export function recordPaymentTransaction({
  payment,
  booking,
  amountReceived,
  mode = 'Bank Transfer',
  ref = '',
  note = '',
}: {
  payment: MockPaymentRecord;
  booking: MockBookingRecord;
  amountReceived: number | string;
  mode?: string;
  ref?: string;
  note?: string;
}): {
  updatedPayment: MockPaymentRecord;
  updatedBooking: MockBookingRecord;
  activityMessage: string;
} {
  const numAmount = Number(amountReceived);
  if (!numAmount || numAmount <= 0) {
    throw new Error('Amount must be greater than zero');
  }

  const isFull = numAmount >= payment.scheduledAmount;
  const paymentNotes = ref ? (note ? `Ref: ${ref} | ${note}` : `Ref: ${ref}`) : note || null;

  const updatedPayment: MockPaymentRecord = {
    ...payment,
    receivedAmount: numAmount,
    paymentMode: mode,
    notes: paymentNotes,
    status: isFull ? 'Paid' : 'Partially Paid',
    paidDate: new Date().toISOString().split('T')[0],
  };

  const prevReceived = Number(payment.receivedAmount || 0);
  const delta = Math.max(0, numAmount - prevReceived);
  const newTotalPaid = (Number(booking.totalPaid) || 0) + delta;
  const newBalance = Math.max(0, Number(booking.totalPrice) - newTotalPaid);

  let nextStage = booking.stage;

  if (isFull) {
    if (
      payment.type === 'Down Payment' &&
      STAGES.indexOf(booking.stage) < STAGES.indexOf('Down Payment Paid')
    ) {
      nextStage = 'Down Payment Paid';
    } else if (
      payment.type.startsWith('Installment') &&
      STAGES.indexOf(booking.stage) < STAGES.indexOf('Installments Running')
    ) {
      nextStage = 'Installments Running';
    }
  }

  if (newBalance === 0 && STAGES.indexOf(nextStage) < STAGES.indexOf('Fully Paid')) {
    nextStage = 'Fully Paid';
  }

  const updatedBooking: MockBookingRecord = {
    ...booking,
    totalPaid: newTotalPaid,
    balanceDue: newBalance,
    stage: nextStage,
  };

  const activityMessage = `${payment.type} payment of ৳${numAmount.toLocaleString('en-IN')} received via ${mode}${ref ? ` (Ref: ${ref})` : ''}`;

  return { updatedPayment, updatedBooking, activityMessage };
}

export function addCustomScheduledPayment({
  booking,
  type,
  amount,
  dueDate,
  adminUid = 'adm-101',
}: {
  booking: MockBookingRecord;
  type: string;
  amount: number | string;
  dueDate: string;
  adminUid?: string;
}): {
  newPayment: MockPaymentRecord;
  updatedBooking: MockBookingRecord;
} {
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    throw new Error('Amount must be greater than zero');
  }
  if (!dueDate) {
    throw new Error('Due date is required');
  }

  const newPayment: MockPaymentRecord = {
    id: 'pay-custom-999',
    bookingId: booking.id,
    type,
    scheduledAmount: numAmount,
    receivedAmount: 0,
    status: 'Scheduled',
    dueDate: new Date(dueDate).toISOString().split('T')[0],
    paymentMode: 'Cash',
    recordedBy: adminUid,
  };

  const newTotalPrice = (Number(booking.totalPrice) || 0) + numAmount;
  const newBalance = Math.max(0, newTotalPrice - (Number(booking.totalPaid) || 0));

  const updatedBooking: MockBookingRecord = {
    ...booking,
    totalPrice: newTotalPrice,
    balanceDue: newBalance,
  };

  return { newPayment, updatedBooking };
}

export function reassignBookingUnit({
  booking,
  currentProperty,
  targetProperty,
  newInventoryId,
}: {
  booking: MockBookingRecord;
  currentProperty: MockPropertyForBooking;
  targetProperty: MockPropertyForBooking;
  newInventoryId: string;
}): {
  updatedBooking: MockBookingRecord;
  updatedCurrentInventory: MockInventoryItem[];
  updatedTargetInventory: MockInventoryItem[];
} {
  const newUnit = targetProperty.inventory.find((i) => i.id === newInventoryId);
  if (!newUnit) throw new Error('Target unit not found');
  if (newUnit.status !== 'Available') throw new Error(`Unit ${newUnit.unitName} is not available`);

  const updatedCurrentInventory = currentProperty.inventory.map((inv) =>
    inv.id === booking.inventoryId ? { ...inv, status: 'Available' } : inv
  );

  let updatedTargetInventory: MockInventoryItem[];
  if (currentProperty.id === targetProperty.id) {
    updatedTargetInventory = updatedCurrentInventory.map((inv) =>
      inv.id === newInventoryId ? { ...inv, status: 'Booked' } : inv
    );
  } else {
    updatedTargetInventory = targetProperty.inventory.map((inv) =>
      inv.id === newInventoryId ? { ...inv, status: 'Booked' } : inv
    );
  }

  const updatedBooking: MockBookingRecord = {
    ...booking,
    propertyId: targetProperty.id,
    propertyName: targetProperty.name,
    inventoryId: newInventoryId,
    unitNumber: `Floor ${newUnit.floor}, ${newUnit.unitName}`,
    unitType: newUnit.unitType,
  };

  return { updatedBooking, updatedCurrentInventory, updatedTargetInventory };
}

export function addParkingSpotToBooking({
  booking,
  property,
  spotId,
  generateInvoice = true,
  dueDate = '2026-06-01',
}: {
  booking: MockBookingRecord;
  property: MockPropertyForBooking;
  spotId: string;
  generateInvoice?: boolean;
  dueDate?: string;
}): {
  updatedBooking: MockBookingRecord;
  updatedParkingInventory: MockParkingSpot[];
  newPayment: MockPaymentRecord | null;
} {
  const spot = property.parkingInventory.find((s) => s.id === spotId);
  if (!spot) throw new Error('Spot not found');
  if (spot.status !== 'Available') throw new Error(`Spot ${spot.label} is not available`);

  const spotPrice = Number(property.parkingPrice || 0);

  const updatedParkingInventory = property.parkingInventory.map((s) =>
    s.id === spotId ? { ...s, status: 'Assigned', assignedBookingId: booking.id } : s
  );

  const updatedSpotIds = [...(booking.parkingSpotIds || []), spotId];

  let newPayment: MockPaymentRecord | null = null;
  let newTotalPrice = booking.totalPrice;
  let newBalance = booking.balanceDue;

  if (generateInvoice) {
    newTotalPrice = Number(booking.totalPrice) + spotPrice;
    newBalance = Number(booking.balanceDue) + spotPrice;
    newPayment = {
      bookingId: booking.id,
      type: `Parking Fee - ${spot.label}`,
      scheduledAmount: spotPrice,
      receivedAmount: 0,
      status: 'Scheduled',
      dueDate,
    };
  }

  const updatedBooking: MockBookingRecord = {
    ...booking,
    parkingSpotIds: updatedSpotIds,
    parkingIncluded: `${booking.parkingIncluded ? booking.parkingIncluded + ', ' : ''}${spot.label}`,
    totalPrice: newTotalPrice,
    balanceDue: newBalance,
  };

  return { updatedBooking, updatedParkingInventory, newPayment };
}

export function releaseParkingSpotFromBooking({
  booking,
  property,
  spotId,
  issueCreditNote = true,
}: {
  booking: MockBookingRecord;
  property: MockPropertyForBooking;
  spotId: string;
  issueCreditNote?: boolean;
}): {
  updatedBooking: MockBookingRecord;
  updatedParkingInventory: MockParkingSpot[];
} {
  const spot = property.parkingInventory.find((s) => s.id === spotId);
  if (!spot) throw new Error('Spot not found');

  const spotPrice = Number(property.parkingPrice || 0);

  const updatedParkingInventory = property.parkingInventory.map((s) =>
    s.id === spotId ? { ...s, status: 'Available', assignedBookingId: null } : s
  );

  const updatedSpotIds = (booking.parkingSpotIds || []).filter((id) => id !== spotId);

  let newTotalPrice = booking.totalPrice;
  let newBalance = booking.balanceDue;

  if (issueCreditNote) {
    newTotalPrice = Math.max(0, Number(booking.totalPrice) - spotPrice);
    newBalance = Math.max(0, Number(booking.balanceDue) - spotPrice);
  }

  const updatedBooking: MockBookingRecord = {
    ...booking,
    parkingSpotIds: updatedSpotIds,
    totalPrice: newTotalPrice,
    balanceDue: newBalance,
  };

  return { updatedBooking, updatedParkingInventory };
}

export function swapParkingSpotForBooking({
  booking,
  property,
  currentSpotId,
  targetSpotId,
}: {
  booking: MockBookingRecord;
  property: MockPropertyForBooking;
  currentSpotId: string;
  targetSpotId: string;
}): {
  updatedBooking: MockBookingRecord;
  updatedParkingInventory: MockParkingSpot[];
} {
  const currentSpot = property.parkingInventory.find((s) => s.id === currentSpotId);
  const targetSpot = property.parkingInventory.find((s) => s.id === targetSpotId);

  if (!currentSpot || !targetSpot) throw new Error('Parking spots not found');
  if (targetSpot.status !== 'Available') {
    throw new Error(`Target spot ${targetSpot.label} is not available`);
  }

  const updatedParkingInventory = property.parkingInventory.map((s) => {
    if (s.id === currentSpotId) return { ...s, status: 'Available', assignedBookingId: null };
    if (s.id === targetSpotId) return { ...s, status: 'Assigned', assignedBookingId: booking.id };
    return s;
  });

  const updatedSpotIds = (booking.parkingSpotIds || []).map((id) =>
    id === currentSpotId ? targetSpotId : id
  );

  const updatedBooking: MockBookingRecord = {
    ...booking,
    parkingSpotIds: updatedSpotIds,
    totalPrice: booking.totalPrice,
    balanceDue: booking.balanceDue,
  };

  return { updatedBooking, updatedParkingInventory };
}

export function cancelBookingAndReleaseAssets({
  booking,
  property,
  reason,
  adminName = 'Admin',
}: {
  booking: MockBookingRecord;
  property: MockPropertyForBooking;
  reason?: string | null;
  adminName?: string;
}): {
  updatedBooking: MockBookingRecord;
  updatedInventory: MockInventoryItem[];
  updatedParkingInventory: MockParkingSpot[];
  activityLog: {
    bookingId: string;
    type: string;
    message: string;
    metadata: { reason: string; cancelledBy: string };
  };
} {
  if (!reason?.trim()) throw new Error('Cancellation reason is required');

  const updatedInventory = property.inventory.map((inv) =>
    inv.id === booking.inventoryId ? { ...inv, status: 'Available' } : inv
  );

  const assignedSpotIds = booking.parkingSpotIds || [];
  const updatedParkingInventory = property.parkingInventory.map((s) =>
    assignedSpotIds.includes(s.id) ? { ...s, status: 'Available', assignedBookingId: null } : s
  );

  const updatedBooking: MockBookingRecord = {
    ...booking,
    status: 'Cancelled',
    internalNotes: `${booking.internalNotes || ''}\n[Cancelled by ${adminName}: ${reason.trim()}]`,
  };

  const activityLog = {
    bookingId: booking.id,
    type: 'Booking Cancelled',
    message: `Booking cancelled by ${adminName}. Reason: ${reason.trim()}`,
    metadata: { reason: reason.trim(), cancelledBy: adminName },
  };

  return { updatedBooking, updatedInventory, updatedParkingInventory, activityLog };
}

export function evaluateCanAdvanceStage({
  evaluation,
  isSuperAdmin,
  overrideAuthorized,
  overrideReason,
  isSameStage,
}: {
  evaluation: { allowed: boolean };
  isSuperAdmin: boolean;
  overrideAuthorized: boolean;
  overrideReason?: string | null;
  isSameStage: boolean;
}): boolean {
  if (isSameStage) return false;
  if (evaluation.allowed) return true;

  if (isSuperAdmin && overrideAuthorized && (overrideReason?.trim().length ?? 0) >= 8) {
    return true;
  }
  return false;
}

export function buildStageTransitionPayload({
  booking,
  targetStage,
  evaluation,
  isSuperAdmin,
  overrideAuthorized,
  overrideReason,
  adminName,
  adminUid,
}: {
  booking: MockBookingRecord;
  targetStage: string;
  evaluation: { allowed: boolean; isRollback?: boolean };
  isSuperAdmin: boolean;
  overrideAuthorized: boolean;
  overrideReason?: string | null;
  adminName: string;
  adminUid: string;
}): {
  bookingUpdates: { stage: string; last_updated_by: string };
  activityLog: {
    booking_id: string;
    type: string;
    message: string;
    actor_name: string;
    actor_id: string;
    metadata: {
      previousStage: string;
      targetStage: string;
      isOverride: boolean;
      overrideReason: string | null;
    };
  };
} {
  const isRollback = Boolean(evaluation.isRollback);
  const isOverride = !evaluation.allowed && isSuperAdmin && overrideAuthorized;
  const trimmedReason = (overrideReason ?? '').trim();

  const logType = isOverride
    ? 'Stage Override (Super Admin)'
    : isRollback
      ? 'Stage Rolled Back'
      : 'Stage Advanced';

  const logMessage = isOverride
    ? `Stage forcibly set from "${booking.stage}" to "${targetStage}" by ${adminName}. Justification: ${trimmedReason}`
    : isRollback
      ? `Stage reverted from "${booking.stage}" to "${targetStage}" by ${adminName}`
      : `Stage advanced from "${booking.stage}" to "${targetStage}" by ${adminName}`;

  const metadata = {
    previousStage: booking.stage,
    targetStage,
    isOverride,
    overrideReason: isOverride ? trimmedReason : null,
  };

  return {
    bookingUpdates: {
      stage: targetStage,
      last_updated_by: adminUid,
    },
    activityLog: {
      booking_id: booking.id,
      type: logType,
      message: logMessage,
      actor_name: adminName,
      actor_id: adminUid,
      metadata,
    },
  };
}
