# Viridian Nexus — Master Test Specification & Test Cases
## Enterprise End-to-End Booking Management System

**Document Version:** 1.0.0  
**Target Platform:** Viridian Nexus Luxury Real Estate Platform  
**Architecture:** React 19 + Supabase (PostgreSQL 15, PostgREST, Realtime WebSockets, Row Level Security)  
**Standard Compliance:** IEEE 829 (Standard for Software Test Documentation) & ISO/IEC/IEEE 29119  
**Security Standard:** OWASP Top 10 Application Security Verification  
**Author:** Quality Assurance & Systems Engineering Team  
**Date:** October 2026  

---

## 1. Executive Summary & Test Strategy

### 1.1 Purpose & Scope
This test specification outlines the exhaustive verification, validation, and quality assurance framework for the entire **Viridian Nexus Booking System**. The scope covers all user workflows, administrative operations, executive super-admin governance controls, financial ledger integrity, inventory lifecycle state machines, and high-concurrency edge cases.

### 1.2 Target System Personas
| Role Identifier | Role Name | System Privileges |
| :--- | :--- | :--- |
| **USR** | **Client / User / Investor** | Read own bookings & payments, submit Expressions of Interest (EOI), update personal profile. Restricted by Row Level Security (RLS). |
| **ADM** | **Operations / Sales / Finance Admin** | Full operational control: convert requests, create direct bookings, record payments, manage parking inventory, reassign units, advance/rollback stage gates, change lifecycle statuses. |
| **SAD** | **Super Admin / Executive Compliance** | Full system control + Executive Stage Gate Overrides, user role promotion/demotion, financial waivers, audit trail verification, administrative bypass permissions. |

### 1.3 System Milestone Lifecycle State Machine
The Viridian Nexus booking progression strictly implements an 8-stage gatekeeper state machine:
```
[1. EOI] ──► [2. Token Paid] ──► [3. Agreement Signed] ──► [4. Down Payment Paid]
                                                                    │
[8. Completed] ◄── [7. Handover] ◄── [6. Fully Paid] ◄── [5. Installments Running]
```
- **Lifecycle Statuses:** `Active`, `On Hold`, `Completed`, `Cancelled`.

---

## 2. Requirements Traceability Matrix (RTM)

| Requirement ID | Subsystem Module | Covered Test Cases | Severity |
| :--- | :--- | :--- | :--- |
| **REQ-EOI-01** | Public Expression of Interest | `TC-USR-001`, `TC-USR-002`, `TC-USR-003` | Critical |
| **REQ-USR-02** | User Dashboard & Financial Summary | `TC-USR-004`, `TC-USR-005`, `TC-USR-008` | High |
| **REQ-USR-03** | User Realtime Ledger & Overdue Status | `TC-USR-006`, `TC-USR-007` | High |
| **REQ-SEC-04** | Data Privacy & RLS Isolation | `TC-USR-009`, `TC-SAD-005`, `TC-SAD-006` | Blocker |
| **REQ-PRF-05** | Profile Synchronization & Drift Detection | `TC-USR-010`, `TC-ADM-013` | Medium |
| **REQ-REQ-06** | Admin Booking Requests Management | `TC-ADM-001`, `TC-ADM-002`, `TC-ADM-003` | High |
| **REQ-BKG-07** | Direct Booking Creation Wizard | `TC-ADM-004`, `TC-ADM-005`, `TC-ADM-006` | Critical |
| **REQ-FIN-08** | Multi-Frequency Installment Scheduling | `TC-ADM-007`, `TC-ADM-008`, `TC-EDG-005` | Critical |
| **REQ-INV-09** | Unit & Parking Inventory Lock/Release | `TC-ADM-009`, `TC-ADM-015`, `TC-ADM-016`, `TC-EDG-001` | Critical |
| **REQ-PRK-10** | Mid-Booking Parking Lifecycle (Add/Swap/Release) | `TC-ADM-017`, `TC-ADM-018`, `TC-ADM-019`, `TC-EDG-002` | High |
| **REQ-PAY-11** | Payment Ledger & Auto Stage Transitions | `TC-ADM-020`, `TC-ADM-021`, `TC-ADM-022`, `TC-EDG-003` | Critical |
| **REQ-GAT-12** | Milestone Stage Gate Validation & Rollback | `TC-ADM-024`, `TC-ADM-025` | Critical |
| **REQ-OVR-13** | Super Admin Executive Stage Override | `TC-SAD-001`, `TC-SAD-002`, `TC-SAD-003` | Blocker |
| **REQ-AUD-14** | Immutable Activity & Audit Logging | `TC-ADM-028`, `TC-SAD-003` | High |

---

## 3. Test Cases: User / Client Side (TC-USR)

