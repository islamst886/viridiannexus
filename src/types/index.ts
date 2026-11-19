export type UserRole = 'user' | 'admin' | 'super_admin';

export type BookingStage =
  | 'EOI'
  | 'Down Payment Paid'
  | 'Agreement Signed'
  | 'Installments Running'
  | 'Fully Paid'
  | 'Handover'
  | 'Completed'
  | 'Cancelled';

export type BookingStatus = 'Active' | 'Completed' | 'Cancelled' | 'On Hold';

export type PaymentStatus = 'Scheduled' | 'Paid' | 'Partially Paid' | 'Waived' | 'Overdue';

export type MilestoneStatus = 'upcoming' | 'current' | 'completed';

export type UnitAvailabilityStatus = 'Available' | 'Booked' | 'On Hold';

export type ParkingSpotStatus = 'Available' | 'Assigned';

export interface PropertyUnitType {
  name: string;
  size: string;
  beds?: number | string;
  baths?: number | string;
  balconies?: number | string;
  price: string;
}

export interface InventoryUnit {
  id: string;
  floor: string;
  unitName: string;
  unitType: string;
  status: UnitAvailabilityStatus | string;
  price?: string;
}

export interface ParkingSpot {
  id: string;
  label: string;
  level?: string;
  zone?: string;
  status: ParkingSpotStatus | string;
  assignedBookingId?: string | null;
}

export interface Milestone {
  id: string;
  date: string;
  title: string;
  description: string;
  status: MilestoneStatus;
  percentage: number;
  images?: string[];
  imageUrl?: string;
}

export interface CustomAmenity {
  name: string;
  icon: string;
}

export interface PropertyImages {
  hero: string;
  map: string;
  floorPlan: string;
  floorPlans?: Record<string, string>;
  video: string;
  gallery: string[];
}

export interface Property {
  id: string;
  name: string;
  location: string;
  price: string;
  status: string;
  propertyType: string[];
  beds: number | string;
  baths: number | string;
  sqft: string;
  buildingType: string;
  unitsPerFloor: number | string;
  totalUnits: number | string;
  landArea: string;
  architect: string;
  parkingAvailable: number | string;
  parkingPrice: number | string;
  passengerLifts: number | string;
  frontRoadSize: string;
  totalShare: number | string;
  landmarks: string;
  googleMapLink: string;
  completionDate: string;
  overview: string;
  brochureUrl: string;
  amenities: string[];
  customAmenities: CustomAmenity[];
  availableUnits: PropertyUnitType[];
  inventory: InventoryUnit[];
  parkingInventory: ParkingSpot[];
  milestones: Milestone[];
  images: PropertyImages;
  createdAt?: string;
  updatedAt?: string;
}

export interface PropertyDBRow {
  id: string;
  name: string;
  location: string;
  price?: string | null;
  status?: string | null;
  property_type?: string[] | string | null;
  beds?: number | string | null;
  baths?: number | string | null;
  sqft?: string | null;
  building_type?: string | null;
  units_per_floor?: string | number | null;
  total_units?: string | number | null;
  land_area?: string | null;
  architect?: string | null;
  parking_available?: string | number | null;
  parking_price?: string | number | null;
  passenger_lifts?: string | number | null;
  front_road_size?: string | null;
  total_share?: string | number | null;
  landmarks?: string | null;
  google_map_link?: string | null;
  completion_date?: string | null;
  overview?: string | null;
  brochure_url?: string | null;
  amenities?: string[] | null;
  custom_amenities?: Array<CustomAmenity | string> | string | null;
  available_units?: PropertyUnitType[] | null;
  inventory?: InventoryUnit[] | null;
  parking_inventory?: ParkingSpot[] | null;
  milestones?: Milestone[] | null;
  images?: Partial<PropertyImages> | null;
  created_at?: string;
  updated_at?: string;
}

export interface Booking {
  id: string;
  bookingRef: string;
  propertyId: string;
  propertyName: string;
  propertyLocation: string;
  inventoryId?: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientNid?: string;
  clientNidType?: string;
  clientAddress?: string;
  linkedUserId?: string | null;
  clientId?: string | null;
  unitNumber?: string;
  unitType?: string;
  floorNumber?: string;
  parkingSlot?: string | null;
  parkingSpotIds: string[];
  parkingIncluded?: string | null;
  parkingRequested?: number;
  parkingPrice: number;
  totalPrice: number;
  totalPaid: number;
  balanceDue: number;
  downPaymentAmount: number;
  stage: BookingStage | string;
  status: BookingStatus | string;
  agreementDate?: string | null;
  agreementRef?: string | null;
  handoverDate?: string | null;
  handoverRecipient?: string | null;
  handoverNotes?: string | null;
  notes?: string;
  internalNotes?: string;
  internal_notes?: string;
  linked_user_id?: string | null;
  installmentPlan?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
  lastUpdatedBy?: string | null;
}

