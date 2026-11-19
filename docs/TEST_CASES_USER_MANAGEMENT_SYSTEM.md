# Viridian Nexus — Master Test Specification & Test Cases
## Enterprise End-to-End User Management & Role-Based Access Control (RBAC) Subsystem

**Document Version:** 1.0.0  
**Target Platform:** Viridian Nexus Luxury Real Estate Platform  
**Architecture:** React 19 + Supabase (PostgreSQL 15, PostgREST, Auth Triggers, Row Level Security)  
**Standard Compliance:** IEEE 829 (Standard for Software Test Documentation) & ISO/IEC/IEEE 29119  
**Security Standard:** OWASP Top 10 Application Security Verification (Broken Object Level Authorization / Privilege Escalation Defense)  
**Author:** Quality Assurance & Systems Engineering Team  
**Date:** October 2026  

---

## 1. Executive Summary & Test Strategy

### 1.1 Purpose & Scope
This test specification establishes the formal verification, validation, and quality assurance framework for the entire **Viridian Nexus User Management & Identity Governance Subsystem**. The scope covers:
- **Public & Website Visitors:** Account registration via Supabase Auth, automatic profile generation via PostgreSQL trigger `handle_new_user()`, automated unique referral code issuance (`VN-XXXXXX`), and default unprivileged role assignment (`user`).
- **Registered Clients & High-Net-Worth Investors:** Self-service profile management (`EditProfileModal.jsx`), phone/emergency contact maintenance, National ID (`NID` / Passport) records, and avatar customization.
- **Account Security & Banned User Defense:** Banned user session rejection upon login, real-time suspension enforcement (instant forced logout via Supabase Realtime channel `profile:{id}` when `is_banned = true`), and security notifications.
- **Operations Admin vs. Super Admin Privilege Separation:** Role-Based Access Control (RBAC) isolation. Operations Admins (`role: 'admin'`) are restricted from accessing `/admin/users` via `<SuperAdminRoute>`, with User Management navigation strictly suppressed from their sidebar.
- **Super Admin Governance (`UserManager.jsx`):** Directory audit table, live search filtering by name, email, and phone, role modification modal (`user` $\leftrightarrow$ `admin`), and account suspension toggle (Ban / Unban).
- **Critical Self & Super Admin Protection Guards:** Invariant rules preventing self-banning, self-demotion, banning other Super Admins, or modifying another Super Admin's role.
- **Database Row Level Security (RLS) & Constraints:** Enforcement on `public.profiles` (`profiles_select`, `profiles_insert`, `profiles_update`, `profiles_delete`), role enum validation (`CHECK (role IN ('user', 'admin', 'super_admin'))`), and foreign key cascade deletion.

### 1.2 Target System Personas
| Role Identifier | Role Name | System Privileges |
| :--- | :--- | :--- |
| **PUB** | **Public Visitor / Lead** | Register new account, trigger `handle_new_user()` profile creation with referral code. |
| **USR** | **Registered Client / Investor** | Update personal contact info, view linked bookings, access profile dashboard; cannot read other profiles. |
| **ADM** | **Operations / Sales Admin** | Manage properties, bookings, messages; strictly blocked from `/admin/users` and role modification. |
| **SAD** | **Super Admin / Executive** | Full platform authority: access `/admin/users`, search all profiles, promote/demote roles, ban/unban users. |

---

## 2. Requirements Traceability Matrix (RTM)

| Requirement ID | Subsystem Module | Covered Test Cases | Severity |
| :--- | :--- | :--- | :--- |
| **REQ-USR-01** | Account Registration & Trigger Profile Creation | `TC-PUB-001`, `TC-PUB-002` | Critical |
| **REQ-USR-02** | Unique Referral Code Generation (`VN-XXXXXX`) | `TC-PUB-003` | Medium |
| **REQ-USR-03** | Client Self-Service Profile Updates | `TC-USR-001`, `TC-USR-002` | High |
| **REQ-USR-04** | Client Role Elevation Tampering Defense | `TC-USR-003`, `TC-GOV-002` | Blocker |
| **REQ-SEC-05** | Banned User Authentication Lockout | `TC-SEC-001` | Blocker |
| **REQ-SEC-06** | Real-Time Live Session Suspension (Forced Sign-Out) | `TC-SEC-002` | Critical |
| **REQ-ADM-07** | Admin vs Super Admin RBAC Separation | `TC-ADM-001`, `TC-ADM-002` | Blocker |
| **REQ-SAD-08** | Super Admin Directory Listing & Realtime Sync | `TC-SAD-001`, `TC-SAD-002` | High |
| **REQ-SAD-09** | Live Search Filtering (Name, Email, Phone) | `TC-SAD-003` | Medium |
| **REQ-SAD-10** | Role Modification (`user` $\leftrightarrow$ `admin`) | `TC-SAD-004` | Critical |
| **REQ-SAD-11** | User Suspension Toggle (Ban / Unban) | `TC-SAD-005` | Critical |
| **REQ-SAD-12** | Super Admin Immunity Protection Guards | `TC-SAD-006` | Blocker |
| **REQ-SAD-13** | Self-Demotion & Self-Banning Guards | `TC-SAD-007` | Blocker |
| **REQ-GOV-14** | Database Row Level Security (RLS) Policies | `TC-GOV-001`, `TC-GOV-002`, `TC-GOV-003` | Blocker |
| **REQ-EDG-15** | Malformed Profiles, Regex Escaping & Boundary Cases | `TC-EDG-001`, `TC-EDG-002`, `TC-EDG-003` | High |

