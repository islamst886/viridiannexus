# Viridian Nexus — Master Test Specification & Test Cases
## Enterprise End-to-End Construction Progress & Milestone Subsystem

**Document Version:** 1.0.0  
**Target Platform:** Viridian Nexus Luxury Real Estate Platform  
**Architecture:** React 19 + Supabase (PostgreSQL 15, PostgREST, Supabase Storage, Row Level Security) + @dnd-kit  
**Standard Compliance:** IEEE 829 (Standard for Software Test Documentation) & ISO/IEC/IEEE 29119  
**Security Standard:** OWASP Top 10 Application Security Verification  
**Author:** Quality Assurance & Systems Engineering Team  
**Date:** October 2026  

---

## 1. Executive Summary & Test Strategy

### 1.1 Purpose & Scope
This test specification establishes the formal verification, validation, and quality assurance framework for the entire **Viridian Nexus Construction Progress & Milestone Management Subsystem**. The scope covers:
- **Public & Website Visitors:** Public Construction Progress page (`/progress`), project selection filtering (only properties with milestones), auto-selection of the first active project, visual timeline node rendering (`CheckCircle` for completed, pulsing `Activity` for current, `Calendar` for upcoming), responsive multi-image gallery layouts, and empty state fallbacks.
- **Investors & Registered Clients:** Real-time construction tracking of booked/purchased properties, overall project completion percentage calculation via weighted milestone progression formulas, active phase indicators, and seamless transition from Property Detail pages (`/projects/:id`) to the full progress timeline.
- **Operations & Project Admins:** Administrative Progress Manager (`/admin/progress`), project selector with property status badges, milestone CRUD operations (Create, Read, Update, Delete), required field validations (`title`, `date`, `description`), phase completion percentage inputs, drag-and-drop sortable image gallery reordering via `@dnd-kit`, unsaved changes guards (`adminUnsavedChanges`), and two-stage image garbage collection (`imagesToDelete` vs `newlyUploadedImages`).
- **Super Admins & Governance:** System security, database Row Level Security (RLS) enforcement on `public.properties.milestones`, storage bucket policies on `storage.objects` for bucket `'milestones'`, cascading storage cleanup upon milestone deletion, and browser unmount orphan image beacon cleanup (`deleteMediaBeacon`).
- **Edge Cases & Failure Modes:** Percentage clamping ($0 \le p \le 100$), zero milestones handling, all-completed or all-upcoming scenarios, concurrent active milestones resolution, legacy single `imageUrl` fallback compatibility, external URL deletion skipping (Cloudinary/Unsplash), and boundary drag-and-drop actions.

### 1.2 Target System Personas
| Role Identifier | Role Name | System Privileges |
| :--- | :--- | :--- |
| **PUB** | **Public Visitor / Lead** | View public timeline (`/progress`), select properties with active milestones, inspect milestone dates, descriptions, completion percentages, and media galleries. |
| **USR** | **Client / Property Investor** | All Public privileges + track development progress on booked properties, inspect weighted overall completion rate, view phase pulse indicators. |
| **ADM** | **Operations / Project Admin** | Full access to Progress Manager (`/admin/progress`): add milestones, edit existing milestones, upload milestone media, reorder photos with drag-and-drop, delete milestones, manage storage cleanup. |
| **SAD** | **Super Admin / Security** | Full Admin privileges + audit RLS update policies on `public.properties`, govern `milestones` storage bucket policies, enforce data retention and zero orphan storage leaks. |

---

## 2. Requirements Traceability Matrix (RTM)

