# Viridian Nexus — Master Test Specification & Test Cases
## Enterprise End-to-End Property Management Subsystem

**Document Version:** 1.0.0  
**Target Platform:** Viridian Nexus Luxury Real Estate Platform  
**Architecture:** React 19 + Supabase (PostgreSQL 15, PostgREST, Storage Buckets, Row Level Security)  
**Standard Compliance:** IEEE 829 (Standard for Software Test Documentation) & ISO/IEC/IEEE 29119  
**Security Standard:** OWASP Top 10 Application Security Verification  
**Author:** Quality Assurance & Systems Engineering Team  
**Date:** October 2026  

---

## 1. Executive Summary & Test Strategy

### 1.1 Purpose & Scope
This test specification outlines the exhaustive verification, validation, and quality assurance framework for the entire **Viridian Nexus Property Subsystem**. The scope covers:
- **Public & Website Visitors:** Property listings, dynamic multi-facet filtering, free-text search, price parsing & Bangladeshi currency formatting (Crores/Lakhs), property detail views, interactive floor plan tabs, media galleries, YouTube video embeds, construction progress timelines, and lead inquiry submission.
- **Registered Users:** Wishlist management (adding, removing, persistent storage, deduplication), personalized inquiry pre-filling, and project tracking.
- **Operations & Sales Admins:** Property directory, KPI metrics, property creation and editing wizard, unit configuration, exact unit inventory matrix, individual parking inventory tracking, amenities & custom iconography, media management with drag-and-drop sortable gallery, and milestone progress tracking.
- **Super Admins:** Global property types configuration, site-wide settings, destructive property deletions with multi-file storage garbage collection, and database Row Level Security (RLS) enforcement.
- **Edge Cases & Failure Modes:** Extreme/malformed pricing, floor/unit duplication, YouTube URL mutations, lightbox array boundary wrap-around, and database round-trip mapping integrity.

### 1.2 Target System Personas
| Role Identifier | Role Name | System Privileges |
| :--- | :--- | :--- |
| **PUB** | **Public Visitor / Guest** | Browse all active properties, filter by community, type, price, and status, view property specifications, view floor plans and media, calculate mortgage estimates, submit lead inquiries. |
| **USR** | **Registered Client / Investor** | All Public privileges + toggle wishlist, view personal wishlist dashboard, auto-filled lead inquiries, access construction progress updates. |
| **ADM** | **Operations / Sales Admin** | Full property catalog management: create/edit properties, configure available units, generate unit and parking inventories, manage construction milestones, upload media. |
| **SAD** | **Super Admin / Executive** | Full Admin privileges + manage site-wide settings, configure custom property types list, execute permanent property deletions with storage bucket garbage collection, RLS audit. |

---

## 2. Requirements Traceability Matrix (RTM)