---

## 3. Test Cases: Public & User Registration / Profile (TC-PUB & TC-USR)

### TC-PUB-001: Automatic Profile Creation via handle_new_user() Trigger
- **Role:** Public Visitor / New Lead
- **Trigger:** `on_auth_user_created AFTER INSERT ON auth.users`
- **Test Steps:**
  1. Insert new user into `auth.users` with metadata `display_name = 'Zubair Ahmed'` and `phone = '+8801700000000'`.
  2. Inspect resulting row in `public.profiles`.
- **Expected Result:** Profile created with matching ID, `role = 'user'`, `is_banned = false`, and timestamp set to `NOW()`.

### TC-PUB-002: Unique Referral Code Formatting
- **Role:** Public Visitor / New Lead
- **Rule:** Referral code formatted as `VN-` followed by 6 uppercase alphanumeric characters (e.g. `VN-A1B2C3`).
- **Test Steps:**
  1. Generate referral code using regex `^VN-[A-Z0-9]{6}$`.
  2. Verify uniqueness constraint in database.
- **Expected Result:** Referral code adheres strictly to corporate branding syntax and maintains database uniqueness.

### TC-USR-001: Client Self-Service Profile Updates
- **Role:** Registered Client (`role: 'user'`)
- **Test Steps:**
  1. Client updates emergency phone, address, and selects an avatar preset.
  2. Submit profile update payload via `supabase.from('profiles').update(...)`.
- **Expected Result:** Profile updates successfully under `profiles_update` policy (`auth.uid() = id`).

### TC-USR-002: Client Role Elevation Tampering Defense
- **Role:** Registered Client (`role: 'user'`)
- **Test Steps:**
  1. Malicious client attempts to execute: `supabase.from('profiles').update({ role: 'super_admin' }).eq('id', auth.uid())`.
  2. Evaluate security policy.
- **Expected Result:** PostgREST / RLS / DB trigger rejects role modification by non-super admin.

---

## 4. Test Cases: Account Security & Banned User Defense (TC-SEC)

### TC-SEC-001: Banned User Authentication Lockout
- **Role:** Banned User (`is_banned: true`)
- **Test Steps:**
  1. User credentials successfully match in `auth.users`.
  2. `GlobalState` fetches user profile from `public.profiles`.
  3. Condition `data?.is_banned === true` evaluates.
- **Expected Result:** Immediately invokes `supabase.auth.signOut()`, clears user profile, and displays `"Your account has been suspended."`.

### TC-SEC-002: Real-Time Live Session Suspension (Forced Sign-Out)
- **Role:** Active Client User
- **Test Steps:**
  1. User has an active browsing session.
  2. Super Admin toggles user status to `is_banned = true`.
  3. Realtime subscription receives `postgres_changes` payload.
- **Expected Result:** Application instantly triggers `supabase.auth.signOut()`, revokes session, and shows suspension notification.

---

## 5. Test Cases: Admin vs Super Admin RBAC Separation (TC-ADM)

### TC-ADM-001: User Management Sidebar Suppression for Regular Admins
- **Role:** Operations Admin (`role: 'admin'`)
- **Test Steps:**
  1. Render `AdminSidebar` with an authenticated `admin` user (`isSuperAdmin = false`).
  2. Inspect rendered navigation items.
- **Expected Result:** "User Management" button is omitted from DOM.

### TC-ADM-002: SuperAdminRoute Access Denial
- **Role:** Operations Admin (`role: 'admin'`)
- **Test Steps:**
  1. Admin attempts to directly navigate to `/admin/users`.
  2. `<SuperAdminRoute>` checks `isSuperAdmin`.
- **Expected Result:** Displays "Permission Denied" screen with `ShieldAlert` icon and "You need Super Admin privileges to access this page." message.

---

## 6. Test Cases: Super Admin User Management Operations (TC-SAD)

### TC-SAD-001: Super Admin Directory Listing & Total Counter
- **Role:** Super Admin (`role: 'super_admin'`)
- **Test Steps:**
  1. Mount `UserManager`.
  2. Verify API query: `supabase.from('profiles').select('*').order('created_at', { ascending: false })`.
  3. Verify counter displays `Total Users: N`.
- **Expected Result:** Complete list of all registered clients, admins, and super admins is rendered.

