# Viridian Nexus — Master Test Specification & Test Cases
## Enterprise End-to-End Messaging & Client Communications Subsystem

**Document Version:** 1.0.0  
**Target Platform:** Viridian Nexus Luxury Real Estate Platform  
**Architecture:** React 19 + Supabase (PostgreSQL 15, PostgREST, Realtime Channels, Row Level Security)  
**Standard Compliance:** IEEE 829 (Standard for Software Test Documentation) & ISO/IEC/IEEE 29119  
**Security Standard:** OWASP Top 10 Application Security Verification  
**Author:** Quality Assurance & Systems Engineering Team  
**Date:** October 2026  

---

## 1. Executive Summary & Test Strategy

### 1.1 Purpose & Scope
This test specification outlines the exhaustive verification, validation, and quality assurance framework for the entire **Viridian Nexus Messaging & Communications Subsystem**. The scope covers:
- **Public & Website Visitors:** Corporate Contact Page (`/contact`), Property Showcase Inquiry modals, dynamic inquiry types (Domestic Investment, NRB / International Purchase, Brochure Requests, Virtual Tour Booking, Private Consultation), privacy policy consent enforcement, and pre-selected property parameter parsing.
- **Registered Users:** In-app notification delivery, real-time unread notification counter badge, batch mark-as-read operations, authenticated inquiry auto-fill with profile details, and strict cross-tenant notification privacy isolation.
- **Operations & Sales Admins:** Admin Inbox & Inquiries dashboard (`/admin/messages`), unread highlight styling, expandable message accordions, real-time status toggling (Read / Unread), inquiry deletion, and direct telephonic/email communication action triggers (`tel:` and `mailto:`).
- **Super Admins:** Administrative governance, compliance retention, message deletion cascades, and database Row Level Security (RLS) enforcement on `public.inquiries` and `public.notifications`.
- **Edge Cases & Failure Modes:** Malicious XSS / Script injection sanitization, international and domestic Bangladeshi phone format parsing, extreme length and multi-line whitespace preservation, and legacy Firestore vs PostgreSQL timestamp handling.

### 1.2 Target System Personas
| Role Identifier | Role Name | System Privileges |
| :--- | :--- | :--- |
| **PUB** | **Public Visitor / Lead** | Submit general corporate inquiries, request brochures, request international investment consultation, agree to privacy policy. |
| **USR** | **Registered Client / Investor** | All Public privileges + receive in-app notifications, view unread notification badges, batch mark notifications as read, submit authenticated pre-filled inquiries. |
| **ADM** | **Operations / Sales Admin** | Full access to Admin Inbox (`/admin/messages`): read client inquiries, filter by status, toggle Read/Unread, delete messages, view full contact details. |
| **SAD** | **Super Admin / Compliance** | Full Admin privileges + audit message lifecycles, verify database RLS policies, ensure data privacy compliance. |

---

## 2. Requirements Traceability Matrix (RTM)

| Requirement ID | Subsystem Module | Covered Test Cases | Severity |
| :--- | :--- | :--- | :--- |
| **REQ-MSG-01** | Corporate Contact Form Submission | `TC-PUB-001`, `TC-PUB-002`, `TC-PUB-003` | Critical |
| **REQ-MSG-02** | Property Parameter Preservation in Inquiries | `TC-PUB-004` | High |
| **REQ-MSG-03** | Privacy Policy Mandatory Consent Guard | `TC-PUB-005` | High |
| **REQ-NOT-04** | User In-App Notification Delivery & Badges | `TC-USR-001`, `TC-USR-002` | Critical |
| **REQ-NOT-05** | Batch Mark Notifications as Read | `TC-USR-003` | High |
| **REQ-NOT-06** | Cross-Tenant Notification Privacy (RLS) | `TC-USR-004`, `TC-SAD-003` | Blocker |
| **REQ-INB-07** | Admin Inbox Directory & Sorting | `TC-ADM-001`, `TC-ADM-002` | High |
| **REQ-INB-08** | Message Read / Unread Status Toggle | `TC-ADM-003` | Critical |
| **REQ-INB-09** | Inquiry Deletion & Contact Actions | `TC-ADM-004`, `TC-ADM-005` | High |
| **REQ-SAD-10** | Super Admin RLS Security Verification | `TC-SAD-001`, `TC-SAD-002` | Blocker |
| **REQ-EDG-11** | Malicious XSS & Script Injection Defense | `TC-EDG-001` | Blocker |
| **REQ-EDG-12** | Multi-Line Whitespace & Extreme Length | `TC-EDG-002` | Medium |
| **REQ-EDG-13** | Domestic & International Phone Formats | `TC-EDG-003` | High |
| **REQ-EDG-14** | Dual Timestamp Schema Compatibility | `TC-EDG-004` | High |

---

## 3. Test Cases: Public & Website Visitors (TC-PUB)