### TC-USR-001: Public Expression of Interest (EOI) Submission (Guest / Unauthenticated)
- **Role:** Unauthenticated Guest User
- **Preconditions:** Project properties with available units exist in the database.
- **Test Steps:**
  1. Navigate to `/booking` while logged out.
  2. Select Property from dropdown (e.g. "Viridian Jolshiri Exclusivity").
  3. Select Unit configuration (e.g. "Type A – 2,860 sqft").
  4. Click "Next Step".
  5. Enter First Name: `Rahim`, Last Name: `Chowdhury`.
  6. Enter Email: `rahim.chowdhury@example.com`, Phone: `+8801711000000`.
  7. Enter NID: `19852691234567890`, Address: `Road 12, Banani, Dhaka`.
  8. Set Parking Requested: `2`.
  9. Click "Submit Booking Request".
- **Expected Results:**
  - Loader displays during submission.
  - Success screen renders displaying a unique 8-character uppercase Booking Reference (e.g., `#A1B2C3D4`).
  - Row is inserted into `public.booking_requests` with `status = 'Pending Review'`, `linked_user_id = NULL`, and formatted message containing NID, Address, and Parking requested.
  - Toast confirmation: "Booking Submitted!".

---

### TC-USR-002: Public EOI Submission by Authenticated User with Account Linkage
- **Role:** Registered User (Role: `user`)
- **Preconditions:** User is logged in with profile (`id = 'usr-uuid-101'`, `email = 'investor@viridian.com'`).
- **Test Steps:**
  1. Navigate to `/booking`.
  2. Verify Step 2 auto-populates First Name, Last Name, Email, and Phone from `userProfile`.
  3. Complete required fields (NID & Address).
  4. Submit request.
- **Expected Results:**
  - Row inserted in `booking_requests` contains `linked_user_id = 'usr-uuid-101'`.
  - Admin booking requests dashboard shows active linked user badge.

---

### TC-USR-003: EOI Form Validation & Boundary Edge Cases
- **Role:** Any User
- **Test Steps & Data:**
  1. **Invalid Email:** Enter `invalid-email-format` -> Error: `Valid email required`.
  2. **Short Phone Number:** Enter `12345` (<10 chars) -> Error: `Valid phone required`.
  3. **Empty Mandatory Fields:** Leave First Name, Last Name, or NID blank -> Respective `Required` errors trigger.
  4. **Property Not Selected:** Bypass step without project -> Toast error: `Please select a project.`
- **Expected Results:** Form prevents advancement to Step 3 until all validation constraints are satisfied.

---

### TC-USR-004: User Dashboard Overview — Active Bookings Rendering
- **Role:** Registered User
- **Preconditions:** User has 1 active booking (`VN-2026-0042`) and 1 completed booking (`VN-2025-0012`).
- **Test Steps:**
  1. Navigate to `/dashboard`.
  2. Observe "Active Bookings" section.
- **Expected Results:**
  - Renders booking card showing Property Name, Unit Type, Unit Number, and Booking Ref.
  - Stage indicator badge correctly reflects current milestone (e.g. `Installments Running`).
  - "View Booking Details" button routes cleanly to `/dashboard/bookings/:bookingId`.

---

### TC-USR-005: User Booking Detail — 8-Stage Progress Stepper Visualization
- **Role:** Registered User
- **Preconditions:** Booking is at stage `Down Payment Paid` (Stage index 3 of 7).
- **Test Steps:**
  1. Open `/dashboard/bookings/:bookingId`.
  2. Inspect the Progress Stepper component.
- **Expected Results:**
  - Stages 0 to 3 (`EOI`, `Token Paid`, `Agreement Signed`, `Down Payment Paid`) render with green brand background and checkmark icons.
  - Stage 3 has active focus ring (`ring-4 ring-brand-primary/20`).
  - Stages 4 to 7 (`Installments Running`, `Fully Paid`, `Handover`, `Completed`) render in gray disabled state.
  - On mobile viewports (<768px), non-essential intermediate steps fold gracefully to prevent layout breakage.

---

### TC-USR-006: User Booking Detail — Payment History Ledger & Overdue Status
- **Role:** Registered User
- **Preconditions:** Ledger has 3 payments:
  - Installment #1: `due_date: 2026-01-15`, `status: 'Paid'`, `paid_date: 2026-01-14`.
  - Installment #2: `due_date: 2026-02-15` (past date), `status: 'Scheduled'`.
  - Installment #3: `due_date: 2026-12-15` (future date), `status: 'Scheduled'`.
- **Test Steps:**
  1. Navigate to Payment History table on booking detail page.