| Requirement ID | Subsystem Module | Covered Test Cases | Severity |
| :--- | :--- | :--- | :--- |
| **REQ-PRG-01** | Public Project Filtering & Selection | `TC-PUB-001`, `TC-PUB-002` | Critical |
| **REQ-PRG-02** | Public Timeline Node State & Visuals | `TC-PUB-003`, `TC-PUB-004` | Critical |
| **REQ-PRG-03** | Public Phase Progress & Gallery Layout | `TC-PUB-005`, `TC-PUB-006` | High |
| **REQ-PRG-04** | Investor Overall Project Progress Math | `TC-USR-001`, `TC-USR-002` | Critical |
| **REQ-PRG-05** | Investor Phase Tracking & Cross-Navigation | `TC-USR-003`, `TC-USR-004` | High |
| **REQ-ADM-06** | Admin Property Selection & Dirty Guards | `TC-ADM-001`, `TC-ADM-002` | High |
| **REQ-ADM-07** | Admin Milestone Form Validations & CRUD | `TC-ADM-003`, `TC-ADM-004`, `TC-ADM-005` | Critical |
| **REQ-ADM-08** | Drag-and-Drop Image Gallery Sorting | `TC-ADM-006` | Medium |
| **REQ-ADM-09** | Media Garbage Collection & Orphan Cleanup | `TC-ADM-007`, `TC-ADM-008` | Critical |
| **REQ-SAD-10** | Super Admin Database RLS Policies | `TC-SAD-001`, `TC-SAD-002` | Blocker |
| **REQ-SAD-11** | Storage Bucket Security & Cascading Deletes | `TC-SAD-003`, `TC-SAD-004` | Critical |
| **REQ-SAD-12** | Browser Beacon Orphan Garbage Collection | `TC-SAD-005`, `TC-SAD-006` | High |
| **REQ-EDG-13** | Percentage Clamping & Non-Numeric Bounds | `TC-EDG-001`, `TC-EDG-002` | High |
| **REQ-EDG-14** | Legacy Schema & External URL Resilience | `TC-EDG-003`, `TC-EDG-004` | High |
| **REQ-EDG-15** | Drag-and-Drop Boundary & Array Safety | `TC-EDG-005`, `TC-EDG-006` | Medium |

---

## 3. Test Cases: Public & Website Visitors (TC-PUB)

### TC-PUB-001: Project Filtering for Properties with Milestones
- **Role:** Public Visitor
- **Preconditions:** Properties collection loaded in `GlobalState`; some properties have empty milestones arrays, others have populated milestones.
- **Test Steps:**
  1. Evaluate `propertiesWithMilestones = properties.filter(p => p.milestones && p.milestones.length > 0)`.
  2. Verify that properties with `milestones: []` or `milestones: null` are excluded.
  3. Verify that properties with $\ge 1$ milestones are included.
- **Expected Result:** Only properties with active milestone data are exposed in the dropdown.

### TC-PUB-002: Default Project Selection & Dropdown Switching
- **Role:** Public Visitor
- **Test Steps:**
  1. Mount `ProjectProgress` with an initial empty `selectedProjectId`.
  2. Confirm `selectedProjectId` automatically defaults to `propertiesWithMilestones[0].id`.
  3. Toggle dropdown menu open/closed.
  4. Select a different project by ID.
- **Expected Result:** The selected project updates immediately and displays its corresponding timeline.

### TC-PUB-003: Public Empty State Display
- **Role:** Public Visitor
- **Test Steps:**
  1. Provide a properties array where none have milestones (`propertiesWithMilestones.length === 0`).
  2. Render `ProjectProgress`.
- **Expected Result:** Displays "No construction updates are available at this time." with a prominent link to `/projects`.

### TC-PUB-004: Timeline Node Icons & Color Mapping
- **Role:** Public Visitor
- **Test Steps:**
  1. Inspect milestone with `status: 'completed'`: Verify `CheckCircle` icon with green styling (`bg-viridian-600`).
  2. Inspect milestone with `status: 'current'`: Verify `Activity` icon with blue styling (`bg-blue-600 animate-pulse`).
  3. Inspect milestone with `status: 'upcoming'`: Verify `Calendar` icon with neutral gray styling (`bg-gray-200`).
- **Expected Result:** Node states visually distinguish the historical, active, and scheduled construction stages.

### TC-PUB-005: Phase Completion Percentage Bar Rendering
- **Role:** Public Visitor
- **Test Steps:**
  1. Render a milestone with `status: 'current'` and `percentage: 65`.
  2. Inspect DOM output for the progress bar container.
  3. Verify that completion percentage displays `65%` and inner bar has `style="width: 65%"`.
  4. Render milestones with `status: 'completed'` or `status: 'upcoming'`.
- **Expected Result:** Phase completion progress bar is rendered strictly for current in-progress milestones.

### TC-PUB-006: Responsive Image Grid Layout
- **Role:** Public Visitor
- **Test Steps:**
  1. Render a milestone with 1 image: Verify container uses single-column layout with `max-h-[400px]`.
  2. Render a milestone with $\ge 2$ images: Verify container uses responsive grid (`grid-cols-2 md:grid-cols-3 h-48`).