### TC-SAD-002: Live Search Filtering by Multi-Field Criteria
- **Role:** Super Admin
- **Test Steps:**
  1. Search by name: `Rahim` $\to$ returns matching profile.
  2. Search by email: `farhana.luxury@dhaka.com` $\to$ returns matching profile.
  3. Search by phone number: `01711` $\to$ returns matching profile.
  4. Search with non-matching string $\to$ displays "No users found".
- **Expected Result:** Search instantly filters without network latency.

### TC-SAD-003: Role Modification Modal (`user` $\leftrightarrow$ `admin`)
- **Role:** Super Admin
- **Test Steps:**
  1. Click Settings icon on a standard user profile.
  2. Modal opens with title "Change User Role".
  3. Select `Admin (Manage Bookings & Assets)`.
  4. Click "Save Role".
  5. Verify DB update: `supabase.from('profiles').update({ role: 'admin', updated_at: ... })`.
- **Expected Result:** Role updates in database and reflects in UI; modal closes cleanly.

### TC-SAD-004: User Suspension Toggle (Ban / Unban)
- **Role:** Super Admin
- **Test Steps:**
  1. Click Ban icon on active user `u1`.
  2. Verify DB update: `supabase.from('profiles').update({ is_banned: true, updated_at: ... })`.
  3. Toast notification displays `"User banned successfully"`.
  4. Badge updates to red `Banned` (`bg-red-100 text-red-800`).
  5. Click Unban icon on banned user `u1`.
  6. Toast notification displays `"User unbanned successfully"`.
  7. Badge updates to green `Active` (`bg-green-100 text-green-800`).
- **Expected Result:** Seamless toggle between active and suspended states.

### TC-SAD-005: Super Admin Immunity Protection Guards
- **Role:** Super Admin
- **Test Steps:**
  1. Locate another Super Admin user row in directory.
  2. Verify Settings (Role Change) button is `disabled`.
  3. Verify Ban button is `disabled`.
  4. Attempt programmatic execution of `handleToggleBan(superAdminUser)`:
     - Verified: Throws toast error `"Cannot ban a super admin."`.
  5. Attempt programmatic execution of `openRoleModal(superAdminUser)`:
     - Verified: Throws toast error `"Cannot modify super admin."`.
- **Expected Result:** Strict immunity guarantees that Super Admins can never be banned or demoted through the manager interface.

### TC-SAD-006: Self-Demotion & Self-Banning Guards
- **Role:** Logged-In Super Admin
- **Test Steps:**
  1. Locate logged-in user's own row in directory (indicated by `"You"` badge).
  2. Verify Settings and Ban buttons have `disabled={isSelf}`.
- **Expected Result:** Prevents accidental platform lockout where the last active Super Admin revokes their own credentials.

---

## 7. Test Cases: Database Governance & Row Level Security (TC-GOV)

### TC-GOV-001: profiles_select Policy
- **Policy:** `CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() = id OR is_admin());`
- **Verification:**
  - Registered client can query their own row ($auth.uid = id$).
  - Admin and Super Admin can query all rows.
  - Unauthenticated user receives 0 rows.

### TC-GOV-002: profiles_update Policy
- **Policy:** `CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id OR is_super_admin());`
- **Verification:**
  - Super Admin can update any row.
  - Normal client can only update their own row ($auth.uid = id$).
  - Regular Admin cannot update other users' rows.

### TC-GOV-003: profiles_delete Policy
- **Policy:** `CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (is_super_admin());`
- **Verification:**
  - Super Admin can delete profiles.
  - Regular Admin and regular clients cannot delete profiles.

---

## 8. Test Cases: Edge Cases & Failure Modes (TC-EDG)

### TC-EDG-001: Missing Profile Attributes Fallback Handling
- **Test Steps:**
  1. User row with `display_name = null`: Generates avatar with default initial `'U'`.
  2. User row with `created_at = null`: Formats joined date as `'N/A'`.
  3. User row with `role = undefined`: Defaults badge to `'User'`.
- **Expected Result:** Zero UI rendering errors or null pointer crashes.

### TC-EDG-002: Regex Metacharacters in Search Query
- **Test Steps:**
  1. Input search queries containing `+`, `(`, `)`, `*`, `?`, `\`.
  2. Verify case-insensitive substring matching handles special characters without regex crash.
- **Expected Result:** Safe execution and accurate literal substring filtering.

### TC-EDG-003: Cascade Deletion on auth.users Cleanup
- **Test Steps:**
  1. Authenticate user deletion in auth subsystem.
  2. Verify foreign key `REFERENCES auth.users(id) ON DELETE CASCADE`.
- **Expected Result:** Public profile row is removed automatically upon auth user destruction.

---

## 9. Quality Acceptance Criteria & Test Execution

1. **Test Environment:** Vitest runner with JSDOM / Node.
2. **Quality Gates:**
   - 100% of User Management test suites must execute and pass.
   - Zero test regressions on existing subsystems (Booking, Property, Messaging, Progress, Newsletter).
   - Zero production build warnings or syntax errors.