- **Expected Results:**
  - Installment #1 renders badge: `Paid` (green) with paid date `14 Jan 2026`.
  - Installment #2 detects overdue state (`due_date < current_date` & `status === 'Scheduled'`) and dynamically renders badge: `Overdue` (red).
  - Installment #3 renders badge: `Scheduled` (neutral gray) with future due date.
  - Monetary values format accurately in Bangladeshi Taka (`৳ 25,00,000`).

---

### TC-USR-007: Realtime WebSocket Synchronization of Financial Ledger
- **Role:** Registered User (Client) and Admin
- **Preconditions:** Client is actively viewing `/dashboard/bookings/:bookingId`.
- **Test Steps:**
  1. In a separate admin window, Admin records payment for Installment #2.
  2. Keep Client browser window untouched.
- **Expected Results:**
  - Within <1000ms, client table row for Installment #2 updates from `Overdue` to `Paid` via Supabase Realtime channel without full page reload.
  - Financial Summary Card updates: "Total Paid" increases, "Balance Due" decreases, and "Payment Progress" percentage bar increments smoothly.

---

### TC-USR-008: User Financial Summary Card Precision
- **Role:** Registered User
- **Test Steps:**
  - Verify formulas:
    - $\text{Balance Due} = \text{Total Agreed Price} - \text{Total Paid}$
    - $\text{Completion Percentage} = \min(100, \text{round}((\text{Total Paid} / \text{Total Agreed Price}) \times 100))$
- **Expected Results:**
  - For Agreed Price ৳3,50,00,000 and Total Paid ৳70,00,000, Progress bar displays exactly `20%`.
  - If Total Paid is 0, progress bar displays `0%` without `NaN` or layout overflow.

---

### TC-USR-009: Security & Authorization Boundary (Cross-Tenant Access Prevention)
- **Role:** User A (`user-uuid-aaa`)
- **Preconditions:** Booking #999 has `linked_user_id = 'user-uuid-bbb'`.
- **Test Steps:**
  1. User A attempts to navigate directly to `/dashboard/bookings/999`.
- **Expected Results:**
  - Component code checks `bookingData.linked_user_id !== userProfile.uid`.
  - Client is instantly ejected and redirected to `/dashboard`.
  - Supabase RLS policy `bookings_select` rejects unauthorized database select query at the database tier.

---

### TC-USR-010: Client Profile Update & Drift Banner Trigger
- **Role:** Registered User
- **Test Steps:**
  1. User navigates to `/dashboard` -> Edit Profile modal.
  2. Updates phone number from `+8801700000000` to `+8801999999999` and updates address.
  3. Saves profile.
- **Expected Results:**
  - `public.profiles` updates successfully.
  - Linked active bookings retain historical snapshot until admin reviews drift.

---

## 4. Test Cases: Admin Operations & Sales Side (TC-ADM)

### TC-ADM-001: Booking Requests Queue — Search, Filter & View
- **Role:** Operations Admin (`admin`)
- **Preconditions:** 5 pending expressions of interest exist across different properties.
- **Test Steps:**
  1. Navigate to `/admin/booking-requests`.
  2. Enter search query "Rahim" in the search box.
- **Expected Results:**
  - Table instantly filters down to matching client names, emails, or project names.
  - Client contact info, property name, unit type, parking request count, and date render correctly.

---

### TC-ADM-002: Booking Request Rejection with Mandatory Reason & User Notification
- **Role:** Operations Admin
- **Test Steps:**
  1. In Booking Requests, click "Reject" button (X icon) on Request #101.
  2. Click "Reject" without providing a reason.
  3. Observe rejection error toast: `Please provide a reason for rejection`.
  4. Enter reason: `Client selected unit is withdrawn by management.`
  5. Click "Reject".
- **Expected Results:**
  - Request status updates to `Rejected` with `reject_reason` and `rejected_at` logged.
  - If request had `linked_user_id`, a record is inserted into `public.notifications` notifying the client.
  - Toast confirmation: `Request rejected`.

---

### TC-ADM-003: Booking Request Conversion Flow
- **Role:** Operations Admin
- **Test Steps:**
  1. Click "Convert to Booking" (CheckCircle icon) on pending request.
- **Expected Results:**
  - Operator is routed to `/admin/bookings` to open the booking creation wizard with context preserved.

---

### TC-ADM-004: Direct Booking Creation — Step 1: Unit Inventory Selection & Availability Lock
- **Role:** Operations Admin
- **Test Steps:**
  1. Navigate to `/admin/bookings`, click "New Booking".
  2. Select Property: `Viridian Jolshiri Exclusivity`.
  3. Select Unit: Unit 4A (Current Status: `Available`).
  4. Select Parking Spots: `P1-04` and `P1-05` (Status: `Available`).
  5. Click "Next".
