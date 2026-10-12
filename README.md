# Subha Vivaham — Premium Matrimony Platform

Full-stack codebase for **Subha Vivaham** ("சுப விவாஹம்"), a premium Tamil Nadu matrimony platform ("Connecting hearts, bringing families together"). The app is **Supabase-only**: there is no mock mode and no data-mode switch. Page data is read from a real Supabase Postgres database (plus Auth and Storage), and with no credentials the app warns loudly instead of quietly serving bundled sample rows.

> **`code_documentation.md` is the authoritative, deep reference.** This README is the quick orientation. When the two disagree, the detailed file wins.

---

## Tech Stack

| Layer | Technology | Notes |
| --- | --- | --- |
| Framework | **Next.js 16.3.5** (App Router, Turbopack) | Server components by default, `"use client"` where needed |
| UI | **React 19.2.8** | Hooks + Context, no Redux |
| Language | **TypeScript 5** (strict) | Path alias `@/*` → `./src/*` |
| Styling | **Tailwind CSS 4** (`@tailwindcss/postcss`) | Design tokens via `@theme` in `globals.css` |
| Icons | **lucide-react** | |
| Styling utils | **clsx** + **tailwind-merge** | `cn()` helper |
| Backend | **@supabase/ssr 0.7 + @supabase/supabase-js** | The only data layer — Postgres + Auth + Storage |
| Email | **resend** | Server-only transactional mail for member + vendor registrations |
| Fonts | `next/font/google` | Inter (sans) + Playfair Display (display) |
| Lint | **ESLint 9** (`eslint-config-next`, core-web-vitals + TS) | |
| Package manager | npm | Node 22.x |

Scripts (`package.json`):

```bash
npm run dev        # start dev server (Turbopack)
npm run build      # production build
npm run start      # serve production build
npm run lint       # ESLint over the project
```

Typecheck (not a script; run directly):

```bash
npx tsc --noEmit
```

---

## Environment

`.env` and `.env.local` are both gitignored. There is no tracked `.env.example`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes (preferred) | Browser + server clients. Falls back to `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `JATHAGAM_API_URL` | for `/jathagam` | Astrology engine endpoint (server only) |
| `JATHAGAM_API_KEY` | no | Optional `Authorization: Bearer` (self-hosted engines only) |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Server-only privileged client (`src/lib/supabase/admin.ts`) |
| `RESEND_API_KEY` | to send mail | Resend transactional email |
| `EMAIL_FROM` | no | From header (defaults to `Subha Vivaham <onboarding@resend.dev>`) |
| `VENDOR_NOTIFY_EMAIL` | no | Registration notice inbox (defaults to `subhavivaham2017@gmail.com`) |

> Never prefix a server-only secret with `NEXT_PUBLIC_` — those values are inlined into the client bundle at build time. `NEXT_PUBLIC_*` changes need a rebuild, not just a dev-server restart.

---

## Database

The schema, RLS, triggers, storage buckets and seed all ship as root-level SQL files, run **in this order** (there is no `migrations/` folder):

1. `table_deletion_query.md` — teardown
2. `table_creation.md` — tables, columns, indexes, buckets, triggers, functions, storage policies, the `site_config` row
3. `table_policies.sql` — all `enable row level security` + policies
4. `primary_seed.sql` — communities + `membership_plans` (idempotent)
5. `seed_data.sql` — users, profiles, photos, interests, service providers, temples + children (idempotent)
6. `success_stories_seed.sql` — stories (plain `INSERT`, no `on conflict`)

`tables_document.md` is a reference companion describing each table. Every seed file **except `success_stories_seed.sql`** is idempotent and safe to re-run. There is no local Postgres/Docker in this environment — paste the files into the Supabase SQL editor and verify with `select … from pg_policies`.

---

## Project Structure

```
src/
├── proxy.ts                  # Session-refresh proxy (Next 16, replaces middleware.ts)
├── app/                      # Next.js App Router (routes = thin page compositions)
│   ├── layout.tsx            # Root layout: fonts, metadata, AppProviders
│   ├── globals.css           # Tailwind v4 @theme tokens + global styles
│   ├── (public)/             # Marketing / guest routes (layout: Header + Footer)
│   │   ├── page.tsx          # Home page
│   │   ├── login/  register/  jathagam/
│   │   ├── services/  vendor-register/       (+ actions.ts)
│   │   ├── temples/ (+ [temple_id])  communities/ (+ [id])
│   │   └── success-stories/ (+ [id])  membership/
│   ├── (app)/                # Members-area routes (session-gated)
│   │   ├── layout.tsx        # getCurrentMember() gate + DashboardShell wrapper
│   │   ├── dashboard/ (+ /preferences, /profile)
│   │   ├── matches/  interests/  search/  brides/  grooms/
│   │   └── profile/[id]/
│   └── (admin)/              # Admin area (real Supabase Auth + JWT claim)
│       ├── admin/login/
│       └── admin/(protected)/  # dashboard, users, profiles, communities,
│                               # memberships, services, temples, config
├── components/               # Reusable UI + page components (no route logic)
│   ├── layout/               # header, footer, dashboard-shell, dashboard-nav, admin-shell
│   ├── home/                 # hero, why-us, how-it-works, success-stories, trust-faq, cta
│   ├── profile/  search/  jathagam/  brand/
│   ├── membership/           # pricing-plans, membership-card, plan-checkout
│   ├── admin/                # table kit + every admin manager + config-form
│   ├── forms/                # login-form, register-form, vendor-register-form
│   ├── providers/            # AppProviders (context composition)
│   └── ui/                   # button, badge, avatar, modal, field, …, states, skeleton
├── features/                 # Domain logic + fallback seed (one folder per feature)
│   ├── auth/                 # auth-provider.tsx (AuthProvider, useAuth)
│   ├── profiles/             # queries.ts (search/match/stats), data.ts (fallback seed)
│   ├── search/  communities/  stories/  membership/  temples/
│   ├── interests/            # data.ts → DB loader (server-only)
│   └── services/             # types.ts, data.ts (unused localStorage), notify.ts (Resend)
├── types/                    # index.ts — all domain types (Profile, Interest, …)
└── lib/
    ├── data/                 # mode.ts (resolver), queries.ts, admin-queries.ts,
    │                         # member-dal.ts, admin-dal.ts, mappers.ts
    ├── supabase/             # client.ts, server.ts, proxy.ts, admin.ts (service role)
    ├── payments/             # quotas.ts (per-plan photo/interest limits)
    ├── constants.ts          # BRAND identity, ADMIN_NAV, CONTAINER, form option lists
    ├── registration.ts       # wizard constants + per-step validation
    ├── utils.ts              # cn, formatRelativeTime, ageFromDateOfBirth, uid, …
    └── state/                # toast-provider.tsx
