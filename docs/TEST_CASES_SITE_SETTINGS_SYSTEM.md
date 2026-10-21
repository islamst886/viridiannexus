# Viridian Nexus — Master Test Specification & Test Cases
## Enterprise End-to-End Site Settings & Global Configuration Subsystem

**Document Version:** 1.0.0  
**Target Platform:** Viridian Nexus Luxury Real Estate Platform  
**Architecture:** React 19 + Supabase (PostgreSQL 15, PostgREST, Realtime Channels, Row Level Security)  
**Standard Compliance:** IEEE 829 (Standard for Software Test Documentation) & ISO/IEC/IEEE 29119  
**Security Standard:** OWASP Top 10 Application Security Verification (Defense against Malicious Protocol Injection / SSRF / Broken Access Control)  
**Author:** Quality Assurance & Systems Engineering Team  
**Date:** October 2026  

---

## 1. Executive Summary & Test Strategy

### 1.1 Purpose & Scope
This test specification establishes the formal verification, validation, and quality assurance framework for the entire **Viridian Nexus Site Settings & Global Configuration Subsystem**. The scope covers:
- **Public & Website Visitors:** Global branding and communication touchpoints powered by `siteSettings`:
  - Footer social media links (Facebook, LinkedIn, YouTube) in `Layout.jsx` with dynamic rendering and `noopener noreferrer` security attributes.
  - Floating WhatsApp chat widget (`FloatingWhatsApp.jsx`) with dynamic visibility, non-digit character sanitization, and `https://wa.me/{cleanNumber}` URI construction.
- **Operations Admin vs. Super Admin Privilege Separation:** Role-Based Access Control (RBAC) governance.
  - Omission of Site Settings link from `AdminSidebar` for regular `admin` roles.
  - Access restriction via `<SuperAdminRoute>` denying non-super admins.
  - Read-only viewing mode and Amber alert banner if accessed without Super Admin privileges.
- **Super Admin Governance (`SiteSettings.jsx`):**
  - Fetching settings from `public.settings` (`key = 'site'`).
  - Updating global social media links and WhatsApp numbers.
  - Automated tracking metadata injection (`lastUpdatedAt`, `lastUpdatedBy`).
  - Realtime synchronization via Supabase Realtime channel `settings`.
- **Property Types Global Taxonomy (`usePropertyTypes.js`):**
  - Database-backed property taxonomy (`key = 'property_types'`).
  - Alphabetical ordering guarantee.
  - Dynamic type additions (`addPropertyType`), removals (`removePropertyType`), and duplicate elimination via Set operations.
- **Database Row Level Security (RLS) & Constraints:**
  - Table `public.settings` (`key TEXT PRIMARY KEY`, `value JSONB NOT NULL DEFAULT '{}'`).
  - Public read policy (`settings_select USING (true)`).
  - Admin write policy (`settings_write USING (is_admin())`).
- **Edge Cases & Failure Modes:**
  - Malicious protocol injection (`javascript:`, `data:`).
  - WhatsApp phone number formatting with international symbols (`+`, spaces, hyphens, parentheses).
  - Empty database rows and null settings fallbacks.
  - Case normalization and whitespace trimming.

### 1.2 Target System Personas
| Role Identifier | Role Name | System Privileges |
| :--- | :--- | :--- |
| **PUB** | **Public Visitor / Investor** | Consume dynamic social links in footer, initiate WhatsApp conversations via floating widget. |
| **ADM** | **Operations / Sales Admin** | View site settings in read-only mode if routed; barred from updating global configurations. |
| **SAD** | **Super Admin / Platform Executive** | Full authority: modify global site links, manage WhatsApp numbers, update property types taxonomy. |

---

## 2. Requirements Traceability Matrix (RTM)

| Requirement ID | Subsystem Module | Covered Test Cases | Severity |
| :--- | :--- | :--- | :--- |
| **REQ-SET-01** | Footer Social Media Links Dynamic Rendering | `TC-PUB-001`, `TC-PUB-002` | High |
| **REQ-SET-02** | Floating WhatsApp Phone Sanitization | `TC-PUB-003`, `TC-PUB-004` | Critical |
| **REQ-ADM-03** | Sidebar Suppression for Operations Admin | `TC-ADM-001` | High |
| **REQ-ADM-04** | SuperAdminRoute Access Denial | `TC-ADM-002` | Blocker |
| **REQ-ADM-05** | Read-Only Mode & Amber Warning Banner | `TC-ADM-003` | Medium |
| **REQ-SAD-06** | Super Admin Settings Fetch & Save Upsert | `TC-SAD-001`, `TC-SAD-002` | Critical |
| **REQ-SAD-07** | Audit Metadata Tracking (`lastUpdatedAt`, `lastUpdatedBy`) | `TC-SAD-003` | Medium |
| **REQ-SAD-08** | Realtime Settings Propagation | `TC-SAD-004` | High |
| **REQ-TAX-09** | Property Types Taxonomy Fetch & Default Seeding | `TC-TAX-001` | High |
| **REQ-TAX-10** | Property Types Taxonomy Mutation (Add / Remove) | `TC-TAX-002`, `TC-TAX-003` | Critical |
| **REQ-TAX-11** | Alphabetical Sorting & Deduplication Guarantee | `TC-TAX-004` | Medium |
| **REQ-GOV-12** | Database RLS Policies (`settings_select`, `settings_write`) | `TC-GOV-001`, `TC-GOV-002` | Blocker |
| **REQ-EDG-13** | Malicious Protocol Injection Defense (`javascript:`) | `TC-EDG-001` | Blocker |
| **REQ-EDG-14** | WhatsApp Phone Edge Cases (Dashes, Spaces, Plus) | `TC-EDG-002` | High |
| **REQ-EDG-15** | Null Database Row & Corrupted Value Fallbacks | `TC-EDG-003`, `TC-EDG-004` | Medium |