- **Expected Results:**
  - Base price for Unit 4A is loaded.
  - Pricing dynamically recalculates: $\text{Base Unit Price} + (\text{Parking Price per Spot} \times 2)$.
  - Wizard moves to Step 2 without inventory conflicts.

---

### TC-ADM-005: Direct Booking Creation — Step 2: Mandatory Client Account Linkage
- **Role:** Operations Admin
- **Test Steps:**
  1. Attempt to proceed to Step 3 without linking an account.
  2. Observe validation error toast: `Linking a user account is mandatory.`
  3. In Link User Account box, search email: `buyer@domain.com`.
  4. Click search icon.
  5. Click "Link Account".
- **Expected Results:**
  - User profile is retrieved and verified.
  - Form fields (Client Name, Email, Phone, NID Type, NID, Address) auto-populate with user details.
  - Wizard permits advancing to Step 3.

---

### TC-ADM-006: Direct Booking Creation — Step 3: Commercials & Pricing Adjustments
- **Role:** Operations Admin
- **Test Steps:**
  1. Base price is ৳30,000,000. Parking price is ৳1,000,000.
  2. Enter Pricing Adjustment: `-500000` (Discount).
  3. Enter Token Amount: `500000`.
  4. Enter Down Payment Amount: `4500000`.
- **Expected Results:**
  - Dynamic Total Price updates to: $30,000,000 + 1,000,000 - 500,000 = ৳30,500,000$.
  - Down payment and token calculations are validated: Token cannot exceed total price.

---

### TC-ADM-007: Direct Booking Creation — Multi-Frequency Installment Generator
- **Role:** Operations Admin
- **Test Steps & Data:**
  - Total Price: ৳30,500,000
  - Token: ৳500,000, Down Payment: ৳4,000,000 $\rightarrow$ Remaining Balance for Installments: ৳26,000,000.
  - Installment Count: `12`
  - Start Date: `2026-04-01`
  - Test Frequencies:
    - **Monthly:** Due dates increment by 1 month (`2026-04-01`, `2026-05-01`, ...).
    - **Quarterly:** Due dates increment by 3 months (`2026-04-01`, `2026-07-01`, ...).
    - **Semi-Annual:** Due dates increment by 6 months.
    - **Annual:** Due dates increment by 12 months.
- **Expected Results:**
  - All installments are generated with correct dates and amounts.

---

### TC-ADM-008: Direct Booking Creation — Remainder Penny/Rounding Allocation
- **Role:** Operations Admin
- **Test Scenario:**
  - Remaining Amount: ৳10,000,000
  - Installment Count: `3`
  - Division: $10,000,000 / 3 = 3333333.3333...$
- **Expected Results:**
  - Installments #1 and #2 are generated as rounded increments: `৳3,333,330` each.
  - Final Installment #3 absorbs the exact remainder:
    $$\text{Final Installment} = 10,000,000 - (3,333,330 \times 2) = ৳3,333,340$$
  - Sum of all installments $+$ Token $+$ Down Payment strictly equals `total_price` ($10,000,000$ exactly).

---

### TC-ADM-009: Direct Booking Creation — Atomic Persistence & Inventory State Mutation
- **Role:** Operations Admin
- **Test Steps:**
  1. Complete Review Step and click "Create Booking & Issue Agreement".
- **Expected Results:**
  - `public.bookings` row is created with unique reference `VN-2026-XXXX`, `stage = 'EOI'`, `status = 'Active'`.
  - Property inventory in `public.properties` is updated: Selected unit status changes from `Available` to `Booked`.
  - Parking inventory in `public.properties` is updated: Selected spots change from `Available` to `Assigned`, stamped with `assignedBookingId = newBookingId`.
  - Scheduled payments are created in `public.booking_payments`: Token payment (due today), Down payment (due in 14 days), and all scheduled installments.
  - Activity log entry is created in `public.booking_activity_log` with `type = 'Booking created'`.
  - Session storage cached form data is cleared.

---

### TC-ADM-010: Admin Bookings Dashboard — KPI Metrics Verification
- **Role:** Operations Admin
- **Preconditions:** Database has 10 total bookings (6 Active, 2 Completed, 2 Cancelled). Sum of all `total_paid` is ৳85,000,000.
- **Test Steps:**
  1. Navigate to `/admin/bookings`.
  2. Inspect top KPI metric cards.
- **Expected Results:**
  - "Total Bookings": `10`
  - "Active": `6`
  - "Completed": `2`
  - "Cancelled": `2`
  - "Value Collected": `৳ 8,50,00,000`

---