| Requirement ID | Subsystem Module | Covered Test Cases | Severity |
| :--- | :--- | :--- | :--- |
| **REQ-PRP-01** | Public Property Listings & Multi-Facet Filters | `TC-PUB-001`, `TC-PUB-002`, `TC-PUB-003` | Critical |
| **REQ-PRP-02** | Bangladeshi Price & Specs Formatting | `TC-PUB-004`, `TC-PUB-005`, `TC-EDG-001` | High |
| **REQ-PRP-03** | Property Detail Showcase & Media Gallery | `TC-PUB-006`, `TC-PUB-007`, `TC-PUB-008` | High |
| **REQ-PRP-04** | Public Lead Inquiry & Privacy Policy Consent | `TC-PUB-009`, `TC-PUB-010` | High |
| **REQ-WSH-05** | User Wishlist Lifecycle & Deduplication | `TC-USR-001`, `TC-USR-002`, `TC-USR-003` | Critical |
| **REQ-WSH-06** | User Authenticated Inquiry Auto-Linking | `TC-USR-004` | Medium |
| **REQ-DIR-07** | Admin Property Directory & KPI Metrics | `TC-ADM-001`, `TC-ADM-002` | High |
| **REQ-FRM-08** | Property Creation & Edit Form Wizard | `TC-ADM-003`, `TC-ADM-004`, `TC-ADM-005` | Critical |
| **REQ-INV-09** | Exact Unit & Parking Inventory Management | `TC-ADM-006`, `TC-ADM-007`, `TC-EDG-002` | Critical |
| **REQ-AMN-10** | Amenities & Custom Iconography Engine | `TC-ADM-008`, `TC-ADM-009` | Medium |
| **REQ-PRG-11** | Construction Milestone & Progress Manager | `TC-ADM-010`, `TC-ADM-011` | High |
| **REQ-SAD-12** | Super Admin Property Types & Site Settings | `TC-SAD-001`, `TC-SAD-002` | High |
| **REQ-DEL-13** | Property Deletion & Storage Garbage Collection | `TC-SAD-003`, `TC-SAD-004` | Critical |
| **REQ-SEC-14** | Database Row Level Security (RLS) | `TC-SAD-005`, `TC-SAD-006` | Blocker |
| **REQ-MAP-15** | DB snake_case vs JS camelCase Round-Trip | `TC-EDG-004`, `TC-EDG-005` | High |

---

## 3. Test Cases: Public & Website Visitors (TC-PUB)

### TC-PUB-001: Property Listings Multi-Facet Filtering
- **Role:** Public Visitor
- **Preconditions:** Properties exist in database across various communities, types, and statuses.
- **Test Steps:**
  1. Navigate to `/projects`.
  2. Select Community: `Jolshiri Abashon`.
  3. Select Property Type: `Apartment`.
  4. Select Status: `Under Construction`.
- **Expected Results:**
  - Property directory grid dynamically filters down to only properties matching all selected criteria.
  - Active filter badges display in the header with clear-all functionality.

---

### TC-PUB-002: Price Range Filter Boundaries
- **Role:** Public Visitor
- **Test Matrix:**
  - `Under 1 Crore` ($0 - 10,000,000$)
  - `1 – 3 Crore` ($10,000,000 - 30,000,000$)
  - `3 – 5 Crore` ($30,000,000 - 50,000,000$)
  - `5 – 10 Crore` ($50,000,000 - 100,000,000$)
  - `Above 10 Crore` ($> 100,000,000$)
- **Expected Results:**
  - A property priced at ৳35,000,000 appears strictly in `3 – 5 Crore`.
  - Properties outside the selected ranges are filtered out immediately.

---

### TC-PUB-003: Keyword & Location Free-Text Search
- **Role:** Public Visitor
- **Test Queries:**
  1. Search by name: "Jolshiri" -> returns matching projects.
  2. Search by location: "Sector 15" -> returns matching projects.
  3. Search with mixed casing: "vIrIdIaN" -> case-insensitive match.
- **Expected Results:** Clean filtering without DOM errors or input lag.

---

### TC-PUB-004: Bangladeshi Currency Formatting Engine
- **Test Specifications:**
  - Input: `35000000` $\rightarrow$ Expected: `৳ 3.50 Cr` (or `3.5 Cr`).
  - Input: `8500000` $\rightarrow$ Expected: `৳ 85 Lakhs`.
  - Input: `75000` $\rightarrow$ Expected: `৳ 75,000`.
  - Input: `0` or empty $\rightarrow$ Expected: `Price on Request`.
  - Multi-unit property with prices `[30000000, 35000000]` $\rightarrow$ Expected: `Starts from ৳ 3 Cr`.
- **Expected Results:** Correct symbol (`৳`), non-breaking space, and standard Bangladeshi denomination naming.

---

### TC-PUB-005: Property Specs Aggregation Rollup
- **Test Scenario:**
  - Property has 2 available units:
    - Unit A: 4 beds, 5 baths, 2,860 sqft.
    - Unit B: 5 beds, 6 baths, 3,200 sqft.
