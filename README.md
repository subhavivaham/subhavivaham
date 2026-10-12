# Subha Vivaham — Premium Matrimony Platform

Front-end codebase for **Subha Vivaham**, a premium Tamil Nadu matrimony platform ("Connecting hearts, bringing families together"). The app is **mode-based**: it runs by default in **mock mode** — all profiles and interests run on seed data persisted in `localStorage`, so the whole experience works without a backend. When Supabase credentials are supplied it can run in **supabase mode** against a real backend.

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
| Backend (optional) | **@supabase/ssr 0.7 + @supabase/supabase-js** | Used only in supabase mode; mock data is used until it is configured |
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

## Project Structure

```
src/
├── proxy.ts                  # Session-refresh proxy (Next 16, replaced middleware.ts); inert until supabase mode
├── app/                      # Next.js App Router (routes = pages; thin compositions only)
│   ├── layout.tsx            # Root layout: fonts, metadata, AppProviders
│   ├── globals.css           # Tailwind v4 @theme tokens + global styles
│   ├── icon.png              # Favicon (generated from the logo)
│   ├── (public)/             # Marketing / guest routes (layout: Header + Footer)
│   │   ├── page.tsx          # Home page (hero, featured, how-it-works, pricing, FAQ…)
│   │   ├── search/  login/  register/  jathagam/
│   │   ├── grooms/  brides/  # thin routes rendering SearchView with a gender
│   │   ├── communities/ (+ [id])  success-stories/ (+ [id])
│   │   └── membership/  profile/[id]/
│   ├── (app)/                # Members-area routes (access-guarded)
│   │   ├── layout.tsx        # Demo-login gate + DashboardShell wrapper
│   │   ├── dashboard/ (+ /preferences, /profile)
│   │   ├── matches/  interests/
│   └── (admin)/              # Admin area: layout.tsx + admin/{page,communities,jathagam,memberships,profiles,reports,success-stories,users}
├── components/               # Reusable UI + page components (no route logic)
│   ├── layout/               # header, footer, dashboard-shell, dashboard-nav, admin-shell
│   ├── home/                 # hero, why-us, how-it-works, success-stories, trust-faq, cta
│   ├── profile/              # profile-card, profile-view, photo-gallery, actions
│   ├── search/               # search-view, search-widget, search-filters
│   ├── membership/           # pricing-plans, membership-card
│   ├── forms/                # login-form, register-form
│   ├── jathagam/             # jathagam-calculator
│   ├── brand/                # logo
│   ├── providers/            # AppProviders (context composition)
│   └── ui/                   # button, badge, avatar, modal, field, checkbox, …, states, skeleton
├── features/                 # Domain logic + seed data (one folder per feature)
│   ├── auth/                 # auth-provider.tsx  (AuthProvider, useAuth, DEMO_USER, ADMIN_USER)
│   ├── profiles/             # queries.ts (search/match scoring/stats), data.ts (seed)
│   ├── search/               # types.ts (SearchFilters, SortKey), helpers.ts (queryString/parseQuery)
│   ├── communities/  stories/  membership/   # data.ts (seed)
│   ├── interests/            # data.ts (seed)
│   └── jathagam/             # service.ts (porutham), data.ts (nakshatras)
├── hooks/                    # (removed with the fake-loading optimization)
├── types/                    # index.ts — all domain types (Profile, Interest, …)
└── lib/
    ├── data/                 # mode.ts (mock/supabase resolver)
    ├── supabase/             # client.ts (browser), server.ts, proxy.ts (updateSession) — gated on env vars
    ├── constants.ts          # BRAND identity, DEMO_CREDENTIALS, nav, form option lists
    ├── utils.ts              # cn, formatRelativeTime, ageFromDateOfBirth, uid, …
    └── state/                # demo-store.tsx (mock state), toast-provider.tsx
```