### TC-ADM-011: Admin Bookings Dashboard — Multi-Attribute Search Filter
- **Role:** Operations Admin
- **Test Queries:**
  1. Search by Client Name: `Rahim` -> Matches rows.
  2. Search by Booking Ref: `VN-2026-0042` -> Matches single row.
  3. Search by Phone: `01711` -> Matches row.
  4. Search by Unit Number: `Floor 4` -> Matches row.
  5. Search by Linked User UUID: `usr-uuid-101` -> Matches row.
- **Expected Results:** Filter handles whitespace trimming and case-insensitive matching without throwing exceptions.

---

### TC-ADM-012: Admin Bookings Dashboard — Stage & Status Filter Matrix
- **Role:** Operations Admin
- **Test Steps:**
  1. Set Stage Filter to `Agreement Signed`.
  2. Set Status Filter to `Active`.
- **Expected Results:**
  - Table only renders bookings meeting both criteria.
  - Collapsible property groups display headers with correct count badge per project.

---

### TC-ADM-013: Admin Booking Detail — Client Profile Synchronization Banner
- **Role:** Operations Admin
- **Preconditions:** Linked user changed their phone number in their profile, creating a drift with `booking.client_phone`.
- **Test Steps:**
  1. Open `/admin/bookings/:bookingId`.
  2. Observe amber alert banner: "User Profile Has Updated".
  3. Check diff display: shows current booking phone strikethrough $\rightarrow$ new profile phone.
  4. Click "Sync Profile".
- **Expected Results:**
  - `bookings` row updates client details to match user profile.
  - Activity log creates entry: `Client Details Synced`.
  - Amber banner immediately dismisses.

---

### TC-ADM-014: Admin Booking Detail — Manual Client Information Modification
- **Role:** Operations Admin
- **Test Steps:**
  1. Click "Edit Details" in Client Details card.
  2. Update Client Address to: `House 45, Gulshan 2, Dhaka`.
  3. Save changes.
- **Expected Results:**
  - Details update immediately in UI and database.
  - Activity log captures: `Client information was updated by Admin`.

---

### TC-ADM-015: Unit Reassignment — Same Property
- **Role:** Operations Admin
- **Preconditions:** Client booked Unit 4A. Unit 5A is currently `Available`.
- **Test Steps:**
  1. In Booking Detail, click "Reassign Unit".
  2. Select Unit 5A.
  3. Review confirmation dialog detailing old unit release and new unit lock.
  4. Confirm reassignment.
- **Expected Results:**
  - Old Unit 4A status reverts to `Available`.
  - New Unit 5A status becomes `Booked`.
  - Booking document updates `unit_number` and `inventory_id`.
  - Activity log entry records unit transfer with previous and new unit details.

---

### TC-ADM-016: Unit Reassignment — Across Properties
- **Role:** Operations Admin
- **Preconditions:** Client wants to switch from "Jolshiri Project A" to "Jolshiri Project B".
- **Test Steps:**
  1. Click "Reassign Unit".
  2. Select Property B and available Unit 2B.
  3. Confirm transfer.
- **Expected Results:**
  - Property A inventory releases old unit.
  - Property B inventory locks Unit 2B.
  - Booking document updates `property_id`, `property_name`, `property_location`, `inventory_id`, and `unit_number`.

---

### TC-ADM-017: Mid-Booking Parking Allocation (Add Parking Spot)
- **Role:** Operations Admin
- **Test Steps:**
  1. In Booking Detail, click "🚗 Add Parking".
  2. Select available spot `P2-10` (Price: ৳500,000).
  3. Option A: Select "Generate scheduled payment" (Due date: 7 days).
  4. Confirm.
- **Expected Results:**
  - Spot `P2-10` status changes to `Assigned` with `assignedBookingId`.
  - Booking `parking_spot_ids` array appends spot ID.
  - Booking `total_price` increases by ৳500,000; `balance_due` increases by ৳500,000.
  - New invoice row inserted in `booking_payments` for ৳500,000.
  - Activity log records: `Added parking spot P2-10`.

---

### TC-ADM-018: Mid-Booking Parking Release (Deallocation & Credit Note)
- **Role:** Operations Admin
- **Preconditions:** Booking has parking spot `P2-10` assigned.
- **Test Steps:**
  1. Click "🚗 Release Parking".
  2. Select spot `P2-10`.
  3. Choose "Issue Credit Note / Price Reduction (৳500,000)".
  4. Enter reason: `Client surrendered spot`.
  5. Confirm release.
- **Expected Results:**
  - Spot `P2-10` status reverts to `Available` in property parking inventory.
  - Booking `total_price` and `balance_due` decrease by ৳500,000.
  - Activity log records release with credit adjustment details.

---

### TC-ADM-019: Mid-Booking Parking Swap (Zero Financial Impact)
- **Role:** Operations Admin
- **Preconditions:** Booking has spot `P1-02`. Spot `P1-08` is `Available`.
- **Test Steps:**
  1. Click "🔄 Swap Parking".
  2. Select current spot `P1-02` and replacement spot `P1-08`.
  3. Confirm swap.
