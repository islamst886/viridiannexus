# Viridian Nexus — Master Test Specification & Test Cases
## Enterprise End-to-End Newsletter Subscription & Subscriber Management Subsystem

**Document Version:** 1.0.0  
**Target Platform:** Viridian Nexus Luxury Real Estate Platform  
**Architecture:** React 19 + Supabase (PostgreSQL 15, PostgREST, Row Level Security)  
**Standard Compliance:** IEEE 829 (Standard for Software Test Documentation) & ISO/IEC/IEEE 29119  
**Security Standard:** OWASP Top 10 Application Security Verification & GDPR/CAN-SPAM Compliance  
**Author:** Quality Assurance & Systems Engineering Team  
**Date:** October 2026  

---

## 1. Executive Summary & Test Strategy

### 1.1 Purpose & Scope
This test specification establishes the formal verification, validation, and quality assurance framework for the entire **Viridian Nexus Newsletter & Subscriber Management Subsystem**. The scope covers:
- **Public & Website Visitors:** Global luxury footer newsletter subscription module (`Layout.jsx`), strict client-side RFC 5322 email regex validation, submit state handling (disabled inputs, loading spinner), duplicate email conflict handling, and luxury branding success notification toasts.
- **Registered Users & High-Net-Worth Investors:** Authenticated subscriber auto-linking, email normalization (trimming whitespace and lowercase case-folding), duplicate subscription idempotency, and strict privacy isolation prohibiting non-admin users from viewing subscriber directories.
- **Operations & Marketing Admins:** Administrative Newsletter Manager (`/admin/newsletter`), subscriber directory listing sorted by chronological subscription date (`subscribed_at DESC`), live subscriber counts, status badge indicators (`Active`, `Unsubscribed`), client search/filtering, subscriber list export utilities, and subscriber removal with confirmation dialogues.
- **Super Admins & Governance:** Database Row Level Security (RLS) enforcement on `public.newsletter_subscribers`, public insert permissions (`WITH CHECK (true)`), administrative select/delete permissions (`is_admin()`), prevention of subscriber list exfiltration (zero unauthorized read leakage), and compliance retention standards.
- **Edge Cases & Failure Modes:** Malicious XSS / SQL injection payloads in email inputs, complex plus-addressed and international email formats, maximum RFC 5321 length limits (254 chars), empty subscriber tables, and rapid deletion debouncing.

### 1.2 Target System Personas
| Role Identifier | Role Name | System Privileges |
| :--- | :--- | :--- |
| **PUB** | **Public Visitor / Prospective Lead** | Subscribe to exclusive newsletter via footer, receive client-side validation errors or success toasts. |
| **USR** | **Registered Client / Investor** | Subscribe with account email, normalized email storage, zero access to subscriber database. |
| **ADM** | **Operations / Marketing Admin** | Full access to `/admin/newsletter`: view subscriber list, search subscribers, export email lists, remove subscribers. |
| **SAD** | **Super Admin / Compliance Officer** | Full Admin privileges + audit RLS security on `newsletter_subscribers`, monitor opt-out compliance, verify data integrity. |

---

## 2. Requirements Traceability Matrix (RTM)