---

## 3. Test Cases: Public & Website Visitor Touchpoints (TC-PUB)

### TC-PUB-001: Footer Social Media Links Dynamic Rendering
- **Role:** Public Visitor
- **Preconditions:** `siteSettings` loaded in `GlobalState` with Facebook and LinkedIn URLs populated, YouTube URL empty.
- **Test Steps:**
  1. Render footer social links section in `Layout.jsx`.
  2. Verify Facebook link is visible with `href = "https://facebook.com/viridiannexus"`.
  3. Verify LinkedIn link is visible with `href = "https://linkedin.com/company/viridiannexus"`.
  4. Verify YouTube link is omitted from the DOM.
- **Expected Result:** Only populated social links render, maintaining clean visual balance.

### TC-PUB-002: External Link Security Attributes
- **Role:** Public Visitor
- **Test Steps:**
  1. Inspect anchor elements for all active social links.
  2. Verify presence of `target="_blank"` and `rel="noopener noreferrer"`.
- **Expected Result:** Prevents reverse tab-nabbing vulnerabilities across external destinations.

### TC-PUB-003: Floating WhatsApp Widget Dynamic Visibility
- **Role:** Public Visitor
- **Test Steps:**
  1. Scenario A: `siteSettings.whatsappNumber` is null or empty string $\to$ `FloatingWhatsApp` returns `null`.
  2. Scenario B: `siteSettings.whatsappNumber` is `"8801712345678"` $\to$ `FloatingWhatsApp` renders floating button.
- **Expected Result:** Widget only displays when a valid contact channel is provisioned.

### TC-PUB-004: WhatsApp Phone Clean Number Formatting
- **Role:** Public Visitor
- **Test Steps:**
  1. Given configured number `"+880 (171) 234-5678"`.
  2. Execute regex sanitization `number.replace(/\D/g, '')`.
  3. Verify result is `"8801712345678"`.
  4. Verify target href is `https://wa.me/8801712345678`.
- **Expected Result:** Directs user into official WhatsApp API with clean digit sequence.

### TC-PUB-005: Official WhatsApp Brand Vector Assets & Icon Integration
- **Role:** Public Visitor / Admin / Super Admin
- **Test Steps:**
  1. Verify the official WhatsApp brand SVG vector icon (`WhatsAppIcon.jsx`) replaces generic chat bubbles across:
     - Admin Site Settings panel phone input label (`#25D366`).
     - Website floating action button (`FloatingWhatsApp.jsx`) with brand green `#25D366` and hover `#128C7E`.
     - Footer social channels list (`Layout.jsx`).
     - Contact page VIP Desk touchpoint (`Contact.jsx`).
  2. Verify correct SVG `viewBox="0 0 24 24"` with authentic speech bubble and telephone handset contour.
- **Expected Result:** All touchpoints display the official WhatsApp brand identity consistently.

---

## 4. Test Cases: Admin Access & Privilege Separation (TC-ADM)

### TC-ADM-001: Sidebar Navigation Suppression for Regular Admins
- **Role:** Operations Admin (`role: 'admin'`)
- **Test Steps:**
  1. Render `AdminSidebar` with `isSuperAdmin = false`.
  2. Inspect navigation buttons.
- **Expected Result:** "Site Settings" navigation button is suppressed from DOM.

### TC-ADM-002: SuperAdminRoute Access Denial
- **Role:** Operations Admin (`role: 'admin'`)
- **Test Steps:**
  1. Operations Admin accesses `/admin/settings` directly.
  2. `<SuperAdminRoute>` evaluates `isSuperAdmin`.
- **Expected Result:** Access denied; displays "Permission Denied" with `ShieldAlert`.

### TC-ADM-003: Read-Only Mode & Amber Warning Banner
- **Role:** Operations Admin (`role: 'admin'`)
- **Test Steps:**
  1. Render `SiteSettings` component with `isSuperAdmin = false`.
  2. Verify amber banner: `"You are viewing in read-only mode. Only Super Admins can modify these settings."`.
  3. Verify all inputs have `disabled = true`.
  4. Verify "Save Settings" button has `disabled = true`.
- **Expected Result:** Visual and programmatic immutability for non-super admins.

---

## 5. Test Cases: Super Admin Settings Operations (TC-SAD)