```

Design decisions:

- **`app/` is thin** — `page.tsx` files compose components and own metadata only; business logic lives in `features/` + `components/`.
- **`features/<name>/queries.ts`** = read functions, **`actions.ts`** = mutations, **`data.ts`** = fallback seed, **`types.ts`** = feature-local types.
- Everything imports via the `@/…` alias, never relative cross-folder paths.

---

## Routing (App Router)

| Route | Group | Purpose |
| --- | --- | --- |
| `/` | `(public)` | Marketing home |
| `/login`, `/register` | `(public)` | Member sign-in + 8-step registration |
| `/jathagam` | `(public)` | Natchathram porutham calculator (external API via server actions) |
| `/services`, `/vendor-register` | `(public)` | Public vendor directory + vendor submission |
| `/temples`, `/temples/[temple_id]` | `(public)` | Temple directory + detail |
| `/communities` (+ `/[id]`) | `(public)` | Community directory |
| `/success-stories` (+ `/[id]`) | `(public)` | Success stories |
| `/membership` | `(public)` | Pricing plans + manual UPI checkout |
| `/dashboard` (+ `/preferences`, `/profile`) | `(app)` | Member home |
| `/matches`, `/interests` | `(app)` | Matches + received/sent interests |
| `/search`, `/brides`, `/grooms` | `(app)` | Profile browser (member-only) |
| `/profile/[id]` | `(app)` | Profile detail (premium contact details via service role) |
| `/admin`, `/admin/*` | `(admin)` | Admin console (9 routes incl. `/admin/login`) |

Layout groups:

- **Root** — fonts, metadata, wraps everything in `AppProviders`.
- **`(public)`** — `Header` + `main` + `Footer`.
- **`(app)`** — server gate via `getCurrentMember()` → `redirect("/login")`, then `DashboardShell`.
- **`(admin)`** — `requireAdmin()` in the `(protected)` layout; real Supabase Auth `app_metadata.role === "admin"` claim.
- **`src/proxy.ts`** — optimistic cookie check for `/admin*` (fast path only); real authorization is the server DAL.

> After any code change, verify with `npx tsc --noEmit` and `npm run lint`.

---

## Data Layer (Supabase only)

`src/lib/data/mode.ts` is a resolver, not a mode switch — it exposes `isSupabaseConfigured` and the URL/key. There is **no `NEXT_PUBLIC_DATA_MODE`**; a flag once let a deployment quietly fall back to bundled seed rows.

Supabase clients (`src/lib/supabase/`):

- `client.ts` — browser client (`getSupabase()`), throws a clear "not configured" error when creds are missing.
- `server.ts` — server client (`getSupabaseServer()`) via `createServerClient` + `cookies()`.
- `proxy.ts` — `updateSession(request)` cookie-refresh helper wired into `src/proxy.ts`.
- `admin.ts` — `getSupabaseAdmin()`, the service-role client (server-only, bypasses RLS).

Loaders:

| Module | Runtimes | Notes |
| --- | --- | --- |
| `lib/data/queries.ts` | isomorphic, client-safe | public tables only |
| `lib/data/admin-queries.ts` | server-only | all admin screens; **no seed fallback** |
| `lib/data/member-dal.ts` | server-only | `getCurrentMember()` — session-validated |
| `lib/data/admin-dal.ts` | server-only | `getCurrentAdmin()` / `requireAdmin()` / `assertAdmin()` |
| `features/interests/data.ts` | server-only | DB-backed interests |
| `lib/payments/quotas.ts` | takes a client arg | per-plan photo/interest limits |

`queries.ts` must **never** statically import anything that reaches `next/headers` — client components import it. Private loaders belong in `admin-queries.ts`.

---

## Auth

- **Admin** — real Supabase Auth with an **app-metadata JWT claim** `{"role": "admin"}`. Gated in four layers: the proxy cookie fast-path, `requireAdmin()` in the `(protected)` layout, `requireAdmin()` again in every protected page, and `assertAdmin()` in every action + RLS on the claim. Promote a user under Supabase → Authentication → Users → Edit.
- **Members** — real Supabase Auth, **email + password only** (no Google provider, no phone login). `AuthProvider` exposes `user`, `login`, `registerWithProfile`, `logout`, `isLoggedIn`, `isLoading` — **no role flag**. Registration writes auth → `users` → `profiles` → `profile_photos` through the `registerMember` server action. **Confirm Email must be OFF.**

---

## Key Implementation Notes

- **Membership checkout is live but manual** — a member pays by UPI, uploads a screenshot (`payment_screenshots` bucket), and an admin approving the `membership_payments` request is what grants the plan. Per-plan limits come from `src/lib/payments/quotas.ts` (Free 1 photo / 3 interests, Silver 5 / 25, Premium 10 / unlimited).
- **Review gates** — `service_providers` is gated on `is_approved and active` and enforced by RLS. `temples` carries the same gates, but `temples_read` is still `using (true)` — the gates are **not yet enforced** on the temple read path (see the Temples section of `code_documentation.md`).
- **`next.config.ts`** allows `remotePatterns` for `images.unsplash.com`, `randomuser.me`, `*.supabase.co` and `upload.wikimedia.org`, and pins `experimental.serverActions.allowedOrigins` to the deployment host — this must match the Vercel host or every server action (admin login included) fails on the CSRF check.
- **`src/proxy.ts`** replaces the deprecated `middleware.ts` in Next 16; keep the filename/export (`proxy`) intact.
- **Keep `app/` thin**: new pages compose `components/*`; new data/logic goes into `features/<domain>/` (`queries.ts`, `actions.ts`, `data.ts`, `types.ts`).
- Use `cn()` from `@/lib/utils` for conditional className merging, and follow the component style in `src/components/ui/*`.

---

## Brand Identity

Central brand facts in `src/lib/constants.ts` → `BRAND`:

- Name **Subha Vivaham** (`சுப விவாஹம்`), tagline "Traditional Values. Meaningful Matches."
- Website `https://www.subhavivaham.com`, proprietor **S. Ramalingam Pillai**
- Phone / WhatsApp `+91 88839 43711` (`88839 43711`), landline `04630 - 261186`, email `subhavivaham2017@gmail.com`
- GSTIN `33NPV5847N1Z5`
- Offices (both Tuticorin): Office 1 — `1-56/1, Sub Register Off Street, Murappanadu, Tuticorin - 628 252`; Office 2 — `3/58, Natarajar Sannathi Street, Vallanadu, Tuticorin - 628 252`
- Socials: Instagram, Facebook, X (placeholder links)

### Design tokens (`src/app/globals.css`, Tailwind v4 `@theme`)

Wine palette is **maroon** (naming kept for legacy compatibility): `wine-700 #7a1832`, `wine-800 #61122a`, `wine-500 #b53a63`. Gold `gold-500 #d4af37`, `gold-600 #b9942c`. Backgrounds `ivory-50 #fffdf4`, text `charcoal-900 #252525`. Plus `shadow-card`, `shadow-card-hover`, `shadow-soft`, and keyframe animations (`fade-in`, `scale-in`, `slide-up`, `slide-in-right`).

Fonts: Inter (sans, body) and Playfair Display (display, headings) via `next/font/google`.
