# Viridian Nexus

Viridian Nexus is a luxury real estate web application and property operations portal built with **TypeScript**, **React 19**, **Vite 8**, **Tailwind CSS 3**, and **Supabase**.

## Tech Stack

- **Frontend:** TypeScript (strict mode), React 19, React Router 7, Tailwind CSS 3, Framer Motion, Lucide React, React Toastify, `@dnd-kit`
- **Backend & Storage:** Supabase (Authentication, PostgreSQL with Row-Level Security & RPC functions, Realtime subscriptions, and Storage buckets)
- **Serverless Backend APIs:** `/api/deleteMedia` and `/api/notifyInquiry` supporting both Vercel ([api/deleteMedia.ts](api/deleteMedia.ts), [api/notifyInquiry.ts](api/notifyInquiry.ts)) and Cloudflare Pages Functions ([functions/api/deleteMedia.ts](functions/api/deleteMedia.ts), [functions/api/notifyInquiry.ts](functions/api/notifyInquiry.ts))
- **Testing & Quality:** Vitest, `oxlint`, strict `tsc --noEmit`

## Project Structure

```text
├── api/deleteMedia.ts            # Vercel serverless endpoint for authenticated media deletion
├── functions/api/deleteMedia.ts  # Cloudflare Pages Function equivalent for /api/deleteMedia
├── src/
│   ├── components/               # Shared UI, navigation, route guards & home sections
│   ├── context/                  # AuthContext & GlobalState providers
│   ├── data/                     # Static editorial content (journal articles)
│   ├── hooks/                    # Custom React hooks
│   ├── pages/                    # Public pages, client Dashboard (/dashboard/*), and Admin (/admin/*)
│   ├── types/                    # Shared TypeScript interfaces and DB row definitions
│   ├── utils/                    # DB mappers, stage gates, formatting, URL & storage helpers
│   ├── App.tsx                   # Application router and route guards
│   ├── main.tsx                  # React root entry point
│   └── supabase.ts               # Supabase client & JWT session token helpers
├── tests/                        # Vitest test suites and pure domain logic helpers
├── supabase_schema.sql           # PostgreSQL tables, RLS policies, RPCs & storage buckets
├── tsconfig.json                 # Strict TypeScript compiler configuration
├── vercel.json                   # Vercel SPA rewrite & build configuration
└── .env.example                  # Required environment variables template
```

## Prerequisites

- **Node.js** & **npm**
- A **Supabase** project

## Local Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
Create a `.env` file in the project root from [.env.example](.env.example):

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```bash
# macOS / Linux
cp .env.example .env
```

Populate `.env` with your Supabase project credentials (**Project Settings -> API**):

```env
# Root Project URL (do NOT include /rest/v1)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

> **Security note:** Keep `SUPABASE_SERVICE_ROLE_KEY` strictly server-side (without a `VITE_` prefix). It is used only by the `/api/deleteMedia` serverless handlers and must never be exposed to browser bundles.

### 3. Initialize Supabase schema & storage
In your Supabase Dashboard **SQL Editor**, run [supabase_schema.sql](supabase_schema.sql) to set up:
- Core tables (`profiles`, `properties`, `bookings`, `booking_payments`, `booking_activity_log`, `booking_requests`, `inquiries`, `newsletter_subscribers`, `wishlist`, `notifications`, `settings`)
- Row-Level Security (RLS) policies and admin-checked RPC functions
- Public Storage buckets (`property-media`, `brochures`, `milestones`, `avatars`) and their access policies

### 4. Start the local dev server
```bash
npm run dev
```

On Windows PowerShell, if `node`/`npm` is not on your current `PATH`:
```powershell
$env:PATH += ";C:\Program Files\nodejs"; & "C:\Program Files\nodejs\npm.cmd" run dev
```

Open the local URL printed by Vite in your browser.

> **Note on `/api/deleteMedia`:** `npm run dev` starts the Vite frontend only. To test media cleanup locally against `/api/deleteMedia`, run via `vercel dev` or `npx wrangler pages dev dist`.

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start Vite local development server |
| `npm run build` | Build production client bundle to `dist/` |
| `npm run preview` | Preview the built `dist/` bundle locally |
| `npm test` | Run all Vitest test suites (`vitest run`) |
| `npx tsc --noEmit` | Run strict TypeScript type-checking across `src/`, `api/`, `functions/`, `tests/`, and `vite.config.ts` |
| `npm run lint` | Run `oxlint` static analysis |

## Security & Architecture Notes

- **Strict TypeScript:** Configured with `strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, and `verbatimModuleSyntax`.
- **Session Expiration & Idle Timeout:**
  - **Client ([src/utils/sessionManager.ts](src/utils/sessionManager.ts), [src/context/GlobalState.tsx](src/context/GlobalState.tsx)):** Enforces role-based inactivity timeouts (`7 days` for users, `2 hours` for `admin`/`super_admin`), absolute max session lifetimes (`14 days` for users, `24 hours` for admins), cross-tab sign-out/activity sync, and sleep/reload expiration checks.
  - **Database RLS ([supabase_schema.sql](supabase_schema.sql)):** `public.is_session_valid()` validates the active `auth.sessions` record (`session_id`, `not_after`, non-banned `profiles` status, and server `created_at` age cap of `24 hours` for admins / `14 days` for users) on protected queries and storage policies—closing post-logout JWT replay and indefinite refresh token bypasses.
  - **Recommended Supabase Auth Dashboard settings:** Enable **Refresh Token Rotation / Reuse Detection** under **Authentication -> Sessions** (and, on Pro+ plans, configure **Time-box user sessions** and **Inactivity timeout** to align GoTrue token pruning with the policy above).