### TC-PUB-001: Corporate Contact Form Validation & Submission
- **Role:** Public Visitor
- **Test Steps:**
  1. Navigate to `/contact`.
  2. Enter Name: `Sultana Razia`, Email: `sultana@example.com`, Phone: `+8801711223344`.
  3. Select Inquiry Type: `Domestic Investment`.
  4. Enter Message: `Requesting private consultation for Jolshiri project.`
  5. Check Privacy Policy agreement checkbox.
  6. Click "Submit Message".
- **Expected Results:**
  - Row is inserted into `public.inquiries` with `status = 'Unread'`, `source = 'Corporate Contact Page'`.
  - Form resets to clean state.
  - Toast confirmation: "Thank you! Your inquiry has been submitted successfully."

---

### TC-PUB-002: Mandatory Field Validation Constraints
- **Role:** Public Visitor
- **Test Matrix:**
  1. Empty Name $\rightarrow$ Error: `Please fill out all fields.`
  2. Empty Phone $\rightarrow$ Error: `Please fill out all fields.`
  3. Empty Email $\rightarrow$ Error: `Please fill out all fields.`
  4. Empty Message $\rightarrow$ Error: `Please fill out all fields.`
- **Expected Results:** Submission is blocked until all required fields contain valid input.

---

### TC-PUB-003: Inquiry Type Selection Diversity
- **Test Options:**
  - `Domestic Investment`
  - `NRB / International Purchase`
  - `Brochure Request`
  - `Virtual Tour Request`
  - `Private Consultation`
- **Expected Results:** Selected type is saved in `inquiries.inquiry_type` and clearly badged in Admin Inbox.

---

### TC-PUB-004: Property Parameter Auto-Detection in Inquiries
- **Test Scenario:**
  - User navigates to `/contact?property=viridian-jolshiri-exclusivity`.
- **Expected Results:**
  - Form automatically formats property title: `Viridian Jolshiri Exclusivity`.
  - Initial inquiry defaults to `Brochure Request`.
  - Submitted inquiry contains `property_name: "Viridian Jolshiri Exclusivity"`.

---

### TC-PUB-005: Privacy Policy Mandatory Consent Guard
- **Test Steps:**
  1. Complete all fields but leave Privacy Policy checkbox unchecked.
  2. Click Submit.
- **Expected Results:**
  - Submission rejected with toast error: `You must agree to the Privacy Policy to submit.`
  - No database insert occurs.

---

## 4. Test Cases: User / Client Side (TC-USR)

### TC-USR-001: In-App Notification Delivery on Operational Events
- **Role:** Registered User
- **Preconditions:** Admin rejects an expression of interest or updates booking status.
- **Test Steps:**
  1. Admin rejects booking request #101 with reason: "Unit unavailable".
- **Expected Results:**
  - Record inserted into `public.notifications` for `user_id = auth.uid()`.
  - Content: `Your expression of interest was not approved: Unit unavailable`.
  - User's navigation bar bell icon renders red badge with unread count `1`.

---

### TC-USR-002: Realtime Unread Counter Badge Calculation
- **Test Formula:**
  $$\text{Unread Count} = \text{notifications.filter}(n \implies !n.\text{read}).\text{length}$$
- **Expected Results:**
  - If 3 unread and 2 read exist $\rightarrow$ Unread badge displays `3`.
  - If all read $\rightarrow$ Badge disappears cleanly.

---

### TC-USR-003: Batch Mark All Notifications as Read
- **Role:** Registered User
- **Test Steps:**
  1. User opens notification bell dropdown.
  2. Clicks "Mark all as read".
- **Expected Results:**
  - Executes batch update: `supabase.from('notifications').update({ read: true }).in('id', unreadIds)`.
  - Unread count drops to 0 immediately.

---

### TC-USR-004: Tenant Notification Isolation (RLS Security)
- **Role:** User A (`usr-aaa`) vs User B (`usr-bbb`)
- **Test Steps:**
  1. User A queries `public.notifications` table.
- **Expected Results:**
  - RLS policy `notifications_select` returns ONLY rows where `user_id = 'usr-aaa'`.
  - 0 rows of User B's notifications are leaked.

---

## 5. Test Cases: Admin Inbox Management (TC-ADM)

### TC-ADM-001: Admin Inbox Directory & Chronological Sorting
- **Role:** Operations Admin
- **Test Steps:**
  1. Navigate to `/admin/messages`.
- **Expected Results:**
  - Inquiries load sorted by `created_at DESC` (newest first).
  - Unread inquiries render with distinctive highlighted background (`bg-indigo-50/30`) and active mail icon.
  - Read inquiries render with neutral background and opened mail icon.

---

### TC-ADM-002: Expand / Collapse Message Accordion
- **Role:** Operations Admin
- **Test Steps:**
  1. Click on inquiry row #1.
  2. Observe expanded container displaying full message body, sender name, phone link, and email link.
  3. Click row #1 again $\rightarrow$ container collapses cleanly.
- **Expected Results:** State toggles between expanded and collapsed without re-rendering unrelated rows.

---