| Requirement ID | Subsystem Module | Covered Test Cases | Severity |
| :--- | :--- | :--- | :--- |
| **REQ-NWS-01** | Footer Newsletter Form & Email Validation | `TC-PUB-001`, `TC-PUB-002` | Critical |
| **REQ-NWS-02** | Submit Loading State & Feedback Toasts | `TC-PUB-003`, `TC-PUB-004` | High |
| **REQ-NWS-03** | Investor Email Normalization & Folding | `TC-USR-001`, `TC-USR-002` | High |
| **REQ-NWS-04** | Duplicate Email Conflict & Idempotency | `TC-USR-003` | Critical |
| **REQ-NWS-05** | Cross-Tenant Subscriber Privacy Isolation | `TC-USR-004`, `TC-SAD-003` | Blocker |
| **REQ-ADM-06** | Admin Directory Fetching & Chronological Sort | `TC-ADM-001`, `TC-ADM-002` | High |
| **REQ-ADM-07** | Admin Directory Table & Status Badges | `TC-ADM-003` | Medium |
| **REQ-ADM-08** | Subscriber Search & Email Export | `TC-ADM-004`, `TC-ADM-005` | High |
| **REQ-ADM-09** | Subscriber Deletion & Optimistic UI Update | `TC-ADM-006`, `TC-ADM-007` | Critical |
| **REQ-SAD-10** | Database RLS Insert Policy Enforcement | `TC-SAD-001` | Blocker |
| **REQ-SAD-11** | Database RLS Select/Delete Admin Only Policy | `TC-SAD-002` | Blocker |
| **REQ-SAD-12** | Unique Constraint & Schema Integrity | `TC-SAD-004` | Critical |
| **REQ-EDG-13** | XSS & Script Injection Rejection | `TC-EDG-001` | Blocker |
| **REQ-EDG-14** | RFC 5322 Complex & Plus-Addressed Emails | `TC-EDG-002`, `TC-EDG-003` | High |
| **REQ-EDG-15** | Empty Directory & Timestamp Fallbacks | `TC-EDG-004`, `TC-EDG-005` | Medium |

---

## 3. Test Cases: Public & Website Visitors (TC-PUB)

