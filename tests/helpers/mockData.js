/**
 * Realistic Mock Data Factory for Viridian Nexus Test Suite
 * Conforming to production Supabase schemas and business constraints.
 */

export const mockUsers = {
  clientUserA: {
    uid: 'usr-uuid-101',
    id: 'usr-uuid-101',
    displayName: 'Rahim Chowdhury',
    email: 'rahim.chowdhury@example.com',
    phone: '+8801711000000',
    role: 'user',
    nidType: 'NID',
    nid: '19852691234567890',
    address: 'Road 12, Banani, Dhaka'
  },
  clientUserB: {
    uid: 'usr-uuid-202',
    id: 'usr-uuid-202',
    displayName: 'Farhana Ahmed',
    email: 'farhana.ahmed@example.com',
    phone: '+8801722000000',
    role: 'user',
    nidType: 'Passport',
    nid: 'BC0987654',
    address: 'Sector 3, Uttara, Dhaka'
  },
  adminUser: {
    uid: 'adm-uuid-303',
    id: 'adm-uuid-303',
    displayName: 'Operations Admin',
    email: 'admin@viridiannexus.com',
    role: 'admin'
  },
  superAdminUser: {
    uid: 'sad-uuid-404',
    id: 'sad-uuid-404',
    displayName: 'Executive Super Admin',
    email: 'executive@viridiannexus.com',
    role: 'super_admin'
  }
};

export const createMockProperty = () => ({
  id: 'prop-jolshiri-01',
  name: 'Viridian Jolshiri Exclusivity',
  location: 'Sector 15, Jolshiri Abashon, Dhaka',
  parkingPrice: '500000',
  availableUnits: [
    { name: 'Type A – 2,860 sqft', size: '2860 sqft', price: '30000000' },
    { name: 'Type B – 3,200 sqft', size: '3200 sqft', price: '35000000' }
  ],
  inventory: [
    {
      id: 'inv-4a',
      unitName: 'Unit 4A',
      unitType: 'Type A – 2,860 sqft',
      floor: '4th Floor',
      status: 'Available',
      price: '30000000'
    },
    {
      id: 'inv-5a',
      unitName: 'Unit 5A',
      unitType: 'Type A – 2,860 sqft',
      floor: '5th Floor',
      status: 'Available',
      price: '30000000'
    },
    {
      id: 'inv-6b',
      unitName: 'Unit 6B',
      unitType: 'Type B – 3,200 sqft',
      floor: '6th Floor',
      status: 'Booked',
      price: '35000000'
    }
  ],
  parkingInventory: [
    { id: 'spot-p1-01', label: 'P1-01', level: 'Basement 1', status: 'Available' },
    { id: 'spot-p1-02', label: 'P1-02', level: 'Basement 1', status: 'Available' },
    { id: 'spot-p1-03', label: 'P1-03', level: 'Basement 1', status: 'Assigned', assignedBookingId: 'booking-existing-01' },
    { id: 'spot-p2-01', label: 'P2-01', level: 'Basement 2', status: 'Available' }
  ]
});

export const createMockBooking = (overrides = {}) => ({
  id: 'bkg-uuid-001',
  bookingRef: 'VN-2026-0042',
  booking_ref: 'VN-2026-0042',
  clientName: 'Rahim Chowdhury',
  client_name: 'Rahim Chowdhury',
  clientEmail: 'rahim.chowdhury@example.com',
  client_email: 'rahim.chowdhury@example.com',
  clientPhone: '+8801711000000',
  client_phone: '+8801711000000',
  clientNid: '19852691234567890',
  client_nid: '19852691234567890',
  clientAddress: 'Road 12, Banani, Dhaka',
  client_address: 'Road 12, Banani, Dhaka',
  linkedUserId: 'usr-uuid-101',
  linked_user_id: 'usr-uuid-101',
  propertyId: 'prop-jolshiri-01',
  property_id: 'prop-jolshiri-01',
  propertyName: 'Viridian Jolshiri Exclusivity',
  property_name: 'Viridian Jolshiri Exclusivity',
  inventoryId: 'inv-4a',
  inventory_id: 'inv-4a',
  unitNumber: 'Floor 4, Unit 4A',
  unit_number: 'Floor 4, Unit 4A',
  unitType: 'Type A – 2,860 sqft',
  unit_type: 'Type A – 2,860 sqft',
  parkingSpotIds: ['spot-p1-01'],
  parking_spot_ids: ['spot-p1-01'],
  parkingIncluded: 'P1-01 (Basement 1)',
  parking_included: 'P1-01 (Basement 1)',
  totalPrice: 30500000,
  total_price: 30500000,
  totalPaid: 500000,
  total_paid: 500000,
  balanceDue: 30000000,
  balance_due: 30000000,
  tokenAmount: 500000,
  token_amount: 500000,
  downPaymentAmount: 4500000,
  down_payment_amount: 4500000,
  stage: 'Token Paid',
  status: 'Active',
  agreementDate: null,
  agreement_date: null,
  handoverDate: null,
  handover_date: null,
  installmentPlan: 'Quarterly',
  installment_plan: 'Quarterly',
  createdAt: '2026-01-01T10:00:00Z',
  created_at: '2026-01-01T10:00:00Z',
  internalNotes: '',
  internal_notes: '',
  ...overrides
});