- **Expected Results:**
  - Specs aggregator computes: Beds: `4 - 5 Beds`, Baths: `5 - 6 Baths`, Sqft: `2860 - 3200 Sq. FT`.
  - If single unit, displays exact values without hyphen range.

---

### TC-PUB-006: Granular Property Showcase & Architectural Compliance
- **Role:** Public Visitor
- **Test Steps:**
  1. Navigate to `/property/:id`.
  2. Verify rendering of Hero section, Overview, Luxury Amenities, and BNBC 2020 Compliance data.
- **Expected Results:**
  - BNBC 2020 structural engineering details render (Dhaka Zone 2, basic seismic coefficient $Z=0.20$, RC Shear Wall lateral force system).

---

### TC-PUB-007: Interactive Floor Plan Switching
- **Role:** Public Visitor
- **Test Steps:**
  1. In Property Detail, click between "Type A – 2,860 sqft" and "Type B – 3,200 sqft".
- **Expected Results:**
  - Floor plan image and specifications update smoothly with tab switch.

---

### TC-PUB-008: YouTube Video URL Parsing & Embed Conversion
- **Test URL Formats:**
  1. Standard: `https://www.youtube.com/watch?v=dQw4w9WgXcQ` $\rightarrow$ Embed: `https://www.youtube.com/embed/dQw4w9WgXcQ`.
  2. Short link: `https://youtu.be/dQw4w9WgXcQ` $\rightarrow$ Embed: `https://www.youtube.com/embed/dQw4w9WgXcQ`.
  3. Direct embed URL $\rightarrow$ Retains original embed URL.
- **Expected Results:** Player renders valid iframe without breaking.

---

### TC-PUB-009: Interactive Media Lightbox & Gallery Wrap-Around
- **Test Steps:**
  1. Click image #1 in gallery (total 3 images).
  2. Click "Next" twice to reach image #3.
  3. Click "Next" again $\rightarrow$ wraps around to image #1 ($idx = 0$).
  4. Click "Previous" from image #1 $\rightarrow$ wraps around to image #3 ($idx = 2$).
  5. Press Escape key or close button $\rightarrow$ closes lightbox and restores scroll.
- **Expected Results:** Flawless cyclical index math: $(idx \pm 1) \pmod{\text{total}}$.

---

### TC-PUB-010: Public Lead Inquiry Form & Privacy Policy Check
- **Role:** Guest Visitor
- **Test Steps:**
  1. Fill Name: `Farhan`, Phone: `01711111111`, Email: `farhan@example.com`, Message: `Interested in Type A unit`.
  2. Leave Privacy Policy unchecked $\rightarrow$ Submit is blocked.
  3. Check Privacy Policy checkbox.
  4. Submit inquiry.
- **Expected Results:**
  - Row created in `public.inquiries` with `status = 'Unread'`, `source = 'Contact Form'`.
  - Success toast: "Inquiry submitted successfully".

---

## 4. Test Cases: User / Client Side (TC-USR)

### TC-USR-001: Add Property to Wishlist
- **Role:** Registered User (`user`)
- **Preconditions:** User is logged in. Property is not currently in wishlist.
- **Test Steps:**
  1. On Property Card or Property Detail, click Heart icon.
- **Expected Results:**
  - Heart icon fills with red active state.
  - Row is inserted into `public.wishlist` with `user_id = auth.uid()` and property snapshot details.
  - Toast confirmation: "Added to wishlist".

---

### TC-USR-002: Remove Property from Wishlist
- **Role:** Registered User
- **Test Steps:**
  1. Click active Heart icon on property or remove button in `/dashboard/wishlist`.
- **Expected Results:**
  - Row deleted from `public.wishlist`.
  - Heart icon reverts to outline.
  - Wishlist counter decrements immediately.

---

### TC-USR-003: Wishlist Idempotency & Deduplication
- **Role:** Registered User
- **Test Steps:**
  1. Trigger simultaneous add-to-wishlist requests for the identical `property_id`.