### TC-SAD-001: Settings Fetch & Initial State Hydration
- **Role:** Super Admin (`role: 'super_admin'`)
- **Test Steps:**
  1. Mount `SiteSettings`.
  2. Verify query: `supabase.from('settings').select('value').eq('key', 'site').single()`.
  3. Form fields hydrate with database values.
- **Expected Result:** Current website social and contact configurations load accurately into form.

### TC-SAD-002: Super Admin Save Upsert Execution
- **Role:** Super Admin (`role: 'super_admin'`)
- **Test Steps:**
  1. Modify `facebookUrl` and `whatsappNumber`.
  2. Click "Save Settings".
  3. Verify query executed: `supabase.from('settings').upsert({ key: 'site', value: { ... } })`.
  4. Toast success displays: `"Site settings updated successfully."`.
- **Expected Result:** Database record updates and confirmation feedback is provided.

### TC-SAD-003: Audit Metadata Injection
- **Role:** Super Admin (`role: 'super_admin'`)
- **Test Steps:**
  1. Inspect payload sent to Supabase.
  2. Verify inclusion of `lastUpdatedAt` (ISO string) and `lastUpdatedBy` (Super Admin user ID).
- **Expected Result:** Complete audit trail maintained in PostgreSQL JSONB column.

### TC-SAD-004: Realtime Settings Propagation
- **Role:** Super Admin / Public
- **Test Steps:**
  1. Trigger change event on `public.settings` table (`key = 'site'`).
  2. `GlobalState` listener receives payload.
- **Expected Result:** `setSiteSettings(payload.new?.value || {})` updates state across all open client tabs.

---

## 6. Test Cases: Property Types Taxonomy Management (TC-TAX)

### TC-TAX-001: Taxonomy Fetching & Default Seeding
- **Module:** `usePropertyTypes`
- **Default Taxonomy:** `['Apartment', 'Commercial', 'Duplex', 'Luxury Apartment', 'Penthouse', 'Smart Home', 'Townhouse', 'Villa']`
- **Test Steps:**
  1. Fetch `property_types` from `settings` table.
  2. If row is missing or empty, verify automatic upsert of default taxonomy.
- **Expected Result:** System always provides a complete, sorted property category list.

### TC-TAX-002: Property Type Addition (`addPropertyType`)
- **Module:** `usePropertyTypes`
- **Test Steps:**
  1. Invoke `addPropertyType('Eco Studio', currentTypes)`.
  2. Verify new type is trimmed, appended, and deduplicated.
  3. Verify updated array is sorted alphabetically.
- **Expected Result:** Seamless expansion of property classification categories.

### TC-TAX-003: Property Type Removal (`removePropertyType`)
- **Module:** `usePropertyTypes`
- **Test Steps:**
  1. Invoke `removePropertyType('Commercial', currentTypes)`.
  2. Verify type is removed from the taxonomy.
  3. Verify remaining items preserve alphabetical order.
- **Expected Result:** Immediate pruning of obsolete categories.

---

## 7. Test Cases: Database Governance & Row Level Security (TC-GOV)

### TC-GOV-001: settings_select Policy Enforcement
- **Policy:** `CREATE POLICY "settings_select" ON public.settings FOR SELECT USING (true);`
- **Verification:**
  - Public unauthenticated visitors can read settings (for footer links and WhatsApp).
  - Authenticated clients can read settings.
  - Admins and Super Admins can read settings.

### TC-GOV-002: settings_write Policy Enforcement
- **Policy:** `CREATE POLICY "settings_write" ON public.settings FOR ALL USING (is_admin());`
- **Verification:**
  - Operations Admins and Super Admins have database write privileges.
  - Normal clients and unauthenticated visitors receive RLS write denial.

---

## 8. Test Cases: Edge Cases & Failure Modes (TC-EDG)

### TC-EDG-001: Malicious Protocol Injection Defense
- **Test Steps:**
  1. Input `facebookUrl = "javascript:alert(document.cookie)"`.
  2. Verify URL validator rejects non-HTTP/HTTPS protocols.
- **Expected Result:** XSS / malicious script execution attempts via anchor tags are neutralized.

### TC-EDG-002: WhatsApp Phone Number Edge Cases
- **Test Steps:**
  1. Input phone with international prefix: `"+880 171-000-0000"`.
  2. Verify clean number result: `"8801710000000"`.
  3. Input phone containing letters/symbols: `"880-NEXUS-VIP"`.
  4. Verify letters stripped: `"880"`.
- **Expected Result:** Always generates a valid numeric WhatsApp wa.me endpoint.

### TC-EDG-003: Corrupted or Missing Settings Object Fallback
- **Test Steps:**
  1. Database row `value` is `null` or `{}`.
  2. Verify application falls back to default empty strings without throwing `TypeError: Cannot read properties of undefined`.
- **Expected Result:** Resilient UI rendering under degraded data conditions.

---

## 9. Quality Acceptance Criteria & Test Execution

1. **Test Environment:** Vitest runner with JSDOM / Node.
2. **Quality Gates:**
   - 100% of Site Settings test suites must execute and pass.
   - Zero test regressions on existing subsystems (Booking, Property, Messaging, Progress, Newsletter, User Management).
   - Zero production build warnings or syntax errors.