- **Expected Results:**
  - Spot `P1-02` returns to `Available`.
  - Spot `P1-08` becomes `Assigned`.
  - Booking total price, paid amount, and balance due remain completely unchanged.
  - Activity log records: `Swapped parking spot P1-02 with P1-08`.

---

### TC-ADM-020: Payment Ledger — Record Full Payment
- **Role:** Finance / Operations Admin
- **Preconditions:** Scheduled installment #1 of ৳1,000,000 exists with status `Scheduled`.
- **Test Steps:**
  1. Click "Record Payment" on Installment #1.
  2. Enter Amount: `1000000`.
  3. Select Mode: `Bank Transfer`.
  4. Enter Ref: `TXN-EBL-884920`.
  5. Enter Note: `Cleared via Eastern Bank Ltd`.
  6. Confirm payment.
- **Expected Results:**
  - Installment #1 status becomes `Paid`.
  - `received_amount` = `1000000`, `paid_date` = today.
  - Notes field persists reference: `Ref: TXN-EBL-884920 | Cleared via Eastern Bank Ltd`.
  - Booking `total_paid` increments by ৳1,000,000; `balance_due` decrements by ৳1,000,000.
  - Activity log logs payment.

---

### TC-ADM-021: Payment Ledger — Record Partial Payment
- **Role:** Finance / Operations Admin
- **Preconditions:** Scheduled installment #2 of ৳2,000,000 exists.
- **Test Steps:**
  1. Record payment of `1200000` (less than scheduled amount).
- **Expected Results:**
  - Installment #2 status updates to `Partially Paid`.
  - `received_amount` records `1200000`.
  - Booking `total_paid` increments by ৳1,200,000.
  - Remaining scheduled dues continue to reflect accurately.

---

### TC-ADM-022: Payment Ledger — Auto Stage Transition Trigger
- **Role:** Operations Admin
- **Preconditions:** Booking is at stage `EOI`. Token payment is scheduled for ৳500,000.
- **Test Steps:**
  1. Record full payment of ৳500,000 for Token payment.
- **Expected Results:**
  - Token payment becomes `Paid`.
  - Booking stage automatically transitions from `EOI` $\rightarrow$ `Token Paid`.
  - Activity log documents both payment receipt and stage transition.

---

### TC-ADM-023: Custom Payment Addition (Ad-Hoc Utility / Penalty Fee)
- **Role:** Operations Admin
- **Test Steps:**
  1. In Payment Ledger, click "+ Add Custom Payment".
  2. Payment Type: `Solar System Upgrade & Utility Connection`.
  3. Amount: `250000`.
  4. Due Date: `2026-08-01`.
  5. Submit.
- **Expected Results:**
  - New row in `booking_payments` scheduled for ৳250,000.
  - Booking `total_price` increases by ৳250,000; `balance_due` increases by ৳250,000.
  - Activity log notes addition.

---

### TC-ADM-024: Stage Gate Validation & Enforcement Rules
- **Role:** Operations Admin
- **Test Matrix Across All Stages:**
| Target Stage | Prerequisite Gates Checked | Expected Behavior if Unmet |
| :--- | :--- | :--- |
| **Token Paid** | Token payment cleared in ledger. | Action blocked; displays payment action button. |
| **Agreement Signed** | Token deposit cleared. | Action blocked; requires token clearance. |
| **Down Payment Paid** | Down payment marked `Paid` in ledger. | Action blocked; shows pending DP balance. |
| **Installments Running**| Down Payment settled & active installment schedule exists. | Action blocked until DP cleared. |
| **Fully Paid** | Balance Due $\le 0$ & all ledger payments marked `Paid` or `Waived`. | Action blocked; shows remaining outstanding balance. |
| **Handover** | Zero Balance Due & Agreement executed. | Action blocked; prohibits handover with outstanding debt. |
| **Completed** | Physical Handover completed & 100% financial clearance. | Action blocked until handover date recorded. |

---

### TC-ADM-025: Backward Stage Rollback
- **Role:** Operations Admin
- **Preconditions:** Booking is at `Down Payment Paid`.
- **Test Steps:**
  1. Open Stage Advance modal.
  2. Select earlier stage `Agreement Signed`.
- **Expected Results:**
  - Warning banner displays: `Stage Rollback Warning: Reverting stage from Down Payment Paid back to Agreement Signed. Previous milestone data will remain in the activity log.`
  - Advance button permits rollback without requiring executive override.
  - On confirm, booking stage updates to `Agreement Signed`.
  - Activity log records: `Stage reverted from "Down Payment Paid" to "Agreement Signed" by Admin`.