export interface BookingDBRow {
  id?: string;
  booking_ref?: string;
  property_id?: string;
  property_name?: string;
  property_location?: string;
  inventory_id?: string | null;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  client_nid?: string;
  client_address?: string;
  linked_user_id?: string | null;
  client_id?: string | null;
  unit_number?: string;
  unit_type?: string;
  floor_number?: string;
  parking_slot?: string | null;
  parking_spot_ids?: string[] | null;
  parking_included?: string | null;
  parking_price?: number | string | null;
  total_price?: number | string | null;
  total_paid?: number | string | null;
  balance_due?: number | string | null;
  down_payment_amount?: number | string | null;
  stage?: string;
  status?: string;
  agreement_date?: string | null;
  handover_date?: string | null;
  notes?: string | null;
  internal_notes?: string | null;
  installment_plan?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  last_updated_by?: string | null;
}

export interface BookingPayment {
  id: string;
  bookingId: string;
  type: string;
  installmentNumber?: number | null;
  scheduledAmount: number;
  receivedAmount: number;
  status: PaymentStatus | string;
  dueDate?: string | null;
  scheduledDate?: string | null;
  paidDate?: string | null;
  paymentMode: string;
  recordedBy?: string | null;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BookingPaymentDBRow {
  id: string;
  booking_id: string;
  type: string;
  installment_number?: number | null;
  scheduled_amount?: number | string | null;
  received_amount?: number | string | null;
  status?: string | null;
  due_date?: string | null;
  paid_date?: string | null;
  payment_mode?: string | null;
  recorded_by?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BookingActivity {
  id: string;
  bookingId: string;
  type: string;
  action: string;
  message: string;
  detail: string;
  actorId?: string | null;
  actorName?: string | null;
  performedBy?: string | null;
  metadata: Record<string, unknown>;
  createdAt?: string;
  performedAt?: string;
}

export interface BookingActivityDBRow {
  id: string;
  booking_id: string;
  type?: string | null;
  message?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
}

export interface UserProfile {
  uid: string;
  id: string;
  displayName: string;
  email: string;
  phone: string;
  emergencyPhone?: string;
  alternatePhone?: string;
  role: UserRole | string;
  isBanned: boolean;
  referralCode?: string;
  avatar?: string;
  nidType?: string;
  nid?: string;
  address?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProfileDBRow {
  id: string;
  email: string;
  display_name?: string | null;
  phone?: string | null;
  emergency_phone?: string | null;
  role?: string | null;
  is_banned?: boolean | null;
  referral_code?: string | null;
  avatar?: string | null;
  nid_type?: string | null;
  nid?: string | null;
  address?: string | null;
  created_at?: string;
  updated_at?: string;
  last_login_at?: string;
}

export interface WishlistItem {
  id?: string;
  user_id?: string;
  property_id?: string;
  propertyId?: string;
  property_name?: string;
  name?: string;
  location?: string;
  price?: string;
  added_at?: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type?: string;
  message?: string;
  text?: string;
  read: boolean;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface SiteSettings {
  facebookUrl: string;
  youtubeUrl: string;
  linkedinUrl: string;
  whatsappNumber: string;
  lastUpdatedAt?: string;
  lastUpdatedBy?: string;
}

export interface InquiryRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  inquiryType?: string;
  inquiry_type?: string;
  message: string;
  propertyName?: string;
  property_name?: string;
  source?: string;
  status: string;
  created_at?: string;
  createdAt?: string | { seconds: number };
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  status: string;
  subscribed_at?: string;
}

export interface BookingRequestRecord {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  projectName?: string;
  propertyName?: string;
  unitType?: string;
  parkingRequested?: number;
  status: string;
  createdAt?: string;
  linkedUserId?: string | null;
}

export interface JournalArticleAuthor {
  name: string;
  role: string;
  affiliation: string;
  avatar: string;
}

export interface JournalArticleStat {
  label: string;
  value: string;
  note: string;
}

export interface JournalArticleSection {
  heading: string;
  paragraphs: string[];
  quote?: string;
}

export interface JournalRelatedProperty {
  id: string;
  name: string;
  location: string;
  price: string;
  specs: string;
  image: string;
}

export interface JournalArticle {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  readTime: string;
  date: string;
  author: JournalArticleAuthor;
  heroImage: string;
  imageCaption: string;
  summary: string;
  stats: JournalArticleStat[];
  sections: JournalArticleSection[];
  relatedProperties: JournalRelatedProperty[];
}