Design decisions:
- **`app/` is thin** — `page.tsx` files compose components and own metadata only; business logic lives in `features/` + `components/`.
- **`features/<name>/queries.ts`** = read functions, **`actions.ts`** = mutations, **`data.ts`** = seed/demo data, **`types.ts`** = feature-local types. Supabase implementations will be dispatched behind these files in prod mode (see [Data Mode](#data-mode-mock-vs-supabase)).
- Moving a page to `components/` (or a query to `features/`) is always safe: everything imports via the `@/…` alias, never relative cross-folder paths.

---

## Routing (App Router)

| Route | Group | Purpose |
| --- | --- | --- |
| `/` | `(public)` | Marketing home |
| `/search` | `(public)` | Browse + filter profiles (query params drive filters) |
| `/grooms`, `/brides` | `(public)` | Search presets for grooms / brides (thin wrappers) |
| `/login` | `(public)` | Sign in / demo login |
| `/register` | `(public)` | Multi-step registration |
| `/jathagam` | `(public)` | Natchathram porutham calculator |
| `/community` list + `/communities/[id]` | `(public)` | Community directory + member listing |
| `/success-stories` (+ `/[id]`) | `(public)` | Success stories |
| `/membership` | both | Pricing plans + checkout modal |
| `/profile/[id]` | `(public)` | Public profile detail view |
| `/dashboard` (+ `/preferences`, `/profile`) | `(app)` | Member home: stats, recommendations, interests |
| `/matches` | `(app)` | Recommended / new / nearby / recently active |
| `/interests` | `(app)` | Received & sent interests |
| `/admin` (+ `/admin/*`) | `(admin)` | Admin console (profiles, users, communities, plans, stories, jathagam, reports) |

Layout groups:

- **Root** (`src/app/layout.tsx`) — fonts, metadata, wraps everything in `AppProviders`.
- **`(public)` layout** — `Header` + `main` + `Footer`. Marketing pages.
- **`(app)` layout** — client component that shows a login gate (`demoLogin()` / sign-in) when there is no active user, and renders `DashboardShell` (sidebar nav + topbar) when logged in.
- **`(admin)` layout** — gates on `isAdmin` and renders `AdminShell`.
- **`src/proxy.ts`** — session-refresh proxy (Next 16 renamed `middleware.ts` → `proxy.ts`). It is a no-op passthrough until supabase mode is enabled; route protection currently lives in the `(app)`/`(admin)` layouts.

> **Read the framework docs before editing:** this project ships `node_modules/next/dist/docs/`. Next.js (and App Router conventions) may differ from what you expect — see `AGENTS.md`.
> After any code change, verify with `npx tsc --noEmit` and `npm run lint`.

---

## Data Mode (mock vs Supabase)

The app resolves its data source once, in `src/lib/data/mode.ts`:

- `dataMode` → `"mock" | "supabase"`
- `isMockMode` / `isSupabaseMode` → booleans for conditionals
- `isSupabaseConfigured` → whether credentials were supplied


| Variable | Dev | Prod | Used by |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_DATA_MODE` | `dev` (or `mock` / unset) | `prod` (or `supabase`) | `lib/data/mode.ts` |
| `NEXT_PUBLIC_SUPABASE_URL` | — | required | supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | required | browser client |

Supabase layer (`src/lib/supabase/`), split for the three runtimes:

- `client.ts` — browser client via `createBrowserClient`; `getSupabase()` throws a clear "not configured" error when creds are missing.
- `server.ts` — server `getSupabaseServer()` via `createServerClient` + `cookies()`.
- `proxy.ts` — `updateSession(request)` cookie-refresh helper wired into `src/proxy.ts`.

All three short-circuit in mock mode. Per-query Supabase dispatch behind `features/*/queries.ts` lands with the backend workstream (schema, RLS, generated types) — until then the mock path is the only active implementation.

---

## State & Data Flow

All global state lives in React Context, composed in `src/components/providers/app-providers.tsx`:

```
ToastProvider → AuthProvider → DemoStoreProvider → pages
```

### `ToastProvider` (`src/lib/state/toast-provider.tsx`)
- `useToast()` → `toast(message, kind?)` where kind is `success | error | info`.
- Top-right fixed stack, auto-dismisses after 3.5s, caps at 4 visible.

### `AuthProvider` (`src/features/auth/auth-provider.tsx`)
- Tracks the logged-in user (`AppUser`), persisted to `localStorage` key `Subha Vivaha_demo_user`.
- API: `login(email, password)`, `demoLogin()`, `googleLogin()`, `registerWithProfile(name, email, profileId)`, `logout()`, plus `isLoggedIn`, `isLoading`, `isAdmin`.
- `DEMO_USER` (login persona) and `ADMIN_USER` are predefined; demo login accepts either the demo email or username `praveen`.
- On restore, the demo user’s name is re-synced to `DEMO_CREDENTIALS.name`.

### `DemoStoreProvider` (`src/lib/state/demo-store.tsx`)
- Holds all demo-interactive data: interests.
- Every slice is seeded from `features/*/data.ts` and persisted to a dedicated `localStorage` key:

| Slice | localStorage key |
| --- | --- |
| Auth/session | `Subha Vivaha_demo_user` |
| Interests | `Subha Vivaha_demo_interests` |

- `useDemoStore()` exposes actions like `sendInterest`, `updateInterestStatus`, and derived counts.

---

## Features (logic layer)

Domain logic lives in `src/features/`, grouped by feature, no React/route imports in the data files:

### `features/profiles/`
- `queries.ts` — pure functions, no React:
  - `searchProfiles(filters, sort)` — filters the seed profiles (`gender`, `age`, `location`, `religion`, `community`, `motherTongue`, `education`, `profession`, `maritalStatus`, `height`, `diet`, `drinking`, `smoking`, `income`, `withPhoto`) and sorts by `recommended | recently-active | newest | age`.
  - `computeMatchScore(profile, current)` — weighted match scoring (age, location, religion/community, education, profession, lifestyle) producing a 74–99 match %.
  - `getRecommendedMatches`, `getNewMatches`, `getNearbyMatches`, `getRecentlyActive`, `getFeaturedProfiles`, `getDashboardStats` — convenience queries for sections.
- `data.ts` — seed profile list; exports `profiles`, `getProfileById`, `DEMO_PROFILE`, `CURRENT_USER_ID`.

### `features/search/`
- `types.ts` — `SearchFilters` + `SortKey` (shared by `profiles/queries.ts` and the search components).
- `helpers.ts` — `queryString()` / `parseQuery()` for keeping filters in the URL.

### `features/jathagam/`
- `service.ts` — `calculatePorutham()`, `verdictFor()`, `PoruthamStatus`.
- `data.ts` — nakshatras, `RASI_NAMES`, `RASI_TAMIL`, `GANA_TAMIL`.

### Other feature folders
- `auth/auth-provider.tsx` — the auth context (see State & Data Flow).
- `communities/data.ts` — community directory (`communities`, `getCommunityById`, `profileCommunityNames`, `profileCountFor`).
- `stories/data.ts` — success stories (`successStories`, `getStoryById`).
- `membership/data.ts` — Free / Gold / Premium plans + match-score breakdown (`membershipPlans`).
- `interests/data.ts` — seed `demoInterests`.

---

## Brand Identity

Central brand facts in `src/lib/constants.ts` → `BRAND`:

- Name **Subha Vivaham**, tagline "Connecting hearts, bringing families together."
- Website `https://www.Subha Vivaha.com`, proprietor **S.Ramalingam Pillai**
- Phone / WhatsApp `+91 88839 43711` (whatsapp: `88839 43711`), landline `04630 - 261186`, email `hello@Subha Vivaha.com`
- GSTIN `33NPV5847N1Z5`
- Offices: Office 1 — `1-56/1, Sub Register Off Street, Murappanadu, Tuticorin - 628 252`; Office 2 — `3/58, Natarajar Sannathi Street, Vallanadu, Tuticorin - 628 252`
- Socials: Instagram, Facebook, X (placeholder links)

### Design tokens (`src/app/globals.css`, Tailwind v4 `@theme`)

Wine palette is green (naming kept for legacy compatibility): `wine-700 #087A45`, `wine-800 #075B35`, `wine-50 #EAF6EF`. Gold/saffron `gold-500 #EFA343`, `gold-600 #D98224`. Backgrounds `ivory-50 #FFFDF7`, text `charcoal-900 #252525`. Plus `shadow-card`, `shadow-card-hover`, and keyframe animations (`fade-in`, `scale-in`, `slide-up`, `slide-in-right`).

Fonts: Inter (sans, body) and Playfair Display (display, headings) via `next/font/google`.

---

## Key Implementation Notes

- **`next.config.ts`** allows `remotePatterns` for `images.unsplash.com` and `randomuser.me`, but all current imagery is local (`src/assets/*`). Remote entries can stay if hero/success images ever return to stock URLs.
- **Images**: components use Next `<Image>`; photo galleries derive URLs from `ProfilePhoto.url` via `Image` unoptimized or local imports where seeds reference imported assets.
- **No comments policy**: source files do not contain explanatory inline comments (only a few `// ignore ...` lint suppressions).
- **Registration** (`src/components/forms/register-form.tsx`) is a multi-step form that creates a profile and logs the user in via `registerWithProfile`.
- **Membership checkout has been removed.** Paid plan buttons (`membership-card.tsx`) only show a "not available" toast; there is no payment gateway or order model. Free plan selection is unaffected.
- **Supabase**: `src/lib/supabase/client.ts`, `server.ts`, and `proxy.ts` throw clear "not configured" errors / short-circuit until env vars are set. The demo does not require them.
- **`src/proxy.ts`** replaces the deprecated `middleware.ts` in Next 16; keep the filename/export (`proxy`) intact when enabling session refresh.

---

## Conventions Checklist

- Start the dev server: `npm run dev` → http://localhost:3000
- After changes: `npx tsc --noEmit` then `npm run lint`.
- Keep `app/` thin: new pages compose `components/*`, new data/logic goes into `features/<domain>/` (`queries.ts`, `actions.ts`, `data.ts`, `types.ts`).
- Seed/mock data lives under `features/<domain>/data.ts`; interactive mock state in `src/lib/state/demo-store.tsx`.
- Use `cn()` from `@/lib/utils` for conditional className merging.
- Follow the existing component style (function components, `lucide-react` icons, Tailwind utility classes, design tokens) shown in `src/components/ui/*`.