---

### TC-ADM-026: Booking Lifecycle Status Toggle (On Hold & Resume)
- **Role:** Operations Admin
- **Test Steps:**
  1. Click "Put on Hold".
  2. Confirmation dialog prompts operator.
  3. Confirm.
  4. Observe booking status badge updates to `On Hold` (amber).
  5. Click "Resume Booking" and confirm.
- **Expected Results:**
  - Booking status toggles between `Active` and `On Hold`.
  - Activity log documents each status mutation.

---

### TC-ADM-027: Booking Cancellation & Automatic Inventory Release
- **Role:** Operations Admin
- **Preconditions:** Booking is active with Unit 4A and Parking spot `P1-04`.
- **Test Steps:**
  1. Click "Cancel Booking".
  2. Attempt to submit with empty cancellation reason $\rightarrow$ Blocked.
  3. Enter reason: `Client relocated abroad; mutual termination agreement executed.`
  4. Confirm cancellation.
- **Expected Results:**
  - Booking `status` changes to `Cancelled`.
  - Unit 4A status reverts from `Booked` $\rightarrow$ `Available`.
  - Parking spot `P1-04` reverts from `Assigned` $\rightarrow$ `Available`, `assignedBookingId` is wiped.
  - Cancellation reason is safely stored in `internal_notes` and JSONB `metadata` in `booking_activity_log`.
  - Prominent red cancellation banner renders on the booking detail page.

---

### TC-ADM-028: Realtime Audit Logging Verification
- **Role:** Operations Admin
- **Test Steps:**
  1. Execute any operational action (payment, stage change, client edit).
  2. Observe the "Activity Log" timeline at the bottom of Booking Detail.
- **Expected Results:**
  - Event appears immediately at top of list with actor name, timestamp, action title, description, and metadata.

---

## 5. Test Cases: Super Admin Governance & Security (TC-SAD)

### TC-SAD-001: Stage Gate Executive Override (Successful Bypass)
- **Role:** Super Admin (`role = 'super_admin'`)
- **Preconditions:** Client has an outstanding balance of ৳5,000,000 (prerequisites for `Handover` are NOT met).
- **Test Steps:**
  1. Log in as Super Admin.
  2. Open Stage Advance modal on the booking and select `Handover`.
  3. Prerequisites evaluation shows unmet requirements (red X icons).
  4. Check checkbox: `Authorize Super Admin Override`.
  5. Enter Justification: `Executive Board Approval #EB-2026-99 under corporate bank guarantee.` (>= 8 characters).
  6. Click "Update Booking Stage".
- **Expected Results:**
  - Stage successfully updates to `Handover`.
  - Toast: `Stage updated with Super Admin override`.
  - Activity log records entry with `type = 'Stage Override (Super Admin)'` and metadata containing `isOverride: true` and the exact justification.

---

### TC-SAD-002: Stage Gate Executive Override (Validation Rejections)
- **Role:** Operations Admin (`role = 'admin'`) vs Super Admin (`role = 'super_admin'`)
- **Test Scenarios:**
  1. **Regular Admin Attempt:** Log in as standard admin $\rightarrow$ Override checkbox and input fields do NOT render; submit button is completely disabled.
  2. **Short Justification:** Super Admin enters justification `< 8` chars (e.g. `urgent`) $\rightarrow$ Submit button remains disabled.
- **Expected Results:** Strict role-based enforcement prevents unauthorized or unsubstantiated gate bypasses.

---

### TC-SAD-003: Super Admin Audit Log Integrity & Immutability
- **Role:** Super Admin / Auditor
- **Test Steps:**
  1. Inspect `booking_activity_log` rows via Supabase Studio or API for override events.
- **Expected Results:**
  - Row contains `actor_id`, `actor_name`, `created_at`, `type = 'Stage Override (Super Admin)'`.
  - Metadata column stores:
    ```json
    {
      "isOverride": true,
      "previousStage": "Installments Running",
      "targetStage": "Handover",
      "overrideReason": "Executive Board Approval #EB-2026-99 under corporate bank guarantee."
    }
    ```

---

### TC-SAD-004: User Management & Privilege Escalation Testing
- **Role:** Super Admin
- **Test Steps:**
  1. Navigate to `/admin/users`.
  2. Change user `test@domain.com` role from `user` $\rightarrow$ `admin`.
  3. Verify user gains access to `/admin/bookings`.
  4. Demote back to `user` $\rightarrow$ Verify user is immediately locked out of `/admin/*` routes.

---

### TC-SAD-005: Supabase Row Level Security (RLS) Policy Verification
- **Role:** Database Automated Test
- **Test Steps:**
  1. Query `public.bookings` using the JWT of a normal client (`role = 'user'`).