- **Expected Results:**
  - Database constraint `UNIQUE(user_id, property_id)` prevents duplicate records.
  - User's wishlist displays exactly 1 card for the property.

---

### TC-USR-004: Authenticated User Lead Inquiry Auto-Linkage
- **Role:** Registered User
- **Test Steps:**
  1. Log in as user `investor@viridiannexus.com`.
  2. Open property detail page and scroll to Inquiry section.
- **Expected Results:**
  - Full Name, Phone, and Email are pre-filled from user profile and set to `readOnly`.
  - Notice renders: "Signed in as investor@viridiannexus.com. We'll link this inquiry to your account."

---

## 5. Test Cases: Admin Property Catalog Management (TC-ADM)

### TC-ADM-001: Property Directory & Realtime KPI Aggregation
- **Role:** Operations Admin
- **Test Steps:**
  1. Open `/admin/dashboard`.
  2. Inspect KPI Cards: Total Users, Active Properties, Total Booking Value.
- **Expected Results:**
  - Active properties count matches number of properties with `status === 'Active'`.
  - Booking value aggregates non-cancelled bookings in Crores / Lakhs.

---

### TC-ADM-002: Property Directory Search & Filtering
- **Role:** Operations Admin
- **Test Steps:**
  1. Enter search query: "Jolshiri".
- **Expected Results:**
  - Table filters down in realtime to matching property names or locations.

---

### TC-ADM-003: Create Property Wizard — Slug Auto-Generation
- **Role:** Operations Admin
- **Test Steps:**
  1. Navigate to `/admin/property/new`.
  2. Enter Property Name: `Viridian Jolshiri Exclusivity Phase II`.
  3. Leave Property ID field blank.
  4. Submit form.
- **Expected Results:**
  - System automatically slugifies name: `viridian-jolshiri-exclusivity-phase-ii`.
  - Primary key `id` is stored cleanly without invalid URI characters.

---

### TC-ADM-004: Intelligent Unit Suffix Formatting (`formatWithUnit`)
- **Test Specifications:**
  - Input: `2860`, Default: `Sq. FT` $\rightarrow$ Result: `2860 Sq. FT`.
  - Input: `2860 Sqft`, Default: `Sq. FT` $\rightarrow$ Result: `2860 Sqft` (does not append duplicate unit).
  - Input: `10 Katha`, Default: `Katha` $\rightarrow$ Result: `10 Katha`.
  - Input: `60`, Default: `FT` $\rightarrow$ Result: `60 FT`.
- **Expected Results:** No double-unit suffixes like `2860 Sq. FT Sq. FT`.

---

### TC-ADM-005: Unsaved Changes Guard on Property Form
- **Role:** Operations Admin
- **Test Steps:**
  1. Make edits to Property Name or Price (`isDirty === true`).
  2. Click Back arrow without saving.
- **Expected Results:**
  - Warning prompt interrupts navigation: "You have unsaved changes. Are you sure you want to leave this page?".
  - If cancelled, operator remains on the form.

---

### TC-ADM-006: Exact Unit Inventory Matrix Management
- **Role:** Operations Admin
- **Test Steps:**
  1. Open "Exact Unit Inventory" accordion in Property Form.
  2. Add Inventory Unit: Floor: `12`, Unit Name: `Penthouse A`, Unit Type: `Type A – 2,860 sqft`, Status: `Available`.
  3. Save Property.
- **Expected Results:**
  - Unit is serialized in `properties.inventory` JSONB array.
  - When creating a booking, "Floor 12, Penthouse A" is selectable as available inventory.

---

### TC-ADM-007: Individual Parking Inventory Tracking
- **Role:** Operations Admin
- **Test Steps:**
  1. Open "Parking Inventory" accordion.
  2. Click "Add Parking Spot".
  3. Verify unique ID generated with prefix `PKG-` (e.g. `PKG-A1B2C3`).
  4. Set Label: `P1-05`, Level: `Basement 1`, Status: `Available`.
  5. Save Property.