- **Expected Result:** Image presentation dynamically optimizes based on photo count without visual clipping.

---

## 4. Test Cases: User & Investor Milestone Tracking (TC-USR)

### TC-USR-001: Investor Project Overall Progress Calculation Formula
- **Role:** Client / Property Investor
- **Formula:**
  $$\text{basePercentage} = \left(\frac{\text{completed}}{\text{total}}\right) \times 100$$
  $$\text{currentPartial} = \begin{cases} \left(\frac{\text{percentage}}{100}\right) \times \left(\frac{100}{\text{total}}\right), & \text{if current milestone exists} \\ 0, & \text{otherwise} \end{cases}$$
  $$\text{overallPercentage} = \min(100, \max(0, \text{round}(\text{basePercentage} + \text{currentPartial})))$$
- **Test Steps:**
  1. Test scenario with 4 milestones: 2 completed, 1 current at 50%, 1 upcoming.
     - $\text{base} = (2/4) \times 100 = 50\%$
     - $\text{partial} = (50/100) \times (100/4) = 12.5\%$
     - $\text{overall} = \text{round}(50 + 12.5) = 63\%$.
  2. Test scenario with all 5 milestones completed $\to 100\%$.
  3. Test scenario with all 3 milestones upcoming $\to 0\%$.
- **Expected Result:** Calculations precisely reflect actual project advancement.

### TC-USR-002: Active Milestone Waterfall Resolution
- **Role:** Client / Property Investor
- **Test Steps:**
  1. Given milestone set with a current milestone: resolve `status === 'current'`.
  2. Given milestone set with no current milestone, but completed ones: resolve latest completed milestone (reversed find).
  3. Given milestone set with only upcoming milestones: resolve the initial milestone (`milestones[0]`).
- **Expected Result:** Investor widget always highlights the most relevant phase.

### TC-USR-003: Property Detail Progress Widget to Full Timeline Link
- **Role:** Client / Property Investor
- **Test Steps:**
  1. Inspect the "Construction Progress" widget in `Project.jsx`.
  2. Verify link target points to `/progress` with text "Full Timeline →".
- **Expected Result:** Smooth navigation from property marketing page to granular milestone documentation.

### TC-USR-004: Pulsing Glow on Active Construction Phase
- **Role:** Client / Property Investor
- **Test Steps:**
  1. Check rendering when current milestone is active.
  2. Verify presence of pulsing white shimmer overlay (`bg-white/20 animate-pulse`).
- **Expected Result:** Dynamic visual feedback reinforces live on-site construction activity.

---

## 5. Test Cases: Admin Operations & Progress Manager (TC-ADM)

### TC-ADM-001: Project Selector & Status Integration
- **Role:** Operations Admin
- **Test Steps:**
  1. Navigate to `/admin/progress`.
  2. Open project dropdown.
  3. Verify each list item displays property `name` alongside its `status` (e.g. "Ready", "Under Construction").
  4. Select a property and confirm milestone list populates.
- **Expected Result:** Admin clearly distinguishes properties across diverse construction lifecycle phases.

### TC-ADM-002: Unsaved Changes Guard (`adminUnsavedChanges`)
- **Role:** Operations Admin
- **Test Steps:**
  1. Fill or modify any field in `milestoneForm` (`adminUnsavedChanges` becomes `true`).
  2. Attempt to switch to another property or click Edit on another milestone.
  3. Verify that confirmation prompt (`window.confirm`) intercepts the action.
  4. If user cancels: preserve current form state and stay on current property.
  5. If user confirms: discard changes and switch context.
- **Expected Result:** Prevents accidental data loss of uncommitted milestone details.

### TC-ADM-003: Milestone Required Fields Validation
- **Role:** Operations Admin
- **Test Steps:**
  1. Attempt to submit milestone form with missing `title`: Form blocks submission / throws toast error.
  2. Attempt to submit with missing `date`: Form blocks submission.
  3. Attempt to submit with missing `description`: Form blocks submission.
  4. Submit with all 3 required fields provided: Form proceeds with save.
- **Expected Result:** Invalid or incomplete milestones cannot be persisted to Supabase.