### TC-PUB-001: RFC 5322 Client-Side Email Syntax Validation
- **Role:** Public Visitor
- **Validation Rule:** Strict regular expression `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
- **Test Steps:**
  1. Provide valid email: `client@example.com`.
  2. Provide valid luxury investor email: `investor.nrb@viridiannexus.com`.
  3. Attempt submit with invalid formats:
     - Missing `@`: `clientexample.com`
     - Missing domain: `client@`
     - Missing TLD: `client@example`
     - Spaces in local part: `client user@example.com`
- **Expected Result:** Valid emails pass validation; invalid emails are rejected before triggering network requests.

### TC-PUB-002: Public Validation Error Feedback
- **Role:** Public Visitor
- **Test Steps:**
  1. Submit empty email input or malformed email.
  2. Inspect toast error message.
- **Expected Result:** Displays `Please enter a valid email address.` toast; form submission is blocked.

### TC-PUB-003: Subscription In-Progress UI State (Locking & Spinner)
- **Role:** Public Visitor
- **Test Steps:**
  1. Initiate subscription with valid email.
  2. Verify that `isSubscribing` state is set to `true`.
  3. Verify that input element has `disabled` attribute and `disabled:opacity-50`.
  4. Verify that submit button renders spinning `Loader2` icon and is disabled.
- **Expected Result:** Prevents accidental double submissions while asynchronous request is pending.

### TC-PUB-004: Subscription Success Handling & Input Reset
- **Role:** Public Visitor
- **Test Steps:**
  1. Complete subscription API call successfully.
  2. Verify payload inserted to `newsletter_subscribers`:
     `{ email: normalizedEmail, subscribed_at: ISO_TIMESTAMP, status: 'active' }`.
  3. Verify email input state is cleared to `""`.
  4. Verify success toast is shown: `Welcome to Viridian Nexus Development Ltd. Exclusive Updates.`.
- **Expected Result:** Clean user experience and clear confirmation of subscription receipt.

---

## 4. Test Cases: User & Investor Subsystem (TC-USR)

### TC-USR-001: Authenticated Client Account Normalization
- **Role:** Registered Client / Property Investor
- **Test Steps:**
  1. Client inputs email with leading/trailing spaces: `  investor@viridiannexus.com  `.
  2. Client inputs mixed casing: `Investor.Chowdhury@Example.COM`.
  3. Process via normalization logic.
- **Expected Result:** Normalized to lowercase trimmed string: `investor.chowdhury@example.com`.

### TC-USR-002: Duplicate Email Subscription Handling (Idempotency)
- **Role:** Registered Client / Property Investor
- **Preconditions:** `client@example.com` already exists in `public.newsletter_subscribers`.
- **Test Steps:**
  1. Attempt to subscribe with `client@example.com` again.
  2. Supabase returns PostgreSQL unique constraint error code `23505` (`duplicate key value violates unique constraint`).
  3. Application handles conflict gracefully (either informs user they are already subscribed or returns friendly status).
- **Expected Result:** Database never creates duplicate records for the same email address.

### TC-USR-003: Cross-Tenant Subscriber Privacy Isolation
- **Role:** Registered Client (`role: 'user'`)
- **Test Steps:**
  1. Authenticate as normal registered user.
  2. Attempt to query `supabase.from('newsletter_subscribers').select('*')`.
- **Expected Result:** Request returns 0 rows due to RLS policy (`newsletter_admin` restricts SELECT to `is_admin()`).

---

## 5. Test Cases: Admin Operations & Newsletter Management (TC-ADM)

### TC-ADM-001: Subscriber Directory Fetching & Chronological Order
- **Role:** Operations Admin
- **Test Steps:**
  1. Navigate to `/admin/newsletter`.
  2. Verify API call executes: `supabase.from('newsletter_subscribers').select('*').order('subscribed_at', { ascending: false })`.
- **Expected Result:** Newest subscribers appear at the top of the directory table.

### TC-ADM-002: Empty State Directory Rendering
- **Role:** Operations Admin
- **Test Steps:**
  1. Mock empty subscribers array `[]`.
  2. Render `AdminNewsletter`.
- **Expected Result:** Renders `Users` icon, "No subscribers yet." headline, and informative subtitle.

### TC-ADM-003: Subscriber Table Columns & Status Badging
- **Role:** Operations Admin
- **Test Steps:**
  1. Inspect subscriber table row.
  2. Verify columns: `Email Address`, `Subscribed Date`, `Status`, `Actions`.
  3. Verify status badge defaults to `Active` with green styling (`bg-green-100 text-green-800`).
  4. Verify date formatting uses localized date representation.
- **Expected Result:** Clear, professional audit table for client engagement teams.

### TC-ADM-004: Subscriber Live Search Filtering
- **Role:** Operations Admin
- **Test Steps:**
  1. Given a list of 10 subscribers.
  2. Input query `banani` or `chowdhury`.
  3. Filter subscriber list case-insensitively.
- **Expected Result:** Table immediately narrows down to matching subscriber email records.

### TC-ADM-005: Subscriber Export to CSV / Marketing List
- **Role:** Operations Admin
- **Test Steps:**
  1. Invoke export helper on current subscriber dataset.
  2. Verify output generates valid CSV with headers `Email,Status,SubscribedDate`.
- **Expected Result:** Marketing team can reliably extract subscriber lists for external communications.

### TC-ADM-006: Subscriber Deletion & Confirmation Modal
- **Role:** Operations Admin
- **Test Steps:**
  1. Click Trash icon on subscriber `sub-01`.
  2. Confirm dialog (`window.confirm("Are you sure you want to remove this subscriber?")`).
  3. If cancelled: abort deletion, state remains unchanged.
  4. If confirmed: execute `supabase.from('newsletter_subscribers').delete().eq('id', 'sub-01')`.
- **Expected Result:** Guards against accidental removal of high-value client leads.

### TC-ADM-007: Optimistic Local State Deletion
- **Role:** Operations Admin
- **Test Steps:**
  1. Upon successful delete API resolution:
  2. Verify state updater executes: `setSubscribers(prev => prev.filter(sub => sub.id !== id))`.
  3. Verify toast notification `Subscriber removed` is displayed.
- **Expected Result:** Removed subscriber disappears instantly from the UI without full page reload.

---

## 6. Test Cases: Super Admin Governance & Security (TC-SAD)

### TC-SAD-001: Database RLS Insert Policy Enforcement
- **Role:** Super Admin / Security
- **Policy:** `CREATE POLICY "newsletter_insert" ON public.newsletter_subscribers FOR INSERT WITH CHECK (true);`
- **Test Steps:**
  1. Execute unauthenticated POST to `newsletter_subscribers`.
  2. Verify HTTP 201 Created / Success.
- **Expected Result:** Any prospective lead can subscribe without needing an active session.

### TC-SAD-002: Database RLS Admin-Only Access Policy
- **Role:** Super Admin / Security
- **Policy:** `CREATE POLICY "newsletter_admin" ON public.newsletter_subscribers FOR ALL USING (is_admin());`
- **Test Steps:**
  1. Authenticate as Admin (`role: 'admin'`): SELECT, UPDATE, DELETE permitted.
  2. Authenticate as Super Admin (`role: 'super_admin'`): Full access permitted.
  3. Authenticate as Client (`role: 'user'`): SELECT/UPDATE/DELETE denied.
  4. Anonymous user: SELECT/UPDATE/DELETE denied.
- **Expected Result:** High-security isolation of client mailing lists preventing data leaks.

### TC-SAD-003: Unique Constraint Verification on PostgreSQL Table
- **Role:** Super Admin / Database
- **Schema:** `email TEXT UNIQUE NOT NULL`
- **Test Steps:**
  1. Execute direct insert of two identical emails into table.
  2. Verify constraint violation occurs.
- **Expected Result:** Database level guarantee that email duplication is impossible.

---

## 7. Test Cases: Edge Cases & Failure Modes (TC-EDG)

### TC-EDG-001: Malicious XSS & SQL Injection Defense
- **Test Steps:**
  1. Input email: `<script>alert('xss')</script>@domain.com`.
  2. Input email: `admin' OR 1=1;--@nexus.com`.
  3. Verify client-side regex rejects malicious characters before sending.
  4. Verify PostgREST parameterized queries escape all payloads.