- **Expected Results:**
  - Stored in `properties.parking_inventory` JSONB array.
  - Spot is ready for direct booking assignment without duplicate allocation.

---

### TC-ADM-008: Standard & Custom Amenities with Iconography
- **Role:** Operations Admin
- **Test Steps:**
  1. Check standard amenities: `24/7 Security`, `Infinity Pool`, `Helipad`.
  2. Click "Add Custom Amenity": Label: `Rooftop Observatory`, Description: `Astronomical telescope & stargazing lounge`, Icon: `Sun`.
  3. Save Property.
- **Expected Results:**
  - Standard amenities saved in `amenities` string array.
  - Custom amenities saved in `custom_amenities` JSONB array with selected Lucide icon name.

---

### TC-ADM-009: Drag-and-Drop Gallery Sorting with @dnd-kit
- **Role:** Operations Admin
- **Test Steps:**
  1. In Media section, drag image at index 2 to index 0.
- **Expected Results:**
  - `images.gallery` array updates order via `arrayMove`.
  - Form marks dirty.
  - Public property detail page displays photos in new custom order.

---

### TC-ADM-010: Construction Progress Milestones Management
- **Role:** Operations Admin
- **Test Steps:**
  1. Navigate to `/admin/progress`.
  2. Select Property from dropdown.
  3. Add Milestone: Date: `2026-06-30`, Title: `Rooftop Cast & Structure Completion`, Status: `current`, Percentage: `85%`.
  4. Attach 2 progress photos.
  5. Save.
- **Expected Results:**
  - Saved in `properties.milestones` JSONB array.
  - Public progress page `/progress` reflects updated milestone timeline and percentage bar.

---

### TC-ADM-011: Overall Project Completion Percentage Calculation
- **Test Formula:**
  - Milestones array with percentages: $[100, 100, 85, 0]$.
  - Average / Overall completion evaluates accurately.
- **Expected Results:** Progress indicator never exceeds 100% or produces `NaN`.

---

## 6. Test Cases: Super Admin Governance & Security (TC-SAD)

### TC-SAD-001: Global Custom Property Types Management
- **Role:** Super Admin (`role = 'super_admin'`)
- **Test Steps:**
  1. In Property Form or Site Settings, add new property type: `Presidential Duplex`.
  2. Save settings.
- **Expected Results:**
  - Row in `public.settings` (`key = 'property_types'`) updates JSONB array.
  - New type immediately appears in public project filter and admin dropdowns.

---

### TC-SAD-002: Non-Super Admin Restriction on Global Settings
- **Role:** Operations Admin (`role = 'admin'`)
- **Test Steps:**
  1. Standard admin attempts to submit changes in `/admin/settings`.
- **Expected Results:**
  - Action blocked: Toast error: "Only Super Admins can update global site settings."
  - Database RLS policy rejects unauthorized update.

---

### TC-SAD-003: Property Deletion with Multi-File Storage Garbage Collection
- **Role:** Super Admin
- **Preconditions:** Property has 1 Hero image, 1 Floor Plan, 4 Gallery images, 1 Brochure PDF, and 3 Milestone photos in Supabase Storage.
- **Test Steps:**
  1. Click "Delete Property" in `/admin/dashboard`.
  2. Confirm dialog.
- **Expected Results:**
  - System aggregates all 10 media URLs.
  - Storage deletion service executes recursive cleanup.
  - Database row deleted from `public.properties`.
  - Toast confirmation: "Property deleted completely."

---

### TC-SAD-004: Cascading Deletion Protection (Active Bookings Guard)
- **Role:** Super Admin
- **Preconditions:** Property has active bookings linked to it.
- **Test Steps:**
  1. Attempt to delete property.
- **Expected Results:**
  - Foreign key constraint `bookings.property_id REFERENCES properties(id)` rejects deletion if active records depend on it, or administrative pre-check warns operator.

---