### TC-ADM-004: Milestone Lifecycle Status Selection & Percentage Toggle
- **Role:** Operations Admin
- **Test Steps:**
  1. Select status `'upcoming'`: Completion percentage input is hidden.
  2. Select status `'completed'`: Completion percentage input is hidden.
  3. Select status `'current'`: Completion percentage input is revealed ($0-100\%$).
- **Expected Result:** UI intelligently adapts form inputs to the chosen lifecycle state.

### TC-ADM-005: Milestone Create & Edit In-Place Update
- **Role:** Operations Admin
- **Test Steps:**
  1. Save new milestone: Assigns generated ID (`generateId()`), appends to `properties.milestones` array, updates Supabase.
  2. Click Edit on existing milestone: Populates form with existing values and sets `editingMilestoneId`.
  3. Submit edited form: Updates matching milestone by ID in place without duplicating records.
- **Expected Result:** Accurate array mutation and persistence in PostgreSQL JSONB column.

### TC-ADM-006: Drag-and-Drop Image Gallery Reordering (@dnd-kit)
- **Role:** Operations Admin
- **Test Steps:**
  1. Provide milestone with 3 attached images: `['imgA.jpg', 'imgB.jpg', 'imgC.jpg']`.
  2. Trigger drag-and-drop move from index 2 to index 0 (`arrayMove(images, 2, 0)`).
  3. Verify order becomes `['imgC.jpg', 'imgA.jpg', 'imgB.jpg']`.
  4. Verify `adminUnsavedChanges` is flagged as `true`.
- **Expected Result:** Admin can intuitively reorganize photo sequences.

### TC-ADM-007: Image Removal & Deletion Queue (`imagesToDelete`)
- **Role:** Operations Admin
- **Test Steps:**
  1. Milestone contains attached images `['url1', 'url2']`.
  2. Admin clicks remove on `url1`.
  3. Confirm prompt accepted: `url1` removed from form images array, added to `imagesToDelete` queue.
  4. Save milestone: `deleteMedia('url1')` executed against Supabase Storage, queue cleared.
- **Expected Result:** Detached images are systematically purged from storage upon save.

### TC-ADM-008: Cancel Edit Rollback & Newly Uploaded Image Cleanup
- **Role:** Operations Admin
- **Test Steps:**
  1. Admin uploads 2 new images during editing (`newlyUploadedImages = ['new1', 'new2']`).
  2. Admin clicks Cancel Edit and confirms discard.
  3. Verify `new1` and `new2` are purged via `deleteMedia()`.
  4. Verify `imagesToDelete` queue is cleared without executing deletions.
- **Expected Result:** Storage never retains orphan assets from aborted edit sessions.

---

## 6. Test Cases: Super Admin Governance, RLS & Storage GC (TC-SAD)

### TC-SAD-001: Properties Milestones Database RLS Update Policy
- **Role:** Super Admin / Security
- **Policy:** `CREATE POLICY "properties_update" ON public.properties FOR UPDATE USING (is_admin());`
- **Test Steps:**
  1. Authenticate as Admin / Super Admin: Execute `UPDATE public.properties SET milestones = ... WHERE id = ...`. Verify status 200/Success.
  2. Authenticate as regular user (`role: 'user'`): Attempt same update.
  3. Verify PostgREST returns RLS rejection / 0 rows affected.
- **Expected Result:** Milestones modification is strictly reserved for administrative roles.

### TC-SAD-002: Milestones Storage Bucket Access Controls
- **Role:** Super Admin / Security
- **Policy:** `bucket_id = 'milestones'`
  - Read: Public (`SELECT USING (bucket_id = 'milestones')`)
  - Write: Admin (`INSERT WITH CHECK (bucket_id = 'milestones' AND is_admin())`)
  - Delete: Admin (`DELETE USING (bucket_id = 'milestones' AND is_admin())`)
- **Test Steps:**
  1. Public user downloads milestone image: HTTP 200 OK.
  2. Public user attempts direct storage upload or delete: Forbidden / RLS violation.
- **Expected Result:** Unauthenticated/non-admin users cannot alter construction media assets.

### TC-SAD-003: Milestone Deletion Cascades to Attached Storage Files
- **Role:** Super Admin
- **Test Steps:**
  1. Admin deletes a milestone with 3 attached images.
  2. Confirm dialog accepted.
  3. Verify `deleteMedia(url)` is invoked for each attached image.
  4. Verify milestone is excised from `properties.milestones`.