export const createMockPayments = (bookingId = 'bkg-uuid-001') => [
  {
    id: 'pay-token-01',
    bookingId,
    booking_id: bookingId,
    type: 'Token',
    installmentNumber: null,
    installment_number: null,
    scheduledAmount: 500000,
    scheduled_amount: 500000,
    receivedAmount: 500000,
    received_amount: 500000,
    status: 'Paid',
    dueDate: '2026-01-01',
    due_date: '2026-01-01',
    paidDate: '2026-01-01',
    paid_date: '2026-01-01',
    paymentMode: 'Bank Transfer',
    payment_mode: 'Bank Transfer',
    notes: 'Ref: TXN-TOKEN-01'
  },
  {
    id: 'pay-dp-02',
    bookingId,
    booking_id: bookingId,
    type: 'Down Payment',
    installmentNumber: null,
    installment_number: null,
    scheduledAmount: 4500000,
    scheduled_amount: 4500000,
    receivedAmount: 0,
    received_amount: 0,
    status: 'Scheduled',
    dueDate: '2026-01-15',
    due_date: '2026-01-15',
    paidDate: null,
    paid_date: null,
    paymentMode: 'Cash',
    payment_mode: 'Cash',
    notes: null
  },
  {
    id: 'pay-inst-01',
    bookingId,
    booking_id: bookingId,
    type: 'Installment',
    installmentNumber: 1,
    installment_number: 1,
    scheduledAmount: 6375000,
    scheduled_amount: 6375000,
    receivedAmount: 0,
    received_amount: 0,
    status: 'Scheduled',
    dueDate: '2026-04-15',
    due_date: '2026-04-15',
    paidDate: null,
    paid_date: null,
    paymentMode: 'Cash',
    payment_mode: 'Cash',
    notes: null
  }
];

export const createMockMilestone = (overrides = {}) => ({
  id: 'ms-demo-01',
  date: 'October 2025',
  title: 'Substructure Piling Completed',
  description: '120 heavy duty reinforced concrete piles bored and cast under engineer supervision.',
  status: 'completed',
  percentage: 100,
  images: [
    'https://xyz.supabase.co/storage/v1/object/public/milestones/prop-1/piling1.jpg',
    'https://xyz.supabase.co/storage/v1/object/public/milestones/prop-1/piling2.jpg'
  ],
  ...overrides
});

export const createMockPropertiesForProgress = () => [
  {
    id: 'prop-heights-01',
    name: 'Viridian Sky Heights',
    status: 'Under Construction',
    milestones: [
      {
        id: 'ms-01',
        title: 'Deep Foundation & Soil Stabilization',
        date: 'January 2025',
        description: 'Completed soil reinforcement with 120 reinforced concrete friction piles.',
        status: 'completed',
        percentage: 100,
        images: ['https://xyz.supabase.co/storage/v1/object/public/milestones/prop-1/foundation.jpg']
      },
      {
        id: 'ms-02',
        title: 'Double Basement RCC Casting',
        date: 'June 2025',
        description: 'Cast basement levels B1 and B2 with waterproof membrane sealing.',
        status: 'completed',
        percentage: 100,
        images: [
          'https://xyz.supabase.co/storage/v1/object/public/milestones/prop-1/b1.jpg',
          'https://xyz.supabase.co/storage/v1/object/public/milestones/prop-1/b2.jpg'
        ]
      },
      {
        id: 'ms-03',
        title: 'Superstructure 12th Floor Slab Cast',
        date: 'October 2025',
        description: 'Casting 12th level floor slab and post-tensioning elevator core walls.',
        status: 'current',
        percentage: 65,
        images: [
          'https://xyz.supabase.co/storage/v1/object/public/milestones/prop-1/floor12a.jpg',
          'https://xyz.supabase.co/storage/v1/object/public/milestones/prop-1/floor12b.jpg',
          'https://xyz.supabase.co/storage/v1/object/public/milestones/prop-1/floor12c.jpg'
        ]
      },
      {
        id: 'ms-04',
        title: 'Interior Finishing & Façade Glazing',
        date: 'April 2026',
        description: 'Italian marble flooring and double-glazed low-E acoustic glass curtain wall.',
        status: 'upcoming',
        percentage: 0,
        images: []
      }
    ]
  },
  {
    id: 'prop-serenity-02',
    name: 'Viridian Serenity Residences',
    status: 'Ready',
    milestones: [
      {
        id: 'ms-s1',
        title: 'Substructure & Framing',
        date: 'March 2024',
        description: 'Structural framing finished.',
        status: 'completed',
        percentage: 100,
        images: ['https://xyz.supabase.co/storage/v1/object/public/milestones/prop-2/frame.jpg']
      },
      {
        id: 'ms-s2',
        title: 'Finishing & Handover',
        date: 'December 2024',
        description: 'Occupancy certificate issued.',
        status: 'completed',
        percentage: 100,
        images: ['https://xyz.supabase.co/storage/v1/object/public/milestones/prop-2/handover.jpg']
      }
    ]
  },
  {
    id: 'prop-vista-03',
    name: 'Viridian Vista Boulevard',
    status: 'Upcoming',
    milestones: [
      {
        id: 'ms-v1',
        title: 'Groundbreaking Ceremony',
        date: 'December 2026',
        description: 'Piling equipment mobilization on site.',
        status: 'upcoming',
        percentage: 0,
        imageUrl: 'https://xyz.supabase.co/storage/v1/object/public/milestones/prop-3/ground.jpg'
      }
    ]
  },
  {
    id: 'prop-oasis-04',
    name: 'Viridian Oasis Villa',
    status: 'Upcoming',
    milestones: [] // Empty milestones test case
  }
];