### TC-ADM-003: Toggle Read / Unread Status
- **Role:** Operations Admin
- **Test Steps:**
  1. Click "Mark Read" on unread inquiry.
  2. Observe status updates to `Read` in database and UI.
  3. Click "Mark Unread" on the same inquiry.
- **Expected Results:** Status toggles between `Read` and `Unread` with confirmation toasts.

---

### TC-ADM-004: Message Deletion with Confirmation Dialog
- **Role:** Operations Admin
- **Test Steps:**
  1. Click Trash icon on inquiry #99.
  2. Cancel confirmation dialog $\rightarrow$ message remains intact.
  3. Click Trash icon and confirm dialog.
- **Expected Results:**
  - Row deleted from `public.inquiries`.
  - UI removes inquiry row with toast: `Message deleted`.

---

### TC-ADM-005: Direct Communication Triggers (`tel:` & `mailto:`)
- **Role:** Operations Admin
- **Test Steps:**
  1. In expanded inquiry details, click Phone Number link (`tel:+8801711223344`).
  2. Click Email Address link (`mailto:client@example.com`).
- **Expected Results:** System triggers native dialer and default email client with recipient pre-populated.

---

## 6. Test Cases: Super Admin Governance & Security (TC-SAD)

### TC-SAD-001: Row Level Security Policy Verification on Inquiries
- **Test Matrix:**
  1. Anonymous/Public `INSERT` on `public.inquiries` $\rightarrow$ Allowed (`WITH CHECK (true)`).
  2. Anonymous/Public `SELECT` on `public.inquiries` $\rightarrow$ Denied (`42501`).
  3. Normal User `SELECT` on `public.inquiries` $\rightarrow$ Denied (`42501`).
  4. Admin / Super Admin `SELECT`, `UPDATE`, `DELETE` $\rightarrow$ Allowed (`is_admin() = true`).

---

### TC-SAD-002: Row Level Security Policy Verification on Notifications
- **Test Matrix:**
  1. Normal user querying own notifications $\rightarrow$ Allowed (`auth.uid() = user_id`).
  2. Normal user querying other user's notifications $\rightarrow$ Returns 0 rows.
  3. Normal user attempting `INSERT` on notifications $\rightarrow$ Denied (Admin only).
  4. Admin inserting notifications for users $\rightarrow$ Allowed (`is_admin() = true`).

---

## 7. Test Cases: Edge Cases & Data Integrity (TC-EDG)

### TC-EDG-001: Malicious XSS & Script Injection Defense
- **Test Payloads:**
  - Sender Name: `<script>alert('xss')</script>Hacker`
  - Message: `"><img src=x onerror=alert(1)>Hello <b>World</b>`
- **Expected Results:**
  - Stored safely as parameterized text in PostgreSQL.
  - React JSX escapes all tags upon rendering, displaying pure raw text without script execution.

---

### TC-EDG-002: Multi-Line Whitespace & Extreme Length Formatting
- **Test Message:**
  - Multi-line message with indentations, carriage returns (`\r\n`), and 5,000 characters.
- **Expected Results:**
  - Database stores complete text without truncation.
  - CSS `whitespace-pre-wrap` preserves line breaks and paragraph spacing.

---

### TC-EDG-003: Domestic & International Phone Formats
- **Test Formats:**
  - `+8801711000000` (E.164 with country code)
  - `01711-000000` (Hyphenated local)
  - `01711 000 000` (Spaced local)
  - `+1 (555) 234-5678` (International US format)
- **Expected Results:** System accepts and cleanses phone numbers without crashing.

---

### TC-EDG-004: Dual Timestamp Compatibility (Firestore Legacy vs PostgreSQL)
- **Test Data:**
  - Postgres Timestamp: `'2026-10-21T10:00:00Z'`
  - Legacy Firestore Timestamp: `{ seconds: 1761040800, nanoseconds: 0 }`
- **Expected Results:** System parses both structures without throwing `TypeError: Cannot read properties of undefined`.

---

## 8. Test Execution & Sign-Off Matrix

| Test Suite Module | Total Test Cases | Automated / Manual | Pass Criteria | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Module 1: Public Contact & Inquiries (TC-PUB)** | 5 | Hybrid | 100% Pass | **Ready for Execution** |
| **Module 2: User In-App Notifications (TC-USR)** | 4 | Hybrid | 100% Pass | **Ready for Execution** |
| **Module 3: Admin Inbox Operations (TC-ADM)** | 5 | Hybrid | 100% Pass | **Ready for Execution** |
| **Module 4: Super Admin Governance (TC-SAD)** | 2 | Automated / DB | 100% Pass | **Ready for Execution** |
| **Module 5: Edge Cases & Integrity (TC-EDG)** | 4 | Automated / Unit | 100% Pass | **Ready for Execution** |
| **Total Message Suite Coverage** | **20 Comprehensive Cases** | — | **Zero Defects** | **Approved** |

---
*End of Master Test Specification — Viridian Nexus Messaging & Communications Subsystem*