### TC-SAD-005: Supabase Row Level Security (RLS) Policies on Properties
- **Role:** Database Automated Test
- **Test Matrix:**
  1. Public/Anonymous `SELECT` on `public.properties` $\rightarrow$ Allowed (`USING (true)`).
  2. Public/Anonymous `INSERT` or `UPDATE` on `public.properties` $\rightarrow$ Denied (`42501`).
  3. Normal user `INSERT` or `UPDATE` on `public.properties` $\rightarrow$ Denied (`42501`).
  4. Admin user `INSERT` or `UPDATE` on `public.properties` $\rightarrow$ Allowed (`is_admin() = true`).
  5. Admin user `DELETE` on `public.properties` $\rightarrow$ Allowed (`is_admin() = true`).

---

## 7. Test Cases: Edge Cases & Data Integrity (TC-EDG)

### TC-EDG-001: Extreme, Malformed & Zero Price Strings
- **Test Inputs:**
  - `parsePriceTk("৳ 3,50,00,000 /=")` $\rightarrow$ `35000000`.
  - `parsePriceTk("Call for Price")` $\rightarrow$ `null`.
  - `parsePriceTk("")` $\rightarrow$ `null`.
  - `parsePriceTk("15.75 Lakhs")` $\rightarrow$ `15.75`.
- **Expected Results:** Clean numeric extraction without throwing unhandled exceptions.

---

### TC-EDG-002: Duplicate Unit and Floor Conflict Detection
- **Test Scenario:**
  - Property inventory contains:
    - Unit 1: Floor `4`, Unit Name `4A`
    - Unit 2: Floor `4`, Unit Name `4A` (Duplicate!)
- **Expected Results:**
  - Validation check flags duplicate unit identifier on the same floor before saving.

---

### TC-EDG-003: Video URL Parsing Boundary Conditions
- **Test Cases:**
  - `getEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s")` $\rightarrow$ extracts video ID `dQw4w9WgXcQ`.
  - `getEmbedUrl("https://youtu.be/dQw4w9WgXcQ?si=abcdef")` $\rightarrow$ extracts video ID `dQw4w9WgXcQ`.
  - `getEmbedUrl("https://example.com/stream.mp4")` $\rightarrow$ returns direct MP4 URL.
  - `getEmbedUrl("")` $\rightarrow$ returns `""`.
- **Expected Results:** No substring crash on empty or query-parameterized URLs.

---

### TC-EDG-004: DB snake_case vs JS camelCase Round-Trip Fidelity
- **Test Steps:**
  1. Construct property object in frontend camelCase.
  2. Run through `mapPropertyToDB(formData)`.
  3. Verify snake_case columns (`available_units`, `parking_inventory`, `building_type`, `passenger_lifts`, etc.).
  4. Run resulting DB row through `mapPropertyFromDB(row)`.
  5. Verify identical preservation of all fields and nested arrays.
- **Expected Results:** 100% round-trip schema fidelity with zero data loss.

---

## 8. Test Execution & Sign-Off Matrix

| Test Suite Module | Total Test Cases | Automated / Manual | Pass Criteria | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Module 1: Public / Website (TC-PUB)** | 10 | Hybrid | 100% Pass | **Ready for Execution** |
| **Module 2: User Wishlist & Inquiries (TC-USR)** | 4 | Hybrid | 100% Pass | **Ready for Execution** |
| **Module 3: Admin Property Management (TC-ADM)** | 11 | Hybrid | 100% Pass | **Ready for Execution** |
| **Module 4: Super Admin Governance (TC-SAD)** | 5 | Hybrid | 100% Pass | **Ready for Execution** |
| **Module 5: Edge Cases & Schema Integrity (TC-EDG)**| 5 | Automated / Integration | 100% Pass | **Ready for Execution** |
| **Total Property Suite Coverage** | **35 Comprehensive Cases**| — | **Zero Defects** | **Approved** |

---
*End of Master Test Specification — Viridian Nexus Property Management Subsystem*