- **Expected Result:** Zero risk of script execution or database tampering.

### TC-EDG-002: Complex RFC 5322 Plus-Addressed & Subdomain Emails
- **Test Steps:**
  1. Validate plus-addressed email: `investor+luxury@gmail.com`.
  2. Validate multi-level subdomain email: `director@asia.operations.nexus.com`.
  3. Validate dot-separated local part: `first.middle.last@domain.com`.
- **Expected Result:** Valid international business emails are accepted without false rejections.

### TC-EDG-003: RFC 5321 Maximum Length Boundary
- **Test Steps:**
  1. Input email exactly 254 characters long: Validate accepted.
  2. Input email 255 characters long: Validate rejected.
- **Expected Result:** Conforms to Internet message standard RFC 5321.

### TC-EDG-004: Robust Date Formatting Resilience
- **Test Steps:**
  1. Subscriber with valid ISO timestamp: Formats to standard date string.
  2. Subscriber with `subscribed_at = null`: Displays `Unknown Date`.
  3. Subscriber with invalid date string: Displays `Unknown Date`.
- **Expected Result:** System never crashes when encountering legacy or unpopulated timestamps.

### TC-EDG-005: Rapid Consecutive Deletion Debouncing
- **Test Steps:**
  1. Admin clicks delete repeatedly on the same subscriber.
  2. Verify deletion logic prevents duplicate network requests for already removed IDs.
- **Expected Result:** Idempotent client-side state handling.

---

## 8. Quality Acceptance Criteria & Test Execution

1. **Framework:** Vitest with JSDOM / Node.
2. **Acceptance Thresholds:**
   - 100% of Newsletter tests must pass.
   - Zero test regressions on existing subsystems (Booking, Property, Messaging, Progress).
   - Zero Vite build errors.