- **URL & Redirect Sanitization:** [src/utils/urlHelpers.ts](src/utils/urlHelpers.ts) validates external `http(s)` URLs, YouTube embeds, internal redirect paths, `tel:` / `mailto:` links, and Supabase Storage asset paths to prevent `javascript:` / open-redirect / path-traversal issues.
- **Serverless Media Cleanup Protection:** [api/deleteMedia.ts](api/deleteMedia.ts) and [functions/api/deleteMedia.ts](functions/api/deleteMedia.ts) require a Bearer JWT token, verify non-banned `admin` or `super_admin` privileges against `profiles`, enforce active server session validity (`is_session_valid`), check expected Supabase origin matching, and reject unsafe storage paths.
- **Automated WhatsApp Inquiry Alerts:** All public client inquiries (`Contact`, `VIP Consultation Modal`, `Property Details`, `Journal Dossier`) call [src/utils/inquiryNotifications.ts](src/utils/inquiryNotifications.ts), which persists to `public.inquiries` and triggers `/api/notifyInquiry` ([src/utils/inquiryWhatsAppServer.ts](src/utils/inquiryWhatsAppServer.ts)). The server verifies the stored database record, resolves the website's linked `whatsappNumber` from `settings` (`key = 'site'`), formats a structured executive brief via [src/utils/inquiryWhatsApp.ts](src/utils/inquiryWhatsApp.ts), and dispatches via **Meta WhatsApp Cloud API** (text or 7-parameter approved template `{{1}}..{{7}}` for reference, category, client name, phone, email, subject, brief), **Twilio WhatsApp API**, or a **Webhook Gateway** (Make/Zapier/n8n/WATI/Evolution API). Keep all WhatsApp provider credentials strictly server-side without `VITE_` prefixes.
- **Database & Storage Governance:** Database mutations and storage bucket writes (`property-media`, `brochures`, `milestones`, and user-scoped `avatars`) are protected by Supabase RLS and role checks in [supabase_schema.sql](supabase_schema.sql).

## Deployment

### Vercel (Current Hosting Configuration)
[vercel.json](vercel.json) is configured for Vite (`dist/` output) with SPA rewrites excluding `/api/*` so [api/deleteMedia.ts](api/deleteMedia.ts) handles serverless requests. See [vercel_deployment_guide.md](vercel_deployment_guide.md) for Vercel CLI, DNS, and environment variable steps.

### Cloudflare Pages (Alternative)
1. Connect your repository in **Cloudflare Dashboard -> Workers & Pages**.
2. Set build command to `npm run build` and output directory to `dist`.
3. Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in Cloudflare Pages environment variables (the Functions runtime picks up [functions/api/deleteMedia.ts](functions/api/deleteMedia.ts) automatically).