- **Expected Results:**
  - Query only returns records where `linked_user_id = auth.uid()`.
  - Attempting to query `public.booking_activity_log` with user JWT returns 0 rows (Admin only policy).
  - Attempting to update `public.properties` or `public.bookings` with user JWT is rejected with Postgres error `42501 (insufficient_privilege)`.

---

## 6. Test Cases: Edge Cases, Concurrency & Data Integrity (TC-EDG)

### TC-EDG-001: High-Concurrency Unit Double-Booking Conflict
- **Role:** Two Admins simultaneously
- **Scenario:** Unit 6A is `Available`. Admin 1 and Admin 2 both open the New Booking wizard for Unit 6A at the same time.
- **Test Steps:**
  1. Admin 1 clicks "Submit" at $T_0$.
  2. Admin 2 clicks "Submit" at $T_0 + 500\text{ms}$.
- **Expected Results:**
  - Admin 1's booking succeeds; Unit 6A status becomes `Booked`.
  - Admin 2's submission encounters the inventory check:
    ```javascript
    if (inventory[invIndex].status !== 'Available') {
      throw new Error("This unit is no longer available... Someone may have booked it just now.");
    }
    ```
  - Admin 2 receives an explicit error message and booking creation is halted without corrupting data.

---

### TC-EDG-002: Parking Spot Race Condition
- **Role:** Two Admins simultaneously
- **Scenario:** Spot `P1-09` is available. Admin 1 assigns it to Booking A; Admin 2 assigns it to Booking B.
- **Expected Results:**
  - The second submission detects `parkingInventory[spotIdx].status !== 'Available'` and aborts with a clear conflict error.

---

### TC-EDG-003: Overpayment Handling & Zero-Balance Edge
- **Role:** Finance Admin
- **Scenario:** Scheduled installment is ৳500,000. Balance due is ৳500,000. Admin records received payment of ৳600,000.
- **Expected Results:**
  - System handles overpayment cleanly: `newBalance` evaluates to $\max(0, \text{totalPrice} - \text{newTotalPaid}) = 0$.
  - Balance due is never negative.
  - Booking auto-transitions to `Fully Paid`.

---

### TC-EDG-004: Leap Year & Month-End Boundary in Installment Schedules
- **Role:** Operations Admin
- **Scenario:** Installment schedule start date is set to `January 31, 2028` (Leap Year) with `Monthly` frequency for 4 months.
- **Expected Results:**
  - JavaScript date generator increments month by month without date skipping:
    - Installment 1: Jan 31
    - Installment 2: Feb 29 (Leap year handled)
    - Installment 3: Mar 29/31
    - Installment 4: Apr 30
  - All installments remain valid ISO date strings in `YYYY-MM-DD` format.

---

### TC-EDG-005: Security: XSS & SQL Injection Payload Sanitization
- **Role:** QA Penetration Tester
- **Test Inputs:**
  - Client Name: `<script>alert('xss')</script>Robert'); DROP TABLE bookings;--`
  - Internal Notes: `"><img src=x onerror=alert(1)>`
  - Agreement Ref: `' OR 1=1 --`
- **Expected Results:**
  - Supabase parameterized queries prevent SQL injection.
  - React JSX escaping prevents script execution in DOM.
  - Values render as pure strings.

---

### TC-EDG-006: Dual-Format Compatibility (Postgres snake_case vs JS camelCase)
- **Role:** Systems Verification
- **Scenario:** Verify all mappers (`mapBookingFromDB`, `mapPaymentFromDB`, `mapActivityFromDB`) and stage gate evaluator (`evaluateStagePrerequisites`).
- **Expected Results:**
  - Works seamlessly with both `due_date` and `dueDate`, `total_paid` and `totalPaid`, `scheduled_amount` and `scheduledAmount`.
  - Zero runtime `TypeError: undefined is not an object` errors.

---

## 7. Test Execution & Sign-Off Matrix

| Test Suite Module | Total Test Cases | Automated / Manual | Pass Criteria | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Module 1: User / Client Side (TC-USR)** | 10 | Hybrid | 100% Pass | **Ready for Execution** |
| **Module 2: Admin Operations (TC-ADM)** | 28 | Hybrid | 100% Pass | **Ready for Execution** |
| **Module 3: Super Admin Governance (TC-SAD)** | 6 | Hybrid | 100% Pass | **Ready for Execution** |
| **Module 4: Edge Cases & Concurrency (TC-EDG)** | 6 | Automated / Integration | 100% Pass | **Ready for Execution** |
| **Total Test Suite Coverage** | **50 Comprehensive Cases** | — | **Zero Severity 1 / 2 Defects** | **Approved** |

---
*End of Master Test Specification — Viridian Nexus Booking System*