export const createMockNewsletterSubscribers = () => [
  {
    id: 'sub-uuid-001',
    email: 'investor.rahim@example.com',
    status: 'Active',
    subscribed_at: '2026-02-15T10:30:00.000Z'
  },
  {
    id: 'sub-uuid-002',
    email: 'farhana.luxury@dhaka.com',
    status: 'Active',
    subscribed_at: '2026-03-01T14:15:00.000Z'
  },
  {
    id: 'sub-uuid-003',
    email: 'tariq.nrb@london-capital.co.uk',
    status: 'Active',
    subscribed_at: '2026-03-20T09:00:00.000Z'
  },
  {
    id: 'sub-uuid-004',
    email: 'optedout@domain.com',
    status: 'Unsubscribed',
    subscribed_at: '2025-11-10T12:00:00.000Z'
  },
  {
    id: 'sub-uuid-005',
    email: 'bounced.inbox@legacy.net',
    status: 'Bounced',
    subscribed_at: '2025-12-05T08:00:00.000Z'
  }
];

export const createMockUsersDirectory = () => [
  {
    id: 'usr-super-01',
    uid: 'usr-super-01',
    email: 'super.admin@viridiannexus.com',
    display_name: 'Executive Super Admin',
    displayName: 'Executive Super Admin',
    phone: '+8801711999999',
    role: 'super_admin',
    is_banned: false,
    referral_code: 'VN-EXC001',
    created_at: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'usr-super-02',
    uid: 'usr-super-02',
    email: 'co.super@viridiannexus.com',
    display_name: 'Co-Executive Super Admin',
    displayName: 'Co-Executive Super Admin',
    phone: '+8801711888888',
    role: 'super_admin',
    is_banned: false,
    referral_code: 'VN-EXC002',
    created_at: '2025-01-10T00:00:00.000Z'
  },
  {
    id: 'usr-admin-01',
    uid: 'usr-admin-01',
    email: 'admin.operations@viridiannexus.com',
    display_name: 'Operations Admin User',
    displayName: 'Operations Admin User',
    phone: '+8801711777777',
    role: 'admin',
    is_banned: false,
    referral_code: 'VN-ADM001',
    created_at: '2025-02-01T00:00:00.000Z'
  },
  {
    id: 'usr-client-01',
    uid: 'usr-client-01',
    email: 'rahim.chowdhury@example.com',
    display_name: 'Rahim Chowdhury',
    displayName: 'Rahim Chowdhury',
    phone: '+8801711000000',
    role: 'user',
    is_banned: false,
    referral_code: 'VN-RAH001',
    created_at: '2025-03-01T00:00:00.000Z'
  },
  {
    id: 'usr-banned-01',
    uid: 'usr-banned-01',
    email: 'spammer@shady.com',
    display_name: 'Suspicious Bad Actor',
    displayName: 'Suspicious Bad Actor',
    phone: '+8801999999999',
    role: 'user',
    is_banned: true,
    referral_code: 'VN-SPM001',
    created_at: '2025-04-01T00:00:00.000Z'
  }
];

export const createMockSiteSettings = (overrides = {}) => ({
  facebookUrl: 'https://facebook.com/viridiannexus',
  linkedinUrl: 'https://linkedin.com/company/viridiannexus',
  youtubeUrl: 'https://youtube.com/@viridiannexus',
  whatsappNumber: '8801711223344',
  lastUpdatedAt: '2026-03-01T12:00:00.000Z',
  lastUpdatedBy: 'usr-super-01',
  ...overrides
});