- **Expected Result:** No orphan media remains in Supabase storage after milestone deletion.

### TC-SAD-004: Browser Unmount Beacon Garbage Collection (`deleteMediaBeacon`)
- **Role:** Super Admin / Operations
- **Test Steps:**
  1. Admin uploads images to milestone form (`newlyUploadedImages = ['orphan1.jpg']`).
  2. Admin closes browser tab or navigates away without saving.
  3. Verify cleanup effect executes `deleteMediaBeacon('orphan1.jpg')` via `navigator.sendBeacon('/api/deleteMedia')`.
- **Expected Result:** Browser departures safely garbage-collect uncommitted media assets.

---

## 7. Test Cases: Edge Cases & Failure Modes (TC-EDG)

### TC-EDG-001: Completion Percentage Boundary Clamping
- **Test Steps:**
  1. Input `percentage = -15`: Clamp to `0%`.
  2. Input `percentage = 140`: Clamp to `100%`.
  3. Input `percentage = 'NaN'` or non-numeric: Default to `0%`.
- **Expected Result:** Completion metrics remain bounded between $0\%$ and $100\%$.

### TC-EDG-002: Zero Milestones Graceful Handling
- **Test Steps:**
  1. Property with `milestones: []`:
     - Overall project percentage returns `0%`.
     - Current milestone resolution returns `null`.
     - Admin timeline displays empty state placeholder.
- **Expected Result:** System never crashes with division-by-zero or undefined property errors.

### TC-EDG-003: All Completed vs All Upcoming Milestones
- **Test Steps:**
  1. All milestones `completed`: Overall progress is exactly `100%`.
  2. All milestones `upcoming`: Overall progress is exactly `0%`.
- **Expected Result:** Edge milestone sets resolve to expected boundary limits.

### TC-EDG-004: Legacy Single `imageUrl` vs Modern `images` Array Interoperability
- **Test Steps:**
  1. Milestone with modern `images: ['a.jpg', 'b.jpg']`: Resolves both images.
  2. Legacy milestone with `imageUrl: 'legacy.jpg'` and `images: undefined`: Resolves `['legacy.jpg']`.
  3. Milestone with both: Prefers `images` array.
  4. Milestone with neither: Resolves empty array `[]`.
- **Expected Result:** Full backward and forward compatibility with legacy database records.

### TC-EDG-005: External URL Storage Deletion Skipping
- **Test Steps:**
  1. Milestone contains external URL (e.g. `https://images.unsplash.com/...` or `res.cloudinary.com/...`).
  2. Call `deleteMedia(url)`.
  3. Verify function detects non-Supabase host, skips storage API call, logs warning, and returns `true`.
- **Expected Result:** No failed network requests or exceptions when removing external placeholder images.

### TC-EDG-006: Drag-and-Drop Boundary Conditions
- **Test Steps:**
  1. Move item to its identical position (`fromIndex === toIndex`): Returns identical array.
  2. Out of bounds index (`fromIndex < 0` or `toIndex >= length`): Safe fallback.
  3. Array with 0 or 1 items: Preserves array unchanged.
- **Expected Result:** `@dnd-kit` sorting logic never corrupts image collections.

### TC-EDG-007: Multiple Concurrently Active Milestones
- **Test Steps:**
  1. Data anomaly where two milestones have `status: 'current'`.
  2. Verify calculation formula and UI resolver safely handle the scenario without infinite loops or duplicate bars.
- **Expected Result:** First current milestone is selected for primary status display.

### TC-EDG-008: Special Characters & HTML Injections in Milestone Notes
- **Test Steps:**
  1. Provide description containing `<script>alert(1)</script>` and multiline quotes.
  2. Verify React safely escapes text and preserves newline formatting.
- **Expected Result:** Zero XSS vulnerability; content displayed verbatim safely.

---

## 8. Test Execution Guidelines & Quality Acceptance Criteria

1. **Test Environment:** Vitest runner with JSDOM / Node environment.
2. **Quality Gates:**
   - 100% of Progress test suites must execute and pass.
   - Zero test regressions on existing subsystems (Booking, Property, Messaging).
   - Zero production build warnings or syntax errors.
