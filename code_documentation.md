# Subha Vivaham — Premium Matrimony Platform

Front-end codebase for **Subha Vivaham** ("சுப விவாஹம்"), a premium Tamil Nadu matrimony platform ("Connecting hearts, bringing families together"). The app is **Supabase-only**: there is no mock mode and no data-mode switch. Page data is read from a real Supabase Postgres database, and with no credentials the app warns loudly at startup instead of quietly serving bundled sample rows.

> **Migration status — admin, the public pages and the money path are done.** Supabase schema, RLS and seed are live. **Admin is on real Supabase Auth** with a JWT-claim gate, all 8 admin screens (dashboard, users, profiles, communities, memberships, services, temples, **config**) read the database with no seed fallback, and all admin mutations are real writes. `/services` and `/vendor-register` are live, including the public submit → admin approval flow. `/temples` and `/temples/[temple_id]` are live and DB-backed, and temples now carry their own **approve / reject / active** review gates. `/jathagam` calls an external astrology API through server actions. Member **login and registration are email + password against real Supabase Auth** — the 8-step `/register` wizard writes auth → `users` → `profiles` → photos through the `registerMember` server action and emails the office on success. **Membership checkout is live**: a member pays by UPI, uploads a screenshot, and an admin approving the `membership_payments` request is what grants the plan; per-plan photo/interest quotas are enforced in `src/lib/payments/quotas.ts`. **Interests are tracked in the `interests` table** — sent and received with a status and a viewed flag, see [Interests (`public.interests` tracking)](#interests-publicinterests-tracking). Still on seed data: `/dashboard/*`, `/matches`, and `/dashboard/preferences` in particular. See [Supabase Integration Status](#supabase-integration-status).

> **The temple area is the largest recent schema change**, and the one most likely to be out of step with your database: festivals moved from a `special_days` blob to a `temple_festivals` table, `latitude`/`longitude` were replaced by a single `maps_url`, and the `timings` string became seven per-weekday columns. See [Temples](#temples-utemples--temples--temple_id) before touching temple code. **If you see `Could not find the 'timings' column of 'temples'`, you are running an old database against new code** — the fix is the run order in [SQL run order](#sql-run-order), not a code change.
>
> **SQL execution order.** `table_deletion_query.md` → `table_creation.md` → `table_policies.sql` → the seed files (`primary_seed.sql` and `seed_data.sql`, then `success_stories_seed.sql`). `table_creation.md` creates tables but never enables RLS, so stopping after it leaves everything writable with the publishable anon key. `tables_document.md` is the annotated reference, **not** a file to paste.

> **There is no `migrations/` folder; every database change ships through the root SQL files.** `table_deletion_query.md` → `table_creation.md` → `table_policies.sql` → the seed files. Anything that rolls a live database forward is written idempotently into `table_creation.md` — a new column is an `add column if not exists` block plus a backfill, and a unique index / trigger / policy that used to leave the file now has its idempotent statement in `table_creation.md` or `table_policies.sql` with the RLS definition always matching in the latter. Re-pasting `table_creation.md` and `table_policies.sql` brings a live database in line with a fresh one; nothing needs a numbered migration file. **The seed files are idempotent too** (`on conflict … do update`), so re-pasting one to correct copy is safe — with **one exception**: `success_stories_seed.sql` is a plain `INSERT` with no `on conflict`, so re-run it only against an empty `success_stories` table. You can always edit a row directly in the Supabase SQL editor instead.

> **The temple redesign is the one case that needs a wipe rather than a re-paste.** `temple_festivals` is a new table and the temple timings/maps changes *dropped* columns, so there is no additive migration — `create table if not exists` cannot add a column to a table that already exists. Run the four files in order, from `table_deletion_query.md`. `table_creation.md` carries the equivalent `alter table … add column if not exists` statements in its comment block if you ever need to roll a live temple table forward without dropping it.

> **Content the database owns.** `/communities` and `/success-stories` render from Postgres, so the `features/*/data.ts` seeds are fallbacks that are invisible while the tables have rows. Before "the page ignores my edit", check the table. See [Writing community copy](#writing-community-copy--edit-the-database-not-the-seed).

---

## Getting Started (new developers — start here)

Prerequisites:

- Node.js 22.x + npm
- A Supabase project with the schema applied — the app cannot render page data without it.

### SQL run order

Schema, RLS, and rows are **separate files** and the order is not optional:

| # | File | What it does | If you skip it |
| --- | --- | --- | --- |
| 1 | `table_deletion_query.md` | drops every table, policy and function | fine — only needed for a wipe |
| 2 | `table_creation.md` | tables, columns, indexes, buckets, triggers, functions, storage policies, the `site_config` row | **nothing works** |
| 3 | `table_policies.sql` | `enable row level security` + every table policy | **every table is readable and writable by anyone with the anon key, which ships in the client bundle** |
| 4 | `primary_seed.sql` | `communities` + the three `membership_plans` rows | no plans to subscribe to; `/membership` renders empty |
| 5 | `seed_data.sql` | the rest of the rows — users, profiles, photos, interests, service providers, temples + their children | empty tables; the site renders zero profiles/vendors/temples |
| 6 | `success_stories_seed.sql` | the `success_stories` rows | `/success-stories` renders empty |

The seed files are idempotent (`on conflict … do update`), so steps 4–6 are safe to re-run — except `success_stories_seed.sql`, which is a plain `INSERT` and only safe against an empty table. `primary_seed.sql` must land before anything that references a plan.

`tables_document.md` is the **annotated reference only — do not paste it.** It explains why each column exists and where the two files disagree, `table_creation.md` is authoritative.

> The deletion file drops the storage **policies** but not the **buckets**, so `profile-photos`, `temple-images` and `payment_screenshots` survive a wipe. That is deliberate: it lets the bucket inserts in step 2 land on `on conflict do update` instead of failing on a duplicate key. Files already in those buckets become orphans — invisible, because no row references them.

```bash
npm install
npm run dev        # Turbopack dev server → http://localhost:3000
```

Dev vs. production speed: `npm run dev` compiles each route **on demand** (Turbo next build JIT); first visit to a route — or any visit after editing it — takes a moment on Windows. For a faithful, fast check of the real app use the production build:

```bash
npm run build      # optimized production build (outputs .next/)
npm run start      # serve the production build → http://localhost:3000
```

Verification commands (run after every change):

```bash
npx tsc --noEmit   # full typecheck
npm run lint       # ESLint (next/core-web-vitals + typescript)
npm run build      # verifies compile + every route + proxy
```

> If `tsc` reports `Cannot find module '../../src/app/.../page.js'` from `.next/types/validator.ts` after moving or deleting a route, the generated route types are stale. Run `npx next typegen` — no full build needed.

> On this Windows setup, `npm run build` also typechecks. If a build/tsc failure complains about `.next/dev` route-type artifacts, `Remove-Item .next` and retry.

---

## Tech Stack

| Layer | Technology | Notes |
| --- | --- | --- |
| Framework | **Next.js 16.3.5** (App Router, Turbopack) | Server components by default, `"use client"` where needed |
| UI | **React 19.2.8** | Hooks + Context, no Redux. `useActionState` is the form-with-server-action pattern (see admin login, vendor register) |
| Language | **TypeScript 5** (strict) | Path alias `@/*` → `./src/*` |
| Styling | **Tailwind CSS 4** (`@tailwindcss/postcss`) | Design tokens via `@theme` in `globals.css` |
| Icons | **lucide-react** (v1.47) | Brand icons (Instagram/Facebook/Twitter/etc.) were removed — do not import them |
| Styling utils | **clsx** + **tailwind-merge** | `cn()` helper |
| Motion | **framer-motion 14** | Used in exactly three places: the scroll-reveal primitives, the `Modal`, and the wedding-intro overlay. Everything else animates with the CSS keyframes in `globals.css` — see [Motion & Animation](#motion--animation) |
| Backend | **@supabase/ssr 0.7 + @supabase/supabase-js** | The only data layer — Postgres + Auth + Storage. No mock mode (see status section) |
| Email | **resend** | Server-only transactional mail for member + vendor registrations (`features/services/notify.ts`) |
| Fonts | `next/font/google` | Inter (sans) + Playfair Display (display) |
| Lint | **ESLint 9** (`eslint-config-next`, core-web-vitals + TS) | Also flags components created inside render (`react-hooks/static-components`) |
| Package manager | npm | Node 22.x |

Scripts:

```bash
npm run dev        # start dev server (Turbopack)
npm run build      # production build
npm run start      # serve production build
npm run lint       # ESLint over the project
```

---

## Project Structure

```
table_deletion_query.md     # 1st — full ordered teardown (children before parents)
table_creation.md           # 2nd — THE schema: tables, buckets, triggers (incl. pin_user_privileges), storage policies
table_policies.sql          # 3rd — enable row level security + every table policy
primary_seed.sql            # 4th — communities + membership_plans (idempotent)
seed_data.sql               # 5th — users, profiles, photos, interests, services, temples + children (idempotent)
success_stories_seed.sql    # 6th — success_stories rows
tables_document.md          # annotated column reference; READ it, do not paste it
memebership_feature_list.md # the Free / Silver / Premium plan copy the plans table mirrors
README.md                   # top-level overview (partly stale — this file is authoritative)
next.config.ts              # images.remotePatterns + serverActions.allowedOrigins
code_documentation.md       # this file
src/
├── proxy.ts                  # Session-refresh proxy (Next 16, replaced middleware.ts); active whenever Supabase creds are present
├── app/                      # Next.js App Router (routes = pages; thin compositions only)
│   ├── layout.tsx            # Root layout: fonts, metadata, AppProviders
│   ├── globals.css           # Tailwind v4 @theme tokens + global styles
│   ├── icon.png              # Favicon (generated from the logo)
│   ├── (public)/             # Marketing / guest routes (layout: Header + Footer)
│   │   ├── page.tsx          # Home page — see “Home page sections” below
│   │   ├── login/  register/
│   │   ├── jathagam/            # porutham calculator (+ actions.ts server layer)
│   │   ├── services/            # public vendor directory
│   │   ├── vendor-register/     # public vendor submission (+ actions.ts)
│   │   ├── temples/             # public directory + [temple_id] detail
│   │   └── communities/ (+ [id])  success-stories/ (+ [id])  membership/
│   ├── (app)/                # Members-area routes (session-gated)
│   │   ├── layout.tsx        # getCurrentMember() gate + DashboardShell wrapper
│   │   ├── dashboard/ (+ /preferences, /profile)
│   │   ├── matches/  interests/
│   │   ├── search/           # the ONLY profile browser; member-only, see routing note below
│   │   ├── grooms/  brides/  # member-only SearchView presets + back link
│   │   └── profile/ (+ [id]/page.tsx, actions.ts = all member interest writes)
│   └── (admin)/              # Admin area — real Supabase Auth + JWT-claim gate
│       ├── layout.tsx        # pass-through, so /admin/login stays reachable
│       └── admin/
│           ├── login/        # /admin/login (force-dynamic) + AdminLoginForm
│           ├── auth-actions.ts  # adminSignIn / adminSignOut
│           ├── actions.ts    # ~50 admin mutations, every one calls assertAdmin()
│           ├── (protected)/  # layout.tsx = requireAdmin() gate; page, communities, config,
│           │                  #   memberships, profiles, services, temples, users
├── components/               # Reusable UI + page components (no route logic)
│   ├── layout/               # header, footer, dashboard-shell, dashboard-nav, member-page-header, admin-shell
│   ├── home/                 # hero, why-us, how-it-works, communities-section, jathagam-section, trust-faq, cta
│   ├── profile/              # profile-card (ProfileGrid + ProfileCard), profile-sections (SHARED layout),
│   │                         #   profile-view, photo-gallery
│   ├── interests/            # interests-manager (client): status + Accept/Decline/Withdraw
│   ├── search/               # search-view, search-widget, search-filters
│   ├── membership/           # pricing-plans (async, DB-backed), membership-card, plan-checkout
│   ├── forms/                # login-form, register-form
│   ├── jathagam/             # jathagam-calculator
│   ├── services/             # services-directory, vendor-register-form
│   ├── admin/                # admin/table.tsx (Card/Table/Row/Cell/Pill), shared.tsx,
│   │                         #   row-actions.tsx, confirm-dialog.tsx + the manager components
│   ├── brand/                # logo (responsive widths)
│   ├── providers/            # AppProviders (context composition)
│   └── ui/                   # button, badge, avatar, modal, field, checkbox, stat-card, section-heading, reveal, progress, states, skeleton
├── features/                 # Domain logic + seed data (one folder per feature)
│   ├── auth/                 # auth-provider.tsx — members area only; hybrid (see Auth section)
│   ├── profiles/             # queries.ts (search/match scoring/stats), data.ts (seed)
│   ├── search/               # types.ts (SearchFilters, SortKey), helpers.ts (queryString/parseQuery)
│   ├── communities/  stories/  membership/   # data.ts (seed); membership/ also period.ts (hasExpired)
│   ├── interests/            # data.ts — NOT seed: the DB loader for /interests (server-only)
│   ├── services/             # types.ts, data.ts (ServiceInput type), notify.ts (Resend email)
│   ├── temples/              # types.ts — Temple, TempleInput, TempleFestival, TempleDayTiming
│   └── jathagam/             # service.ts (external API client + response mapping), data.ts (nakshatras, RASI_*)
├── types/                    # index.ts — all domain types (Profile, Interest, InterestStatus, AppUser, …)
├── hooks/
└── lib/
    ├── data/                 # mode.ts (Supabase-only resolver)
    │   ├── mappers.ts        # DB row → domain model (toProfile, toStory, toPlan, toService, …)
    │   ├── queries.ts        # PUBLIC loaders (isomorphic, client-safe — no next/headers)
    │   ├── admin-queries.ts  # PRIVATE loaders (needs the cookie session client; server-only)
    │   ├── member-dal.ts     # MEMBERS AUTH GATE: getCurrentMember() (users + profile, incl. gender + profileUuid)
    │   └── admin-dal.ts      # ADMIN AUTH GATE: ADMIN_CLAIM, getCurrentAdmin, requireAdmin, assertAdmin
    ├── supabase/             # client.ts (browser), server.ts, proxy.ts (updateSession), admin.ts (service role)
    ├── payments/             # quotas.ts — per-plan photo/interest limits + resolveMemberPlan (reads subscriptions)
    ├── constants.ts          # BRAND identity, ADMIN_NAV, CONTAINER, form option lists, photo/bucket limits
    ├── registration.ts       # shared wizard constants + per-step validation (ABOUT_MIN / ABOUT_MAX live here)
    ├── utils.ts              # cn, formatRelativeTime, ageFromDateOfBirth, uid, …
    └── state/                # toast-provider.tsx  ← demo-store.tsx was DELETED with the interests rewrite
```

> `MEMBER_NAV` in `src/lib/constants.ts` is **dead** — the member sidebar is defined locally in `components/layout/dashboard-nav.tsx` because one of its items resolves from the signed-in member's gender. Do not add a second nav list; delete `MEMBER_NAV` rather than wiring anything to it.
>
> `DemoStoreProvider` / `src/lib/state/demo-store.tsx` **no longer exist.** They only held a `localStorage` mirror of interests, and interests are now real rows in `interests`. `AppProviders` composes `ToastProvider → AuthProvider` only. Do not re-introduce a demo store for the next feature; if a screen needs persistent state that is not a database row, ask first.

Design decisions:

- **`app/` is thin** — `page.tsx` files compose components and own metadata only; business logic lives in `features/` + `components/`.
- **`features/<name>/queries.ts`** = read functions, **`actions.ts`** = mutations, **`data.ts`** = bundled seed rows / the form submit shape, **`types.ts`** = feature-local types. Reads and writes go to Postgres directly; `data.ts` is seeding/fallback material only (see [Data Source](#data-source-supabase-only)).
- Moving a page to `components/` (or a query to `features/`) is always safe: everything imports via the `@/…` alias, never relative cross-folder paths.
- Extracted page sections (`hero.tsx`, `how-it-works.tsx`, …) come with a **SectionHeading** header block and live in `components/home/`; anything interactive adds `"use client"`.
- No dead-code hoarding: the demo loading hook (`hooks/use-fake-loading`) was removed to kill artificial 350–400ms delays — do not re-introduce fake loading; render real data directly.

---

## Routing (App Router)

| Route | Group | Purpose |
| --- | --- | --- |
| `/` | `(public)` | Marketing home |
| `/login` | `(public)` | Sign in (email + password) |
| `/register` | `(public)` | Multi-step registration |
| `/jathagam` | `(public)` | Natchathram porutham calculator (live API) |
| `/services` | `(public)` | Public vendor directory — approved listings only |
| `/vendor-register` | `(public)` | Public vendor submission form (inserts unapproved, waits for admin approval) |
| `/communities` + `/communities/[id]` | `(public)` | Community directory (DB rows, counts from live profiles) + member listing |
| `/success-stories` + `/success-stories/[id]` | `(public)` | Success stories; first story is promoted to a featured card |
| `/membership` | `(public)` | Pricing plans + checkout modal |
| `/temples` + `/temples/[temple_id]` | `(public)` | Public temple directory + detail (DB) — see [Temples](#temples-utemples--temples--temple_id) |
| `/search` | `(app)` | **Member-only** profile browser (the only one) — `SearchView` |
| `/profile/[id]` | `(app)` | Full profile detail, DB-backed via `loadProfile(id)`, `force-dynamic` |
| `/dashboard` (+ `/preferences`, `/profile`) | `(app)` | Member home: stats, recommendations, partner preferences |
| `/matches` | `(app)` | Recommended / tier-filtered compatible profiles |
| `/interests` | `(app)` | Sent & received interests, with status + Accept/Decline/Withdraw |
| `/grooms`, `/brides` | `(app)` | `SearchView` presets pinned to one gender + a back link |
| `/admin` (+ `/admin/*`) | `(admin)` | Admin console (see “Admin Console” below) |

> **`/search` and `/profile/[id]` are member routes, not public ones.** Browsing is a member benefit; a guest following a stale public link is sent to `/login` by the `(app)` layout rather than being able to page through the database. `PUBLIC_NAV` and the footer never listed them. `src/app/(public)/profile/[id]/` is a leftover empty folder from before the move — delete it.
>
> Every CTA that used to point at `/search` still works for a member, which is what hides this move; the ones to re-audit after any future change are the home hero and `/login`.

Layout groups:

- **Root** (`src/app/layout.tsx`) — fonts, metadata, wraps everything in `AppProviders`.
- **`(public)` layout** — `Header` + `main` + `Footer`. Marketing pages only. **There is no guest-facing profile browser** — `/search`, `/grooms`, `/brides` and `/profile/[id]` are all inside `(app)`. The home page's featured-profiles block is a `ProfileGrid` preview that links into `/search`; the six rows it shows are the whole of what a signed-out visitor can see of a profile.
- **`(app)` layout** — `await getCurrentMember()`; `redirect("/login")` when there is no member, then renders `DashboardShell` (desktop sidebar + mobile bottom tab bar + mobile top row). The client-side `MembersSignInWall` is only reached when Supabase is unconfigured.
- **`(admin)` layout** — gates on `isAdmin` and renders `AdminShell` (see Admin Console).
- **`src/proxy.ts`** — session-refresh proxy (Next 16 renamed `middleware.ts` → `proxy.ts`). Active whenever Supabase creds are present; route protection still lives in the `(app)`/`(admin)` layouts.

---

## Home Page Sections (`src/app/(public)/page.tsx`)

Section order (all are server components unless noted):

| # | Component | Section | Notes |
| --- | --- | --- | --- |
| 1 | `Hero` | Hero | Bilingual headline, CTAs to `/#featured-profiles` + `/register` — **not** to `/brides`, which is member-only |
| 2 | (inline) | Featured Profiles | `SectionHeading` + `<ProfileGrid>` with `getFeaturedProfiles(8)` |
| 3 | `WhyChooseUs` | Why Subha Vivaham | Value-props grid |
| 4 | `HowItWorks` | எவ்வாறு செயல்படுகிறது / **How It Works** | The personal, trust-based 4-step process: Contact Us (தொடர்பு கொள்ளுங்கள்) → Register Profile (பதிவு செய்யுங்கள்) → Jathagam Matching (ஜாதக பொருத்தம்) → Meet & Marry (சந்தித்து திருமணம் செய்யுங்கள்). References **R. Viswanathan @ 85086 30290** and the two Tuticorin offices. |
| 5 | `CommunitiesSection` | அனைத்து தமிழ் சமூகங்கள் / **All Tamil Communities** | 16 Tamil sub-community pills (Iyer → Kusavar); each pill links to `/communities`. |
| 6 | `JathagamSection` | ஜாதக பொருத்தம் / **Jathagam Porutham** | Dark `charcoal-950` band. Thirukkural Kural #41 quote; **12 Rasi tiles as a client-side selector, not links** (`"use client"`, one `useState` holding a 0-based index). A tile click only sets state and reflects lord/range/Tamil in the gold card on the right — it navigates nothing. The single `Check Matches` link to `/jathagam` is **always rendered** and carries **no query string**, so the selection is discarded on navigation. A gold WhatsApp CTA for a free consultation follows. |
| 7 | (inline) `Faq` | Questions, answered | Expand/collapse accordion (`features/home/trust-faq.tsx`) on `bg-ivory-100`. |
| 8 | `FinalCta` | இன்றே தொடங்குங்கள் | CTA band (`bg-wine-800`); fonts sized `text-2xl sm:text-4xl` heading, `text-sm` body, `md` buttons. |

Not on the home page (by request): `PricingPlans` is commented out, the Success Stories block was removed, and the Trust & Safety section was removed. `src/components/home/success-stories.tsx` still exists but is **unused/dead** — do not import it on the home page.

Note on contacts: `components/home/*` hardcode the franchise contact **R. Viswanathan — 85086 30290** (tel `+918508630290`, WhatsApp `https://wa.me/918508630290`). This is **separate** from `BRAND` in `src/lib/constants.ts` (proprietor S.Ramalingam Pillai, `+91 88839 43711`), which drives the footer/header contact links. Keep the two distinct; change them in the right place.

Every section heading on this page now fades and lifts in on scroll, and the two card grids stagger — see [Motion & Animation](#motion--animation).

---

## Motion & Animation

**Two systems, deliberately.** CSS keyframes own anything declarative (`animate-fade-in`, `animate-slide-up`, `animate-scale-in`, `animate-invite-float`, `animate-orbit`, `animate-marquee`, all defined in the `@theme` block of `globals.css`). framer-motion owns only what CSS cannot express: scroll-triggered reveals with stagger, and enter/exit presence. Do not add a fourth system.

framer-motion appears in exactly three files plus the primitives:

| File | Uses | Why it cannot be CSS |
| --- | --- | --- |
| `src/components/ui/reveal.tsx` | `motion.div` + variants | `whileInView` + `staggerChildren` |
| `src/components/ui/modal.tsx` | `AnimatePresence`, `motion.div`/`motion.button` | an exit animation needs the subtree to stay mounted while it plays |
| `src/components/wedding-intro/*` | `AnimatePresence`, `motion.*`, `useSyncExternalStore` | 4-stage state machine with `onAnimationComplete` handoff |

### `src/components/ui/reveal.tsx` — the only sanctioned entry point

`"use client"`, three exports. Every scroll animation in the app is one of these; **do not hand-roll a `motion.div` in a page component**, because that is how timings drift apart.

| Export | Contract |
| --- | --- |
| `Reveal({ children, className?, delay?, y?, amount? })` | single-element fade + rise, `whileInView`, `viewport={{ once: true, amount }}` (default `0.3`). `y` default `16`, `delay` default `0` |
| `RevealGroup({ children, className?, stagger?, mode?, amount? })` | renders the container and the stagger. `stagger` default `0.08`; `mode` is `"inView"` (default, reveals on scroll) or `"mount"` (plays once on first paint); `amount` default `0.1` |
| `RevealItem({ children, className? })` | one cell. Carries `variants` only — the target state is inherited from the parent, so an item is always a **direct** child of the group or it will not animate |

**One easing curve.** All three use `[0.16, 1, 0.3, 1]`, which is the same cubic bezier as the `slide-up` keyframe in `globals.css`, so JS-driven and CSS-driven motion on the same screen match. `animate-slide-up` no longer has a caller now that the `Modal` uses variants — the keyframe is kept deliberately, as the reference curve for this constant.

> The other four are all still live: `animate-fade-in` (`jathagam-calculator`, `header`, `admin-shell`), `animate-slide-in-right` (`admin-shell` drawer), `animate-slide-in-left` (`search-view` filter sheet), `animate-scale-in` (`toast-provider`).

**Reduced motion is a real branch, not a duration tweak.** Each component calls `useReducedMotion()` and returns a plain `<div>` instead of a `motion.div`. Do not "simplify" this to `transition={{ duration: 0 }}` — a `motion.div` with `initial` still writes inline `opacity: 0` into the SSR HTML, so a no-op transition leaves the content invisible if the animation never runs. The plain-div branch renders the final state with no inline style at all.

### Where reveals are applied

| File | Treatment |
| --- | --- |
| `src/components/ui/section-heading.tsx` | root wrapped in `Reveal`. **Highest leverage** — one edit animates every section that renders a `SectionHeading` |
| `src/components/home/why-us.tsx` | `RevealGroup` + `RevealItem` over the 4 value-prop cards |
| `src/components/home/how-it-works.tsx` | `RevealGroup` + `RevealItem` over the 4 steps |
| `src/components/home/featured-profiles.tsx` | `Reveal` around the whole `ProfileGrid` (`amount={0.05}`) |

> **`RevealItem` renders a wrapper element, which makes it the grid item rather than the card.** Any card inside one needs `h-full` on **both** the item and the card, or the card stops filling its stretched grid row and the row grows ragged. That is why `how-it-works.tsx` and `why-us.tsx` carry `h-full` in two places each — do not remove one and "simplify".
>
> For the same reason `ProfileGrid` is **not** staggered per card. It is shared with `/search` and `/grooms` + `/brides`, and per-card wrappers there would mean touching a component four routes depend on. Reveal the container instead.

### `Modal` (`src/components/ui/modal.tsx`)

- `if (!isHydrated) return null` — the portal target must exist before anything renders into it.
- The portal renders whenever hydrated, **not** only when `open`, because `AnimatePresence` needs the subtree mounted to play the exit. While closed it renders nothing; only during a close does the panel linger for the exit duration.
- The `animate-fade-in` / `animate-scale-in` / `animate-slide-up` classes were **removed** from the panel and replaced by variants — a keyframe cannot play an exit. `centerOnMobile` picks `scale: 0.97`, otherwise `y: 24`.
- Still portalled to `document.body` on purpose: a transformed or overflow-hidden ancestor becomes the containing block for `position: fixed`. framer-motion writes a transform onto the panel, exactly as the old keyframes did, so this constraint is unchanged — not a new one.
- All 14 call sites pass `open` as a prop rather than mounting conditionally, which is what makes the `AnimatePresence` refactor safe.

### Out of scope — do not add

- **`useScroll` parallax.** The `prefers-reduced-motion` reset at `globals.css:205` is a **CSS** reset and does not cover JS-driven motion, so this would be an accessibility regression with no guard.
- **Toasts** (`src/lib/state/toast-provider.tsx`) — CSS covers it, and the provider is shared by admin and app surfaces.
- **Admin panels** (`src/components/admin/*`) — dense data tables; animation fights the density.
- **Card hover lifts.** `ProfileCard` and the `why-us` cards already do this in CSS (`hover:-translate-y-1` + `shadow-card-hover`). Adding `whileHover` on top would fight the Tailwind transform.

### Scroll locking — the one thing that can brick the page

Three components set `document.body.style.overflow = "hidden"`: `Modal`, and the `wedding-intro` overlay. The overlay's lock (`wedding-intro.tsx:42-49`) is released by `stage === "home"`, and `stage` only reaches `"home"` from an **`onAnimationComplete` callback** on a `motion.div`. If that callback never fires — an interrupted animation, a ref-count edge case, a variant object that resolves to a string — the overlay unmounts visually but the lock survives, and **the whole page cannot be scrolled with no visible cause**. When a page "cannot scroll", check for a stranded `overflow: hidden` on `body` before touching anything else.

---

## Admin Console

### Access & login — real Supabase Auth, not the demo password

> **This changed completely.** The admin area no longer uses `DEMO_CREDENTIALS` or the fake `adminLogin()`. It uses Supabase Auth with a JWT claim, gated in four independent layers.

Route structure (Next 16 route groups):

| File | Role |
| --- | --- |
| `src/app/(admin)/layout.tsx` | **Deliberately empty pass-through.** The guard lives in `(protected)` so `/admin/login` stays reachable. |
| `src/app/(admin)/admin/(protected)/layout.tsx` | `await requireAdmin()`, then renders `<AdminShell adminName={admin.email} adminEmail={admin.email}>`. Redirects to `/admin/login` when there is no admin. |
| `src/app/(admin)/admin/login/page.tsx` | `export const dynamic = "force-dynamic"` (so a signed-in admin is not bounced from a cached page). Calls `getCurrentAdmin()` and `redirect("/admin")` if truthy. |
| `src/app/(admin)/admin/login/admin-login-form.tsx` | `useActionState<LoginState, FormData>(adminSignIn, null)`. Email + `PasswordInput` + submit + "Back to site". |
| `src/app/(admin)/admin/auth-actions.ts` | `"use server"`. `adminSignIn` (lower-cases the email, `auth.signInWithPassword`, then **signs the user back out** if `app_metadata.role !== "admin"` so a valid non-admin account cannot hold a session that reaches a protected read, then `redirect("/admin")` last), `adminSignOut`, `type LoginState = { error: string } | null`. |

#### `src/lib/data/admin-dal.ts` — the authorization module

| Export | Behaviour |
| --- | --- |
| `ADMIN_CLAIM = "admin"` | The app-metadata key to check. |
| `type AdminIdentity` | `{ authUserId, email, name }` |
| `getCurrentAdmin()` | Wrapped in React `cache()`. Wraps `getSupabaseServer()` in try/catch and returns `null` if it throws (unconfigured Supabase ⇒ nobody is admin). Calls `auth.getUser()` — **server-validated, never trusts the cookie** — returns `null` unless `app_metadata.role === "admin"`. Then a best-effort `users.select("name").eq("email", …).maybeSingle()`, falling back to the email. |
| `requireAdmin()` | `cache()`d; `redirect("/admin/login")` when `getCurrentAdmin()` is `null`. |
| `assertAdmin()` | Not cached; `throw new Error("Not authorised.")`. |

#### The four layers

1. **`src/proxy.ts`** — calls `updateSession`, then an explicitly **optimistic** check: for `/admin*` (excluding `/admin/login`) it looks for any `sb-*-auth-token` cookie and redirects to `/admin/login` if none. The file states plainly that a cookie is forgeable and this is only a fast path.
2. **`requireAdmin()`** in the `(protected)` layout.
 3. **`requireAdmin()` again in every protected page** (`page`, `users`, `profiles`, `communities`, `memberships`, `services`, `temples`, `config`) — a layout is not re-run on every navigation and can be bypassed.
4. **`assertAdmin()` in every server action** + RLS on the claim as the last line.

Promoting someone: set `{"role": "admin"}` in **app metadata** under Supabase → Authentication → Users → Edit. `updateUserRoleAction` deliberately does **not** touch the claim (dashboard-managed, two-step on purpose).

> **Two auth systems coexist, and they no longer overlap.** The admin area is on the server-validated `app_metadata.role` claim. The members area (`features/auth/auth-provider.tsx`) authenticates against Supabase Auth but exposes **no role at all** — `AuthProvider`'s value is only `user`, `login`, `registerWithProfile`, `logout`, `isLoggedIn`, `isLoading`. An admin who is also a member signs into the members area as an ordinary member, and there is no client-side flag that could be mistaken for authorization.

### `AdminShell` — enterprise layout (`src/components/layout/admin-shell.tsx`)
- **Desktop**: fixed left sidebar `w-64` (logo header, icon+label nav from `ADMIN_NAV`, footer with user avatar-initial + name/`Administrator` + "View site" + "Sign out"), content column offset with `lg:pl-64`.
- **Topbar**: sticky, full-width, contains a **breadcrumb showing the current page title** (no duplicates of the user identity) and actions ("View site" on ≥`md`, "Sign out"). On mobile the sign-out collapses to an icon and a hamburger opens the drawer.
- **Mobile**: slide-in drawer (w-72, `max-w-[85vw]`, backdrop, close button) reusing the same nav block; both navs share `ADMIN_NAV` + an `ICONS` map of lucide icons (one per nav entry, including `settings` for Configuration, plus an unused `inbox`), falling back to `LayoutDashboard` for an unknown key.
- Active nav item = exact match for `/admin`, otherwise `pathname.startsWith(href)`.
- Auth identity appears **once** (sidebar footer). Do not re-add name/badges to the topbar.
- Sign-out calls the `adminSignOut` server action inside `startTransition`.

### Admin pages

`src/app/(admin)/admin/(protected)/` — 8 server components, each thin: `requireAdmin()` → the matching `fetchAdmin*` loader → the manager component. **All 8 are DB-backed with no seed fallback.**

| Route | Loader | Manager |
| --- | --- | --- |
| `/admin` | `fetchDashboardData()` | dashboard (StatCards + recent tables) |
| `/admin/users` | `fetchAdminUsers()` | `UsersManager` (also receives `currentUserEmail`) |
| `/admin/profiles` | `fetchAdminProfiles()` | `ProfilesManager` |
| `/admin/communities` | `fetchAdminCommunities()` | `CommunitiesManager` |
| `/admin/memberships` | `fetchAdminPlans()` + `fetchAdminSubscriptions()` + `fetchAdminPayments()` | `MembershipsManager` (plans, subscriptions **and the UPI payment queue**) |
| `/admin/services` | `fetchAdminServices()` | `ServicesManager` (see below) |
| `/admin/temples` | `fetchAdminTemples()` | `TemplesManager` (see [Temples](#temples-utemples--temples--temple_id)) |
| `/admin/config` | `fetchSiteConfig()` | `ConfigForm` (banner text/enabled + office address) |

### Admin server actions (`src/app/(admin)/admin/actions.ts`, ~2,200 lines)

`"use server"`. Exports `type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }` and the `*Input` types. Private helpers: `fail`, `run(work)`, `newId(prefix)` (8 hex off `crypto.randomUUID()`), `slug`, `ageFrom`, `addMonths`, `profileColumns(input)`, `templeRow(input)`, `templeTimingsRow(timings)`, `revalidateProfileSurfaces()`, `revalidateTempleSurfaces()`, `photoProfileUuid(profileKey)`.

**Every exported action calls `await assertAdmin()` as its first statement.** The uniform pattern: write to Postgres, `revalidatePath(...)`, then **re-read the whole list and return it**, so the client manager replaces its state with server truth.

| Group | Actions |
| --- | --- |
| Users | `deleteUserAction` (also deletes the `profiles` + `subscriptions` rows), `updateUserStatusAction`, `updateAllUserStatusAction` (scoped `.eq("role","member")`), `updateUserRoleAction` (column only — never the claim) |
| Profiles | `createProfileAction` (inserts `users` **first** for the FK, then `profiles` with `verified:false, status:"inactive"`), `updateProfileAction`, `setProfileStatusAction`, `setProfileVerifiedAction` (setting `verified` also forces `status="active"`, so both anon-read gates open together), `deleteProfileAction` |
| Profile photos | `addProfilePhotoAction` (`is_primary` when `sort_order` 1), `addProfilePhotoUploadAction` (uploads to Storage, then inserts the row), `removeProfilePhotoAction`, `setPrimaryProfilePhotoAction` (rewrites all `sort_order`), `moveProfilePhotoAction` (swaps with the neighbour, no-op out of bounds) |
| Communities | `createCommunityAction` (id = `slug(name) \|\| newId("c")`), `updateCommunityAction`, `setCommunityActiveAction`, `deleteCommunityAction` |
| Memberships | `upsertPlanAction`, `deletePlanAction` (**refuses** while any subscription still references the plan, with the count in the error), `createSubscriptionAction` (`renews_on` = +3 months), `setSubscriptionStatusAction`, `changeSubscriptionPlanAction` (re-reads the price), `renewSubscriptionAction` (extends from the existing date if still in the future, else from today), `setUserMembershipAction` (flips the denormalised `users` membership flags) |
| Payments | `approvePaymentAction` (the only path that turns a UPI screenshot into a grant — it creates the subscription), `rejectPaymentAction`, `uploadPaymentScreenshotAction` (admin uploads proof on the member's behalf) |
| Services | `createServiceAction`, `updateServiceAction`, `setServiceActiveAction`, `approveServiceAction`, `rejectServiceAction`, `deleteServiceAction` (see Vendor Services) |
| Temples | `createTempleAction`, `updateTempleAction`, `setTempleActiveAction`, `approveTempleAction`, `rejectTempleAction`, `deleteTempleAction`, `saveTempleFestivalsAction`, `saveTempleServicesAction`, `addTempleImagesAction`, `deleteTempleImageAction`, `reorderTempleImagesAction` (see [Temples](#temples-utemples--temples--temple_id)) |
| Config | `updateSiteConfigAction` (banner text/enabled + office address on the single `main` row) |

> **`templeRow()` must spread `templeTimingsRow()`, never assign it to a `timings` key.** Written as a key it sends a column named `timings`, which postgrest rejects by name the moment that column is gone from the schema — the error reads `Could not find the 'timings' column of 'temples' in the schema cache`, which looks like a missing migration but is a bug in this function.

### Shared admin table kit (`src/components/admin/table.tsx`)
- `Card(title?, action?, children, className?)` — rounded-2xl bordered panel; header only when `title || action`.
- `Table(head[], children)` — wraps `<table>` in `overflow-x-auto` and forces `min-w-[600px]` so the (already scrollable) columns stay readable on phones.
- `Row(className?)` / `Cell(className?, colSpan?)` / `Pill(tone: "good"|"warn"|"bad"|"neutral", children)`.
- No `"use client"` — server-safe. Companions: `row-actions.tsx` (`RowActions`, `IconAction({label, onClick, tone: "default"|"good"|"warn"|"bad", disabled?})`) and `confirm-dialog.tsx` (`ConfirmDialog({open, title, description?, confirmLabel, onConfirm, onClose})`).
- `shared.tsx` (client): `PageHeader({title, description, action?})`, generic `FilterTabs<T extends string>`, `SearchInput`, `Toolbar`, `ToolbarSelect`, `AddButton`, and the `useConfirm()` hook. **`FilterTabs` is also used by the public services page** — it is client-safe, so that import is fine.

### Vendor Services (`/admin/services`)

- `src/features/services/types.ts` — `ServiceProvider` model. `ServiceType = "mandapam" | "broker" | "catering" | "event" | "photography" | "decoration"`, with `SERVICE_TYPE_LABELS`, `SERVICE_CATEGORY_TYPES` and `SERVICE_CATEGORY_LABELS` used to group the public page into Catering / Mandapam / Wedding. **The `broker` key still exists (the DB `service_type` values are `"broker"`), but its display label is now `"Franchise Partner"`** — everywhere the label renders (admin filters, pills, vendor-register chips, the public directory) it reads from `SERVICE_TYPE_LABELS`, so the label can change without a schema migration.
- **Two separate gates**, and both must be true for a listing to appear publicly:
  | Gate | Meaning | Set by |
  | --- | --- | --- |
  | `is_approved` | A human reviewed it. DB **default `true`**. | admin create (`true`); public vendor register (`false`); `approveServiceAction` / `rejectServiceAction` |
  | `active` | On/off switch for a listing that is already approved. DB default `true`. | admin create (`true`); vendor register (`false`); `setServiceActiveAction`; approve opens both |
  - Splitting them means an approved vendor can be taken down for a season with `active = false` and switched back on **without** going through review again.
  - `approveServiceAction` sets `is_approved = true, active = true` together — approving a row that was left switched off would set one gate without the other, and the listing would read as approved in admin while never rendering publicly.
- `src/components/admin/services-manager.tsx` — client CRUD page: category filter pills with counts, add/edit modal, per-row actions, delete confirm.
  - Pending rows sort **first** (`ordered`) and get a gold-tinted row, a `Pending` status pill, a **CheckCircle2 approve** action and an **XCircle not-approve** action. Approve/unapprove both go through a `ConfirmDialog`; not-approve keeps the row and its details so it can be approved later, delete removes it.
  - `counts` separates `pending` (not approved) from `inactive` (approved but off), so the review queue can never hide inside a category total. A gold banner appears above the table when `counts.pending > 0`.
  - Status column: `Pending` (gold) / `Live` (green) / `Off` (neutral).
- Server actions in `src/app/(admin)/admin/actions.ts`: `createServiceAction` (inserts `is_approved: true, active: true` — an admin has already vouched for it), `updateServiceAction`, `setServiceActiveAction`, `approveServiceAction`, `rejectServiceAction`, `deleteServiceAction`. All call `assertAdmin()` first. Approve/reject also `revalidatePath("/services")`.
- `src/features/services/data.ts` — holds only the admin form's submit shape: `type ServiceInput = Omit<ServiceProvider, "id" | "addedAt" | "active" | "isApproved">`. The old localStorage CRUD store (`loadServices()`, `addService()`, `resetServices()`, the 11 bundled seed providers, etc.) is gone — service reads/writes go through `lib/data/queries.ts`, `lib/data/admin-queries.ts` and `app/(admin)/admin/actions.ts`.

---

## Temples (`/temples`, `/temples/[temple_id]`, `/admin/temples`)

The largest schema change in the project. Four tables — `temples` plus the `temple_services` / `temple_images` / `temple_festivals` children — and three retirements inside `temples` itself. This section is the authoritative description of the current shape.

### Review gates — present in the schema and admin, **not yet enforced on read**

`temples` carries `is_approved` and `active` (both `not null default true`) and the admin has the full set — `approveTempleAction` turns both on, `rejectTempleAction` clears `is_approved` but keeps the row, `setTempleActiveAction` is the on/off switch for an approved temple — and `TemplesManager` shows `Pending` / `Live` / `Off` pills. **But `temples_read` is still `using (true)`**, which `table_policies.sql` flags as the one decision left open: the gates do not decide visibility, and `fetchTemples()` does **not** push `.eq("is_approved", true).eq("active", true)` the way `fetchServices()` does. So a rejected or deactivated temple is still served to anon, and the "hidden from the public site" toast in the manager is aspirational. To make it real, change the single `using` clause to `using (is_approved and active)` — no app change needed — or add the same two filters to `fetchTemples()` as a second layer.

### What replaced what

| Was | Is now | Why |
| --- | --- | --- |
| `temples.timings text` (one blob) | seven `*_timings` columns, Sunday first | a single string cannot say *which day* a visitor is asking about, and it cannot be filtered or sorted |
| `temples.special_days text` (one blob) | `temple_festivals` rows | a blob cannot be listed, sorted, or hidden once a date has passed — and a temple has several festivals a year |
| `temples.latitude` / `longitude` | `temples.maps_url text` | nothing read them, and an admin looking up a pin has the Google **Share** link in hand already |
| `temples.services jsonb` | `temple_services` rows | jsonb cannot edit one price without rewriting the array, hide one service, or set an order |

### Types (`src/features/temples/types.ts`)

| Export | Notes |
| --- | --- |
| `Temple` | `timings: TempleDayTiming[]` — **already filtered**, so a day the admin left blank is absent rather than an empty string |
| `TempleInput` | `timings: string[]` — seven free-text values in `TEMPLE_DAYS` order, blanks included |
| `TempleDayTiming` | `{ day: TempleDay; timings: string }` |
| `TempleDay` / `TEMPLE_DAYS` | the seven day keys, **Sunday first** because that is the order the Indian convention uses |
| `TempleFestival` | `{ id, name, happensOn: string \| null, sortOrder }` |
| `isHttpUrl`, `isGoogleMapsUrl` | shared by the client form and the server action so the two cannot disagree |

### Timings — the two states that are not the same

`null` means the admin has not filled the box in, and **the day is hidden on the public page**. The literal string `Closed` is what the admin types to say the temple is shut that day, and **it does render**. An empty box and a closed day are different things, which is why this is free text and not a boolean. There used to be a "Copy Sunday into every blank day" helper; it was removed on request, and with it the `Copy` icon import.

### Festivals

- `happens_on` is **nullable on purpose** — a null renders as the festival name alone rather than as a wrong or invented date, which is the honest answer when the date has not been announced.
- **The public page filters; the admin page does not.** `fetchTempleById` pushes `.or(happens_on.is.null, happens_on.gte.<today>)` and sorts undated rows last, because an operator needs to see a past festival in order to update its date for next year.
- `saveTempleFestivalsAction` is a **whole-list replace** (delete then insert), which is why the form edits local state and submits the lot. Two statements, no transaction — see the note under Create below.

### Validation — required major fields

Client `validate()` and server `templeRow()` carry the **same rules**, and the messages are deliberately bare. The reason a field is required belongs in the label and the hint, not in a sentence an operator reads five times while fixing one form.

| Field | Rule |
| --- | --- |
| `name` | non-empty, max 120 |
| `address`, `city`, `district` | non-empty — together they are the location |
| `nameTa` | non-empty |
| `contact` | non-empty, matches `/^[0-9+()\s.-]{7,20}$/` |
| `contactPerson` | non-empty |
| `mapsUrl` | non-empty and a Google Maps link |
| `history` | non-empty, min 40 characters |
| `whatsapp`, `email`, `website` | optional, validated only if filled |
| `state`, `deity` | optional, unvalidated |

Errors render inline next to each box, and the form scrolls to and focuses the first invalid field via `[data-field]` — so every required input carries a `data-field` attribute. The "Copy Sunday" era helper that also used `data-field` is gone.

### Create vs Edit

**Edit** is one submit per concern: the temple row saves, then festivals, then images, each as its own action.

**Create cannot work that way** — there is no `temple_id` to hang child rows on until the temple exists. So the form **stages** festivals and images locally, and after `createTempleAction` returns it:

1. identifies the new id by set-difference against the list the action returned, since the form does not know the generated `temple_id`;
2. calls `saveTempleFestivalsAction`;
3. uploads the staged images.

Consequences worth knowing before you change this:

- **A partial failure is possible.** If step 2 fails, the temple exists with no festivals and the operator sees an error but a real row in the table.
- `saveTempleFestivalsAction`'s delete-then-insert is **not atomic**; a failed insert leaves zero festivals rather than the previous set.
- In the admin form, **the gallery picker and the festival rows are visible on the Add form too**, not only on Edit. They are inert until there is a row to attach them to.

### Images and the five-image cap

The cap is **five including the cover**, which is why it cannot live in the storage bucket — it is a row count.

- Cover: `TEMPLE_IMAGE_BUCKET` (`temple-images`), `TEMPLE_COVER_PREFIX` (`cover-`), JPEG/PNG/WebP, `MAX_TEMPLE_IMAGE_BYTES` (300 KB).
- The database side is `public.enforce_temple_image_cap()`, a `before insert` trigger on `temple_images` that also counts `temples.cover_image`; the action re-checks it. Belt to the trigger's braces.
- **300 KB appears in exactly two places** — the bucket's `file_size_limit` and `MAX_TEMPLE_IMAGE_BYTES` — and they must agree. The bucket rejects an oversized file with a bare 413 that the admin form never sees, so a form that accepts more produces an unexplained failure instead of a validation message.
- **`removeTempleCoverAction` compares the old and new url before unlinking.** Deleting on "the cover was touched" would destroy a file when the operator merely re-submitted the same one.

> **Neither public page renders `temple.coverImage`.** Upload, replace and remove all work, and the file lands in the bucket, but `/temples` and `/temples/[temple_id]` do not display it. The cover is currently admin-only data.

### Seed data — placeholder maps links

`seed_data.sql` carries 26 temples, ten `temple_festivals` rows and `temple_services` rows, with all seven timings columns populated. **The `maps_url` values are fabricated placeholders and must be replaced with real share links before production** — Get Directions currently resolves them from the address fallback, which is the only reason this has not surfaced as a bug.

---

## Footer (`src/components/layout/footer.tsx`)

- Dark brand panel on `bg-charcoal-950`, 12-column grid:
  - Brand block (logo, tagline, one-liner, social pills — text only, lucide brand icons are gone),
  - **Explore** — mirrors `PUBLIC_NAV` exactly (Home, Jathagam, Communities, Services, Success Stories, Membership). Brides/Grooms are **not** listed because they moved into the member area and are reached from the dashboard sidebar; Services is listed because `/services` is public.
  - **Account** — only the three entry points into an account: **Login**, **Profile Register** (`/register`), **Vendor Register** (`/vendor-register`). Dashboard, Membership and Admin Login were removed: they are reached by signing in, and listing them only produced a wall of redirects. Admin is reachable at `/admin` directly.
  - **Registered Offices** (both Tuticorin addresses) + WhatsApp/Mobile + Email contact links from `BRAND`.
- Bottom bar shows only `© {year} {BRAND.name} ({BRAND.nameTamil}). All rights reserved.` — **no GSTIN**.

---

## Data Source (Supabase only)

`src/lib/data/mode.ts` is a resolver, not a mode switch:

- `supabaseUrl` / `supabaseKey` — read straight from the env
- `isSupabaseConfigured` — `Boolean(supabaseUrl && supabaseKey)`

**There is no mock mode and no `NEXT_PUBLIC_DATA_MODE`.** The switch was removed on purpose: a mode flag let a deployment quietly fall back to bundled seed rows and render fake content that looked real. Reads now depend on the credentials alone, so an empty page means a missing key — which the module reports with a loud server-side `console.warn` rather than silently serving samples.

| Variable | Dev | Prod | Used by |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | required | required | supabase clients |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | required (preferred) | required | browser + server clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | fallback only | fallback only | legacy key support |
| `JATHAGAM_API_URL` | set | required for `/jathagam` | astrology engine client (server only) |
| `JATHAGAM_API_KEY` | — | optional | sent as `Authorization: Bearer` |
| `SUPABASE_SERVICE_ROLE_KEY` | optional | optional | server-only; the privileged client in `lib/supabase/admin.ts` (premium contact details). Never prefix with `NEXT_PUBLIC_` |
| `RESEND_API_KEY` | optional | required to send mail | Resend transactional email (server-only) |
| `EMAIL_FROM` | optional | optional | From header (defaults to `Subha Vivaham <onboarding@resend.dev>`) |
| `VENDOR_NOTIFY_EMAIL` | optional | optional | inbox for member/vendor registration notices (defaults to `subhavivaham2017@gmail.com`) |

> **Never prefix the astrology vars with `NEXT_PUBLIC_`** — that would ship the endpoint and key to the browser. `JATHAGAM_API_URL` is read on the server only, and `/jathagam` passes the calculator a plain `enabled` boolean rather than the URL.

> **`NEXT_PUBLIC_*` values are inlined at build time.** Changing one needs a rebuild, not just a dev-server restart.

**Engine endpoint:** the public Jagannatha Hora REST API — `https://jagannatha-hora-359167915530.europe-west1.run.app` — is **open and keyless** (no signup, no `JATHAGAM_API_KEY`, no auth header). `service.ts` appends `/marriage-match` and `/location/autocomplete` to `JATHAGAM_API_URL`. `JATHAGAM_API_KEY` remains supported as a signed-bearer option only for a self-hosted deployment behind auth (the public engine never needs it).

> **Production/deploy gotcha:** `JATHAGAM_API_URL` lives only in gitignored `.env.local`. On Vercel it must be set in **Settings → Environment Variables** (key `JATHAGAM_API_URL`, value the run.app URL above) and the project redeployed — otherwise `/jathagam` renders the "being configured" fallback in prod.

There is **no tracked `.env.example`**; `.env` and `.env.local` are both gitignored. The public write paths (vendor register, member registration) still work under RLS as `anon`/`authenticated`. A **service-role key *is* configured** (`SUPABASE_SERVICE_ROLE_KEY`) and is reached only through `src/lib/supabase/admin.ts` for privileged server reads — currently just the premium contact details on `/profile/[id]`. Nothing that has a session-scoped alternative should use it, and a `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` would be inlined into the client bundle (the module warns if it ever sees one).

> **Key naming:** `mode.ts` reads `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` first and falls back to `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Supabase now issues publishable keys; prefer the publishable name. Copy the key **including its trailing `-`**; the value with the hyphen omitted returns `401 Invalid API key`.

Environment files: `.env` and `.env.local`, both gitignored (`.env*`). Server-only secrets — the service-role key, Resend, and the astrology endpoint/key — belong here and never under a `NEXT_PUBLIC_` name.

Supabase layer (`src/lib/supabase/`), split for the three runtimes:

- `client.ts` — browser client via `createBrowserClient`; `getSupabase()` throws a clear "not configured" error when creds are missing.
- `server.ts` — server `getSupabaseServer()` via `createServerClient` + `cookies()`.
- `proxy.ts` — `updateSession(request)` cookie-refresh helper wired into `src/proxy.ts`; auth failures are swallowed so a bad session cannot 500 a request.
- `admin.ts` — `getSupabaseAdmin()` plus `isServiceRoleConfigured`; the service-role client. Server-only, returns `null` (not a throw) when the key is absent, so a caller with a session-scoped fallback can still proceed.

### Loader modules — and the rule for adding more

| Module | Client type | Tables | Importable from |
| --- | --- | --- | --- |
| `lib/data/queries.ts` | isomorphic, **client-safe** | public tables only | anywhere, including `"use client"` |
| `lib/data/admin-queries.ts` | cookie session, server-only | `profiles`, `profile_photos`, `communities`, `users`, `subscriptions`, `membership_plans`, `membership_payments`, `service_providers`, `temples`, `temple_images`, `temple_services`, `temple_festivals`, `site_config` | server components / route handlers only |
| `lib/data/member-dal.ts` | cookie session, server-only | `users`, `profiles` | server components / server actions |
| `lib/data/admin-dal.ts` | cookie session, server-only | `users` (name lookup only) | server components / server actions |
| `features/interests/data.ts` | cookie session, server-only | `interests`, `profiles`, `profile_photos` | server components only |
| `lib/payments/quotas.ts` | takes a client as an argument (no `next/headers`) | `subscriptions`, `membership_plans`, `users`, `interests` | server actions / server components |
| `features/services/notify.ts` | no client — wraps Resend | — | server actions only (reads `RESEND_API_KEY`) |

`queries.ts` exports `fetchProfiles`, `fetchCommunities`, `fetchPlans`, `fetchServices`, `fetchStories` and `fetchSiteConfig`; `admin-queries.ts` exports the `fetchAdmin*` loaders (users, profiles, communities, plans, subscriptions, payments, services, temples) plus `fetchDashboardData()` and `type DashboardData`.

The last row is the exception to "loaders live in `lib/data/`": it sits in `features/` because it is interest domain logic, not a generic table read, and because the members area keeps feature-specific loaders beside the feature. It obeys the same rule that matters — it reaches `getSupabaseServer()` (which calls `next/headers`) and must never be imported from a client component.

`member-dal.ts` is the members-area counterpart to `admin-dal.ts`. `getCurrentMember()` is `cache()`d and returns `MemberIdentity | null`:

| Field | Source |
| --- | --- |
| `authUserId` | `auth.getUser()` — **server-validated, never trusts the cookie** |
| `userId`, `email`, `name` | `users` row matched on `user_id = auth.uid()` |
| `profileId` | `profiles.profile_id` matched on `profiles.user_id` — the **public** text key, used in URLs |
| `profileUuid` | the same query's `profiles.id` — the **uuid**, used by `interests.from_profile_id` / `to_profile_id` |
| `gender` | `profiles.gender`, narrowed to `"male" \| "female" \| null` |

`gender` is what lets the member sidebar offer a bride one "Grooms" link and a groom one "Brides" link. It is `null` when the `profiles` row is missing, and callers must fall back rather than guess a side.

> **`profileId` vs `profileUuid` is the single easiest thing to get wrong in the members area.** `profiles` carries both a `uuid` `id` and a `text` `profile_id`. Routes, `/profile/[id]` links and the `interested_profile` array are all keyed on **`profileId`**; the `interests` table is keyed on **`profileUuid`**. Any write to `interests` must resolve one to the other with an explicit lookup — see [Interests](#interests-publicinterests-tracking).

> **Known gap:** `fetchCommunities()` does **not** filter on `active` — it is a plain `select("*")` and relies entirely on the RLS read policy. The `active` value is carried by the `toCommunity` mapper but nothing filters on it.

> **The seed is a fallback, not the source of truth.** `mapped()` returns the bundled seed only when the table is empty *or* the request fails, so a table with rows always wins and edits to `features/<domain>/data.ts` are invisible on screen. This bit hardest on community descriptions — see [Writing community copy](#writing-community-copy--edit-the-database-not-the-seed). Whenever a page "ignores" a data edit, check the table before the seed file.

**Critical:** `queries.ts` must never statically import `@/lib/supabase/server` or anything else that reaches `next/headers`. `search-view.tsx` is a client component that reaches `queries.ts`, so such an import breaks the build with *"You're importing a module that depends on next/headers… using it in the Pages Router"*. Turbopack traces dynamic `import()` too, so lazy-loading is **not** sufficient — private loaders belong in `admin-queries.ts`.

On the server, `queries.ts` builds a plain publishable-key client rather than the cookie client, so public pages stay cacheable instead of being forced dynamic by `cookies()`.

> **The seed fallback masks failures — with one deliberate exception.** Most loaders in `queries.ts` return the bundled seed when a table comes back empty *or* the request fails, so a broken query looks like a working page. `fetchProfiles()` and `fetchServices()` deliberately return `[]` on a **zero-row** result (an empty table is a real answer; only an *unreachable* database falls back) — without that, a new deployment would show invented profiles and invent vendors nobody entered. Treat "it renders" as unproven until you have confirmed the row count matches the database.

**`admin-queries.ts` has no seed fallback at all.** It is deliberately the opposite: `rowsFrom()` **throws** on error and returns `[]` for genuinely empty tables, so admin screens can never quietly show demo data as if it were real. `USER_COLUMNS` is an explicit column list — `users.password` holds a credential hash and must never be pulled into a client component.

`fetchAdminServices()` reads `service_providers` with **no filter**, on purpose: the admin table has to see unapproved and inactive rows. `fetchServices()` is the opposite — it filters in the query.

---

## Supabase Integration Status

### Database (live and verified)

Project `subhavivaham_demo` (branch `main`, Production). **15 tables** defined in `table_creation.md`:

| Table | PK type | Public read | Notes |
| --- | --- | --- | --- |
| `users` | `uuid` | no | member/private; `user_id text` is the natural key every url uses; `auth_user_id uuid` nullable |
| `communities` | `text` | active only | **16 rows** — matches the 16 in `features/communities/data.ts`; copy lives here, not in the seed |
| `profiles` | `uuid` | active only | 4 rows; also has a **text** `profile_id` natural key; family/lifestyle/preference columns live here |
| `profile_photos` | `uuid` | via parent profile | `profile_id uuid`, 12 rows |
| `interests` | `uuid` | participants only | `from/to_profile_id uuid` → `profiles.id`; `status`, `viewed`, `created_at`/`updated_at` added by idempotent blocks in `table_creation.md` |
| `membership_plans` | `text` | active only | 3 rows — Free / Silver / Premium; `photo_limit` / `interest_limit` drive the quotas |
| `subscriptions` | `uuid` | own + admin | `user_id text` |
| `membership_payments` | `uuid` | own + admin | paid UPI checkout requests; `payment_id text` natural key; `status` pending/approved/rejected; approving creates the subscription |
| `success_stories` | `uuid` | published | 10 rows; `slug` is the natural key used by `/success-stories/[id]` |
| `service_providers` | `text` | `is_approved and active` | `service_id` is the natural key (text); two gates, see Vendor Services |
| `temples` | `text` | **everyone** — gates not enforced | 26 rows; `temple_id` is the natural key; seven `*_timings` columns and `maps_url`. `is_approved`/`active` exist but `temples_read` is still `using (true)` |
| `temple_services` | `text` | via parent temple | 21 rows; `price` in whole rupees, 0 renders "On request" |
| `temple_images` | `text` | via parent temple | gallery; **five-image cap including the cover**, trigger-enforced |
| `temple_festivals` | `text` | via parent temple | 10 rows; `happens_on` nullable; **not** date-filtered in the policy, filtered in the query |
| `site_config` | `text` | public read | single `main` row; banner text/enabled + office address; admin write |

> **Type trap:** `profiles` carries both `id uuid` and `profile_id text`. In a policy subquery over `profiles`, an unqualified `profile_id` binds to the **inner** table, producing `uuid = text` (error 42883). Always write `p.id = public.<table>.profile_id`.

> **A second type trap on temples:** the four temple tables use a `text` primary key with a generated `gen_random_uuid()::text` default, *plus* a separate natural key (`temple_id` / `service_id`). An insert that supplies only the natural key must not fail on the primary key — that is what the default is for. The same shape applies to `service_providers`.

### RLS (`table_policies.sql`)

RLS is enabled on all 15 tables and **no helper functions** — the first draft used six `$$`-quoted functions and every policy failed to compile, leaving RLS on with zero policies (a total lockout). The current design checks `auth.uid()` and a JWT claim inline. Admin access requires Supabase Auth **app metadata** `{"role": "admin"}`; set it under Authentication → Users → Edit.

The four temple tables use one pattern each: public `using (true)` read for anon + authenticated, and a single admin `for all to authenticated` write. **Every `enable row level security` statement lives in `table_policies.sql`, none in `table_creation.md`** — that split is the reason the run order is not optional.

Every admin write policy uses `(select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')` for both `using` and `with check`.

`interests` is the one table where the **admin branch is a later addition rather than the original policy**: `interests_delete` originally allowed only the sender, so an admin reviewing a reported pair could not remove it. `table_policies.sql` drops and recreates that single policy with an `or (admin)` clause, so a fresh database gets it without re-running anything beyond the normal four files.

### The `interests` schema additions

The interest additions ship idempotently in `table_creation.md`:

| Change | Why |
| --- | --- |
| `created_at`, `updated_at` `timestamptz`, backfilled then `not null default now()` | The table had **no timestamps at all**, so "newest first" had nothing to sort on and the seeded rows would have sorted arbitrarily. Backfilling with `now()` puts them in a sensible place rather than the epoch. |
| `idx_interests_created (created_at desc)` | the ordering both lists use |
| `idx_interests_open_pair` — **unique** on `(from_profile_id, to_profile_id) where status = 'pending'` | makes the database, not the application, the last word on duplicates. It is **partial**, so a withdrawn or declined interest can be re-sent later — which is why `status` is in the predicate and not the column list. |
| `trg_interests_updated_at` → `public.touch_updated_at()` | otherwise `updated_at` is only ever set by whichever caller remembered to pass it |

> **A partial unique index fails to build if the table already holds two `pending` rows for the same pair.** Check before applying: `select from_profile_id, to_profile_id, count(*) from interests where status = 'pending' group by 1, 2 having count(*) > 1;` De-duplicate by keeping the newest row.

> **`profiles_read` no longer lets the world read every row** — it admits the owner's own row, `verified = true and status = 'active'` (the public browse gate), and the admin JWT claim, so `profiles.interested_profile` is no longer world-readable for pending/rejected profiles. That closes the privacy item this note used to flag.

**`service_providers_public_insert` is the only truly anonymous write path** (`for insert to anon`, `with check (is_approved = false and active = false)`) — the vendor register form. Every other write is scoped either to the row's owner or to the admin JWT claim: authenticated members write their own `users` / `profiles` / `profile_photos` (registration), their `interests`, and their `membership_payments` checkout rows. Because anon can insert a service row from anywhere, the form needs rate limiting in front of the action for production; the row is inert while it sits unapproved, but nothing stops a bot filling the table.

### Route coverage

| Route | Source |
| --- | --- |
| `/communities`, `/success-stories`, `/membership` | **DB** (verified by row count) |
| `/services` | **DB**, filtered in-query to `is_approved and active` |
| `/search`, `/brides`, `/grooms` | **DB** (fetches client-side). All three are `(app)` member routes |
| `/profile/[id]` | **DB** — `loadProfile(id)` in `features/profiles/queries.ts`, `force-dynamic`. Moved into `(app)` |
| `/interests` | **DB** — `fetchMemberInterests()` reading `interests` + `profiles` + `profile_photos` |
| `/jathagam` | **External astrology API** via server actions |
| `/temples`, `/temples/[temple_id]` | **DB** — `fetchTemples()` / `fetchTempleById()`, both reading the temple plus its services, images and festivals |
| `/communities/[id]` | DB community row + seed profiles |
| `/success-stories/[id]` | **DB**, `revalidate = 300` — `fetchStory(id)` in `queries.ts` |
| `/dashboard/*`, `/matches` | seed + `localStorage` |
| `/admin/*` (9 routes) | **DB**, real Supabase Auth gate |
| `/`, `/login`, `/register`, `/vendor-register` | static, reuse the above |

Writes: **`/vendor-register` is a real DB write** (`service_providers` insert as `anon`, gated by RLS). **`/register` is the other public write** and is the most complex: the `registerMember` server action writes Supabase Auth → `users` → `profiles` → `profile_photos` (the `users` insert covered by `users_insert_self`, the role/membership columns pinned by `pin_user_privileges()`), then emails the office via Resend. **Interests are real writes too** — `sendInterest` / `withdrawInterest` / `respondToInterest` / `markReceivedViewed` in `src/app/(app)/profile/actions.ts`, all under the `interests` RLS policies; see [Interests](#interests-publicinterests-tracking). **Membership checkout is a real write** — `submitPaymentRequest` in `src/app/(public)/membership/actions.ts` files a pending `membership_payments` row (screenshot uploaded to the private `payment_screenshots` bucket); an admin approval then creates the subscription. **The temple area is entirely admin-write** — there is no public submit path, though temples still carry `is_approved` / `active` gates (see [Temples](#temples-utemples--temples--temple_id)). Still seed-only: the `/dashboard/*` rollups and `/matches` scoring inputs.

`fetchDashboardData()` fans out all six admin loaders in one `Promise.all` and computes `verified`, `live`, `activeSubs` and `revenue` server-side, replacing the old client-side `useMemo` rollups.

Seed data ships in three tracked files. **`primary_seed.sql`** (communities + `membership_plans`, the plan `photo_limit`/`interest_limit` included) and **`seed_data.sql`** (users, communities, profiles, `profile_photos`, interests, service providers, temples + their `temple_festivals` / `temple_services` / `temple_images` children) are **idempotent** (`on conflict (id) do update`) and safe to re-run. **`success_stories_seed.sql`** is a plain `INSERT` with **no `on conflict`**, so re-running it against a populated table fails on the primary key. To change copy, edit the row in the database rather than the bundled fallback seed. Profile image URLs are `/assets/*.jpeg` but the files live in `src/assets` — they must be copied to `public/assets` or uploaded to Storage.

---

## State & Data Flow

All global state lives in React Context, composed in `src/components/providers/app-providers.tsx`:

```
ToastProvider → AuthProvider → pages
```

### `ToastProvider` (`src/lib/state/toast-provider.tsx`)
- `useToast()` returns the `toast(message, kind?)` function directly (kind is `success | error | info`).
- Top-right fixed stack, auto-dismisses after 3.5s, caps at 4 visible.

### `AuthProvider` (`src/features/auth/auth-provider.tsx`) — members area only
> **The admin area does not use this** (see Admin Console). Members authenticate against **real Supabase Auth with email + password only** — there is no username field, and no Google provider is configured.

- `resolveAppUser(authUser)` walks `auth.uid → public.users.user_id → profiles.profile_id` with the **browser** client, relying on RLS for authorization. It reads `name`, `email`, `phone_number`, `membership_plan` from the `users` row and `profile_id, gender` from the `profiles` row, then returns an `AppUser`.
- `AppUser` (`src/types/index.ts`) = `{ id, email, mobile, name, profileId, gender, plan }`. `gender` is `null` between sign-up and the first readable `profiles` row, so any UI branching on it **must** have a fallback; `plan` is the live tier (`"free" | "silver" | "premium"`) resolved at sign-in so nav and gates can hide premium-only entries without another round trip.
- `login` calls `auth.signInWithPassword` and signs the session back out if no `users` row resolves for the account.
- **The login form does not advertise any demo account.** The client demo card is gone, and `DEMO_CREDENTIALS` / `DEMO_USER` have since been removed from the codebase entirely. Sign in with a real Supabase account.
- **The mobile number is not a login credential.** Registration collects it into `public.users.phone_number`, but Supabase Auth never receives it. Do not add a phone/password path without a deliberate decision.
- **Confirm Email must be OFF** for the current registration helper — `signUp` returns no session when it is on, and `registerMember` then fails with the email-confirmation error.
- The `boot()` effect calls `getSession()`, then subscribes to `onAuthStateChange` and defers `resolveAppUser` through `window.setTimeout(…, 0)` to avoid a deadlock in Supabase's auth callback.
- API: `user`, `login`, `registerWithProfile`, `logout`, `isLoggedIn`, `isLoading`. There is **no `isAdmin`, no `demoLogin` and no `googleLogin`** — the context knows nothing about roles. `useAuth()` throws outside a provider; `AppProviders` mounts it globally under the root layout for **every** route group, admin included.

> **The member context carries no admin flag at all.** `AuthProvider` exposes only `user`, `login`, `registerWithProfile`, `logout`, `isLoggedIn`, `isLoading` — there is nothing here for the admin area to (mis)read. Authorization is the server-side `app_metadata.role` claim; see the note under Admin Console.

---

## Member Area (`(app)`)

### Session gate

`src/app/(app)/layout.tsx` calls `await getCurrentMember()` (see the loader table above) and `redirect("/login")` when there is no member. That server check is the real gate; `MembersSignInWall` is only rendered in the unconfigured-Supabase branch. As with the admin area, a layout is not re-run on every client navigation, so anything reading private data still goes through the DAL.

### `DashboardShell` (`src/components/layout/dashboard-shell.tsx`)

- **Width is per route, not global.** `FULL_WIDTH_ROUTES` is a `Set` of exact paths checked against `usePathname()`, plus one prefix rule: `/dashboard`, `/brides`, `/grooms` render with no max width, and **anything under `/profile/` matches `pathname.startsWith("/profile/")`**, so every profile detail view is full width without needing an entry per id. Every other member page keeps `max-w-7xl`. The dense grids and multi-column filter bars waste a desktop screen under a reading cap, while a form does not. **Adding a member page means deciding which list it goes in.**
- Desktop: 240 px sticky sidebar + content column, with the Upgrade / Sign out actions right-aligned above the page.
- Mobile: logo + a search icon + sign-out in a top row, and `MobileTabBar` pinned at the bottom. The top-row search icon resolves from the same `browse()` helper as the sidebar, so it points at the signed-in member's side.
- The member's **name and Groom/Bride badge card was removed from the sidebar on request**. Do not re-add it.

### Sidebar order (`src/components/layout/dashboard-nav.tsx`)

**Desktop**, top to bottom: `Dashboard`, `My Matches`, **the browse item**, `Interests`, `My Profile`. (`Membership` is present but commented out in the `items` array — re-enable the line rather than adding a second entry.)

The browse item is **not** in `items`. It is spliced in by `const [first, second, ...rest] = items` and reinserted after the second, so it always lands between "My Matches" and "Interests" no matter how the list is edited.

**Mobile** (`MobileTabBar`) is a hand-written five-item list with a different order: `Home`, `Matches`, `Interests`, **browse**, `Profile`, on a `grid-cols-5`. So Interests sits *before* browse on mobile and *after* it on desktop. That inconsistency is deliberate — the mobile bar is a fixed grid and the browse item takes its label from `target.short` ("Brides"/"Grooms"/"Browse"), which would crowd the position the user asked Interests to have. **Keep both lists in sync when adding an item; do not derive one from the other.**

`browse(gender)` returns `{ label, href, short, icon }` and is the single source of truth for that item:

| Signed-in `gender` | Label | Destination |
| --- | --- | --- |
| `"male"` (groom) | Brides | `/brides` |
| `"female"` (bride) | Grooms | `/grooms` |
| `null` (no profile row yet) | Brides / Grooms | `/search` |

Only one side is ever offered. A member browses the opposite side; the `null` row must fall back to the unfiltered page rather than guess.

### `/brides` and `/grooms` (`src/app/(app)/brides/page.tsx`, `…/grooms/page.tsx`)

- **Member-only.** These were moved out of `(public)` deliberately — browsing is a member benefit, and a guest following a stale public link is sent to `/login` by the `(app)` layout. `PUBLIC_NAV` and the footer never listed them.
- Each is a server component that renders `<MemberPageHeader>` then `<SearchView gender="female" />` (brides) or `gender="male"` (grooms).
- `MemberPageHeader` (`src/components/layout/member-page-header.tsx`) supplies the title, an optional description and — importantly — a **"Back to dashboard" link**. The sidebar is `hidden lg:block`, so a member page reached from it has no other way back on a phone. The link targets `/dashboard` rather than `history.back()` so it lands somewhere known even when the page was opened directly. **Any new `(app)` page reachable only from the sidebar needs it.** The exception is a page that is *also* in the mobile bottom tab bar — `/dashboard`, `/matches`, `/interests` — which is already one tap away, so `/interests` renders its own `<h1>` instead.
- The home page's "view profiles" CTA points at `/search`, not `/brides`. **This no longer spares an anonymous visitor the login wall** — `/search` moved into `(app)` too, so every browse CTA lands on `/login` for a signed-out visitor. That is the intended trade (the member area is the product), but do not re-point a CTA at `/search` expecting it to be public.

### Interests (`public.interests` tracking)

The record of an interest is a **row in `interests`**, not an entry in a `localStorage` array. This replaced `DemoStoreProvider`, which is deleted.

**Why the array was not enough.** `profiles.interested_profile` is a `text[]` of the `profile_id`s one member has written to. It answers *"who has this member contacted"* and nothing else: no timestamp, no status, and no way for the **recipient** to find the interest at all, because the row it would live on belongs to the sender.

| | `profiles.interested_profile` | `interests` |
| --- | --- | --- |
| Answers | "who have I contacted?" | "who contacted me, and what happened?" |
| Visible to the recipient | no | yes |
| Status / date | none | `status`, `created_at`, `updated_at`, `viewed` |
| Keyed on | `profiles.profile_id` (text) | `profiles.id` (uuid) |

**The array is still written**, by `sendInterest` and `withdrawInterest`, and is still the duplicate-send check. It is *merged* on read rather than dropped, because a member who sent an interest before this landed has only the array and would otherwise watch their sent list empty out. Treat it as the sender's own address book that happens to be idempotent, not as the source of truth.

#### Read — `src/features/interests/data.ts` (server-only)

`fetchMemberInterests()` returns `{ received: Interest[], sent: Interest[] }`, both newest first.

- `getCurrentMember()` for `profileUuid`; no profile ⇒ both lists empty.
- **Two queries, one per side of the pair**: `.eq("to_profile_id", me)` and `.eq("from_profile_id", me)`. It does not filter by owner — the `interests` read policy already scopes rows to the two participants (or an admin), so the query only picks which side is "mine".
- Counterpart `profiles` are resolved in **one** `.in("id", uuids)` and their photos in **one** `.in("profile_id", …)` `.order("sort_order")`, rather than per-row queries.
- **A row whose counterpart profile was deleted is dropped, not rendered.** `to_profile_id` is nullable on delete, so the row can outlive its profile; there is nothing to show.
- `createdAt` is `""` for a legacy array-only send, and `createdAt || ""` keeps the sort total — a null timestamp must not throw a comparison.
- `formatRelativeTime("")` returns `"Invalid Date"`, so the UI **guards on `createdAt` before printing a date**. Never pass an empty string to it.
- No seed fallback and no empty-table fallback: a broken query throws. Interests are user data — inventing rows would be worse than an error page.

#### Write — `src/app/(app)/profile/actions.ts`

All four take the member identity from `assertMember()`, never from an argument.

| Action | Effect |
| --- | --- |
| `sendInterest(toProfileId)` | resolves the target `profileId` → uuid, appends to the array, **then** inserts the `interests` row (`pending`, `viewed: false`) |
| `withdrawInterest(toProfileId)` | removes from the array, sets the row `status = 'withdrawn'` |
| `respondToInterest(id, accepted \| declined)` | recipient answers; sets `viewed: true` too |
| `markReceivedViewed()` | one bulk write; sets `viewed = true` for the member's unread, non-withdrawn received rows |

Three decisions worth keeping:

1. **The array is written before the row.** Two statements, no transaction. Array-first means a failed insert leaves the send visible in the sender's own list; row-first would leave a pending row the sender has no record of and no way to withdraw. The reverse trade — a duplicate row surviving a failed array write — is recoverable, because `withdrawInterest` marks by pair.
2. **Withdraw marks, it does not delete.** The row is the only evidence the interest was ever sent, and the recipient's history should show it was recalled rather than have it silently vanish. `.neq("status", 'withdrawn')` means a re-send followed by a withdraw only touches the newer pending row.
3. **`respondToInterest` filters on `to_profile_id = session`.** `interests_update` lets the *sender* write to the row too, so without that filter a member could answer their own interest. `RESPONSIBLE_STATUSES` rejects any status other than `accepted`/`declined` before the query runs.

The partial unique index `idx_interests_open_pair` is the tiebreak the application check cannot be: two concurrent sends can both pass the "is this already in my array" read, and only one insert can win. **Postgres error `23505` must be translated into the same "already sent" message** as the array check — see the `catch` in `sendInterest`.

`markReceivedViewed()` deliberately does **not** call `revalidatePath`. It is fired from an effect on the page that renders it, and revalidating there bounces the router off itself. The client marks the rows locally instead.

#### UI — `src/components/interests/interests-manager.tsx` (client)

- Two tabs with live counts, then one row per interest carrying **status + the action that status allows**: pending received rows get Accept/Decline, pending sent rows get Withdraw, and anything answered renders a plain sentence instead of buttons.
- `STATUS_TONE` maps status to a `Pill` tone (`accepted`→good, `pending`→warn, `declined`→bad, `withdrawn`→neutral).
- **`busy` holds the interest `id`, not a boolean** — only the row being acted on should look busy.
- The lists are owned in `useState` seeded from props, because the server actions patch one row and a re-render would drop the member's tab.
- A legacy array-only send has `id === ""`, so its Withdraw button is `disabled` — there is no row behind it to act on.
- `<ProfileGrid>` still renders beneath the rows. It is the visual index; the rows are where the actions live, because `ProfileCard` only offers a link out.
- "accepting opens a private chat" is **aspirational** — there is no messaging code in the repo. Accepting records the match and nothing more. Do not build on the promise without building chat.

> **The copy is a lie until chat ships.** Accepting an interest currently has no follow-on effect at all. Treat the accepted state as a placeholder for the match record.

---

## Features (logic layer)

Domain logic lives in `src/features/`, grouped by feature, no React/route imports in the data files:

### `features/profiles/`
- `queries.ts` — pure functions, no React:
  - `filterProfiles(source, filters, sort)` — the real filter/sort implementation, taking an explicit profile array. All filtering and sorting happens here, client-side, so the filter controls stay instant.
  - `searchProfiles(filters, sort)` — thin seed-backed wrapper over `filterProfiles` for sections that have not been migrated.
  - `loadSearchProfiles(...)` / `loadProfile(id)` — DB-first async variants used by migrated routes.
  - `computeMatchScore(profile, current)` — weighted match scoring (age, location, religion/community, education, profession, lifestyle) producing a 74–99 match %.
  - `getRecommendedMatches`, `getNewMatches`, `getNearbyMatches`, `getRecentlyActive`, `getFeaturedProfiles`, `getDashboardStats` — convenience queries for sections. **Still seed-backed**, including the home page's `getFeaturedProfiles(8)`.
- `data.ts` — seed profile list; exports `profiles`, `getProfileById`, `CURRENT_USER_ID`.

### `features/search/`
- `types.ts` — `SearchFilters` + `SortKey` (shared by `profiles/queries.ts` and the search components).
- `helpers.ts` — `queryString()` / `parseQuery()` for keeping filters in the URL.

### `features/jathagam/` — a **remote API client**, not a local calculation

> The old `calculatePorutham()` / `verdictFor()` / `PoruthamStatus` exports **no longer exist**. All scoring comes from an external astrology engine; there is no local engine in the repo.

**`service.ts` (416 lines, zero imports)** — a plain fetch wrapper. It has **no `import` statements at all** and cannot be made server-only by the `server-only` package, which is **not a dependency**. Server-only-ness is by convention: only the server actions import it as a *value*; the client imports **types only** (`import type { Koota, MatchReport, Place }`).

| Export | Detail |
| --- | --- |
| `CALCULATION_METHOD` / `CALCULATION_VERSION` | `"ashtakoota+porutham"` / `"1.0"` — sent/stored so a result can be tied to a scoring version |
| `JathagamApiError` | `extends Error`, carries an optional `status` |
| `isJathagamConfigured()` | `Boolean(process.env.JATHAGAM_API_URL?.trim())` — non-throwing, safe on the server |
| `JathagamResult<T>` / `jathagamFailure()` | `{ok:true,data} \| {ok:false,error}`; the failure helper passes `JathagamApiError.message` through and replaces anything else with a generic message (no stack leaks) |
| `Place` | `{place, displayName, latitude, longitude, timezone, elevation, country, state?}` |
| `searchPlaces(query)` | `GET /location/autocomplete?query=…&limit=8`. Returns `[]` for a query under 2 chars. **Drops any result whose `latitude`, `longitude` or `timezone` is not a number** — a place without coordinates/timezone cannot be calculated for. |
| `MatchPersonInput` | `{name, date, time, place}`. **No `gender` field** — the engine is not sent it and the UI shows a static badge instead. |
| `Koota` | `{key, label, tamil, score, max, failed, quality?, detail?}` |
| `PersonChart` | `{nakshatraNumber, padaNumber, raasiNumber, nakshatraName, raasiName, nadi, gana}` |
| `Dosha` | `{mars, sun, saturn, rahuKetu, total}` |
| `MatchReport` | `{boy, girl, ashtakoota: {kootas, total, max, percentage, rating}, porutham: {checks, matched, total, percentage, rating, minimumSatisfied}, boyDosha, girlDosha, beejaRasi, kshetraRasi}` |
| `marriageMatch(boy, girl)` | `POST /marriage-match` |

Environment: **`JATHAGAM_API_URL`** (required, trailing slashes stripped) and **`JATHAGAM_API_KEY`** (optional, sent as `Authorization: Bearer`). Neither is `NEXT_PUBLIC_` — both are server-side only. Requests use `cache: "no-store"` and `AbortSignal.timeout(20_000)`.

`baseUrl()` throws **before** the try block, so a missing env var is reported as "not configured" rather than as a network failure. A fetch throw becomes "Could not reach the astrology engine"; a non-OK response parses FastAPI's `detail` (array → join each `d.msg` with `"; "`, string → as-is) and carries the status.

**Response mapping notes worth knowing:**
- `readKootas` iterates the **label map's own key order**, so the private `ASHTAKOOTA_LABELS` / `PORUTHAM_LABELS` maps define the display order. Two keys are renamed for display: `raasi_bahut_porutham` → "Bhakoot", `naadi_porutham` → "Nadi".
- Gana and Nadi are **not** on the chart blocks — they are regex-extracted from the Ashtakoota section (`Rakshasa`/`Manushya`/`Deva`, `Aadi`/`Madhya`/`Antya`).
- `time` is normalised to `HH:MM:SS` (seconds always appended as `:00`).
- Defaults: ashtakoota max `36`, porutham total `10`, unknown names → `"Unknown"`.

**`data.ts` (106 lines)** — reference data only, no scoring logic:
`Gana` type, `Yoni`, `Nakshatra` interface, `RASI_NAMES` (12), `RASI_TAMIL` (12), `RASI_LORDS` (**keyed 1–12**), `GANA_TAMIL`, `RASI_RANGES` (derived strings like `"0° – 30°"`, en dash, 0-based array), `nakshatras` (27, `rasi` 1-based), `getNakshatraById(id)` (wraps with `(id - 1 + 27) % 27`).

> The two koota label maps are **module-private in `service.ts`, not exported** — do not look for them in `data.ts`.

**`src/app/(public)/jathagam/actions.ts`** — the only path to the engine. `findPlacesAction(query)` and `marriageMatchAction(boy, girl)`, both returning `JathagamResult<…>`, both guarded by `isJathagamConfigured()`. **No server-side re-validation of the payload and no rate limiting** — see Key Implementation Notes.

**`src/app/(public)/jathagam/page.tsx`** — server component; passes a **plain boolean** `enabled={isJathagamConfigured()}` to the calculator. The env var itself never reaches the client. When disabled the calculator renders a "being configured" message instead of the form.

**`src/components/jathagam/jathagam-calculator.tsx` (838 lines, client)** — `JathagamCalculator({enabled})` plus private `ScoreRing`, `PlacePicker`, `PersonCard`, `ChartFacts`, `KootaCard`, `DoshaBars`, `Note`.
- Form fields per person: Name, Date of birth, Time of birth, Birth city. No `name`/`required` attributes — it is a controlled React form; required-ness lives in the `submit()` guard chain. **Name is never validated.** Placeholders are "Groom name" / "Bride name".
- `PersonCard` shows a **static** "Male"/"Female" pill. It is display-only and is not sent anywhere.
- `PlacePicker` — 300 ms debounce, a monotonic `latestRequest` ref so a slow earlier response can never overwrite a newer one, click-away close, `ArrowDown/Up/Enter/Escape` keyboard support, and full combobox/listbox ARIA. **Editing after a pick calls `onChange(null)`**, so a stale selection can never be submitted against changed text. Options show coordinates and UTC offset.
- `PersonCard` is deliberately **not** `overflow-hidden` — the absolutely-positioned dropdown would be clipped. The top rail is a 4 px `rounded-t-3xl` gradient instead.
- `ScoreRing` — 140 px SVG, the number always rendered inside the ring so colour is decoration only. `toneFor(percent)` thresholds `>= 70` emerald / `>= 45` gold / else wine.
- `ChartFacts` reads `RASI_TAMIL[raasiNumber - 1]` (engine numbers are 1-based, the array is 0-based) and hides Nadi/Gana rows when empty.
- No comment-free rule here: this file carries explanatory comments justifying non-obvious choices (debounce race, missing `overflow-hidden`, tone palette).

### Public Vendor Register (`/vendor-register`)

- `src/app/(public)/vendor-register/page.tsx` — server component: dark wine hero listing every `SERVICE_TYPE_LABELS` value as a chip, then the form plus a sticky aside of three promises and a note on how the listing will appear.
- `src/app/(public)/vendor-register/actions.ts` — `registerVendorAction` (a `"use server"` action consumed via `useActionState`). Validates, then inserts with **`is_approved: false, active: false`**. When Supabase is not configured it returns a friendly "call us instead" message rather than pretending to save, and on a successful insert it emails the office via `sendVendorRegistrationEmail` (best-effort — a mail failure never fails the submission).
- `src/components/services/vendor-register-form.tsx` — client form. **Field names, order and required flags mirror the admin vendor form exactly** — Category, Vendor name, Contact person, City, Phone, Details; required are name, city, phone. Anything stricter would reject submissions the admin screen would have accepted. On success it swaps to a "we have your details" panel.
- Nothing revalidates `/services` on submit, because the submission cannot affect it.

### Approval flow

```
vendor submits  →  insert is_approved=false, active=false
                →  row stored (details not lost) but unreadable to anon
                →  admin sees gold banner + Pending pill on /admin/services
                →  Approve  → is_approved=true, active=true  →  visible publicly
                →  Not approve → both false, row kept   |   Hide → active=false only
```

The read policy is `using (is_approved and active)`, so an unapproved row is not merely filtered out of the page — anon cannot read it over a direct table query. `fetchServices()` also pushes `.eq("is_approved", true).eq("active", true)` into the Supabase query, so nothing unapproved leaves the database at all.

> **Re-paste `table_creation.md` and `table_policies.sql` to roll an existing database forward.** The `is_approved` column, its backfill, and both service-provider policies all live in those two files, so one paste of each brings a live database in line with a fresh one.

### `features/services/`
- Vendor services — mandapams, Franchise Partners, catering, event management, photography, decoration.
- `types.ts` — `ServiceProvider` model + `ServiceType` + labels/category maps (see Vendor Services above for the gate semantics).
- `data.ts` — holds only the admin form's submit shape: `type ServiceInput = Omit<ServiceProvider, "id" | "addedAt" | "active" | "isApproved">`. There is no local store or seed list any more; the old localStorage CRUD (`loadServices()`, `addService()`, `resetServices()`, 11 bundled providers) was removed.
- `mappers.ts` → `toService()` maps `is_approved` to `isApproved` with a deliberate fallback: `row.is_approved == null ? Boolean(row.active) : Boolean(row.is_approved)`. Without it, `Boolean(null)` would mark every pre-existing row unapproved and unpublish the whole site if the backfill in `table_creation.md` were ever skipped.

### Other feature folders
- `auth/auth-provider.tsx` — the auth context (see State & Data Flow).
- `communities/data.ts` — community directory (`communities`, `getCommunityById`, `profileCommunityNames`, `profileCountFor`). **Seed only** — the live copy comes from the `communities` table; see [Writing community copy](#writing-community-copy--edit-the-database-not-the-seed).
- `temples/types.ts` — the domain types and the shared URL validators. **No `temples/data.ts`**: the temple area has no seed fallback at all, so an empty table renders an empty page rather than invented temples.
- `stories/data.ts` — the bundled **fallback** story list (`successStories`, `getStoryById`). Both `/success-stories` (list) and `/success-stories/[id]` (detail, via `fetchStory`) read the `success_stories` table — this file only renders when that table is empty or unreachable. Story images are low-res `w=200` URLs; use them at avatar size only.
- `membership/data.ts` — Free / Silver / Premium plans + match-score breakdown (`membershipPlans`).
- `interests/data.ts` — **not seed data.** `fetchMemberInterests()`, the DB loader behind `/interests`, server-only because it reads the cookie session. See [Interests](#interests-publicinterests-tracking).
- `services/data.ts` is the one remaining `localStorage` store under `features/` (key `subhavivaham_admin_services`), and it is unused in Supabase deployments.

---

## Communities & Success Stories pages (redesigned)

Both public pages are thin server components that compose inline — there is no `components/communities/` or `components/stories/` folder, and moving them there is optional, not required.

### `/communities` (`src/app/(public)/communities/page.tsx`)

- Data: `Promise.all([fetchCommunities(), fetchProfiles()])`. The per-community count is computed **in the page** by folding `profiles` into a `Map` keyed on the lowercased `community`, falling back to the lowercased `tamilName`. So the number on a card reflects rows actually in the database, not the seed's `visibleMembers` field.
- Structure: light eyebrow hero → 3-column card grid → a dark `bg-charcoal-950` "Don't see your community?" CTA band.
- Card anatomy (`rounded-2xl border border-wine-500 bg-white p-7`, `hover:border-wine-900`): community name in `font-display text-2xl text-wine-700` (→ `wine-900` on hover), Tamil name right-aligned in `text-charcoal-400`, **full description with no `line-clamp`**, then a `mt-auto` footer (hairline top border) with the profile count and a circular arrow button that fills `wine-700` on hover.
- `h-full` + `flex flex-col` + `mt-auto` on the footer is what keeps footers aligned when descriptions differ in length. Do not reintroduce `line-clamp` here — full copy was a deliberate request.
- The **category badge and the initial-letter tile were both removed** on request, and the `category` column has since been dropped from the model, the admin manager and the table itself.
- The dark CTA band is duplicated verbatim in `/success-stories`. Its two CTAs are full-width on mobile and inline from `sm` (`sm:mt-0 sm:ml-3`).

### `/success-stories` (`src/app/(public)/success-stories/page.tsx`)

- Data: `fetchStories()`; destructured as `const [featured, ...rest] = successStories`. **The first story is promoted to the featured editorial card** and excluded from the grid, so the grid renders `stories.length - 1` cards.
- Structure: full-bleed `STATIC_IMAGES.couple1` hero with a `bg-charcoal-950/78` overlay → featured split card on `bg-ivory-50` → quote-led grid on `bg-white` → wine CTA band.
- The hero stat row (Stories / Avg. match / Cities) was **removed** on request.
- Story images in `features/stories/data.ts` are low-res Unsplash URLs (`w=200`). They are used at **avatar size only** in the grid (a 14×14 `rounded-full` span with `sizes="56px"`). Large panels use `STATIC_IMAGES.couple1`. Do not promote a 200px URL into a hero or a half-width panel — it will visibly blur.
- `h-full` + `flex flex-col` + `flex-1` on the quote keeps the match/arrow footers aligned across the grid.

### `/success-stories/[id]` — single column

The sticky right-hand aside (square image + a gold "Compatibility" tile) was **removed**. The article is now one centred `max-w-3xl` column, and the file no longer imports `next/image`. The match percentage is still communicated by the gold badge in the header, so nothing was lost.

### Writing community copy — edit the database, not the seed

> **This is the single most common way to waste an hour on this page.** `fetchCommunities()` selects the `communities` table, and `src/features/communities/data.ts` is **only a fallback** used when that table comes back empty (`mapped()` in `src/lib/data/queries.ts`). Editing `data.ts` therefore changes nothing on screen while the table has rows — and the page renders fine, so the edit looks like it half-worked.

- Descriptions live in the `communities` table, seeded idempotently by **`primary_seed.sql`** (and again in `seed_data.sql`) as `insert … on conflict (id) do update`. Correct copy by editing the row in the Supabase SQL editor or re-pasting either file. (An older `update_community_descriptions.sql` used to do this and is gone.)
- Do **not** re-run `success_stories_seed.sql` blindly — it is a plain `INSERT` with no `on conflict` and fails on the primary key once the stories exist.
- Keep `features/communities/data.ts` in sync with the table; it is the fallback that renders when the database is unreachable.
- Writes to `communities` are admin-only. `communities_admin_write` is `for all to authenticated` gated on `app_metadata.role = 'admin'`, so a `PATCH` with the **publishable** key returns `200` while updating **0 rows** — a silent no-op, not an error. Verify any write with a follow-up `select`.

### Dev-server gotcha: a 404 on a route that exists

A route can 404 in Turbopack dev after a rewrite to its `page.tsx` even though the file is valid on disk (`/communities` 404'd while `/communities/[id]` returned 200 from the same folder). The route manifest goes stale; touching the file (`(Get-Item <path>).LastWriteTime = Get-Date`) re-registers the segment, and a dev-server restart clears it. Check this **before** debugging the component.

---

## Mobile Responsiveness (conventions)

The app is audited to be mobile-safe. Observed conventions to keep:

- **Tables** always render through `admin/table.tsx` (`overflow-x-auto` + `min-w-[600px]`), or wrap the raw table in `overflow-x-auto` (see `/membership` comparison table — do not use `overflow-hidden`).
- **Logo** (`brand/logo.tsx`) is responsive: md `h-10 w-40`→`sm:h-12 sm:w-52`, lg `h-12 w-48`→`sm:h-16 sm:w-64`.
- **Stats grids**: `grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4` (admin dashboard, member dashboard).
- **ProfileGrid**: base `grid-cols-1 min-[380px]:grid-cols-2 …`, columns only from `lg/xl`.
- **Member mobile top bar** (`dashboard-shell.tsx`): icon buttons are `shrink-0` so the logo absorbs any squeeze on 320px screens.
- **Admin topbar**: breadcrumb title pill (truncates), sign-out collapses to an icon on phones; drawer capped at `w-72 max-w-[85vw]`.
- No `whitespace-nowrap` outside a scroll container; `min-w-` values inside scrollable tables are fine.

---

## Performance Notes

- `useFakeLoading` (the 350–400ms skeleton hook once used on `/dashboard`, `/matches`, `/search`) was **removed** — pages now render real data immediately. The hook file no longer exists.
- Production build response times measured via `npm run build && npm run start` are ~30–80ms per route (first hit ~330ms, SSR warm-up). Perceived slowness is a **dev-mode** artifact (Turbopack on-demand route compilation on Windows FS). For demos/speed checks, serve the production build.
- The admin area is server-rendered/static; only the login gate, shells, and interactive components (services manager, forms) are client components.

---

## Brand Identity

Central brand facts in `src/lib/constants.ts` → `BRAND`:

- Name **Subha Vivaham**, tagline "Connecting hearts, bringing families together."
- Website `https://www.Subha Vivaha.com`, proprietor **S.Ramalingam Pillai**
- Phone / WhatsApp `+91 88839 43711` (whatsapp: `88839 43711`), landline `04630 - 261186`, email `hello@Subha Vivaha.com`
- GSTIN `33NPV5847N1Z5`
- Offices: Office 1 — `1-56/1, Sub Register Off Street, Murappanadu, Tuticorin - 628 252`; Office 2 — `3/58, Natarajar Sannathi Street, Vallanadu, Tuticorin - 628 252`
- Socials: Instagram, Facebook, X (placeholder links)
- Franchise contact used in home sections / jathagam CTA: **R. Viswanathan — 85086 30290** (kept separate from `BRAND`).

### Design tokens (`src/app/globals.css`, Tailwind v4 `@theme`)

Wine palette is **maroon** (naming kept for legacy compatibility): `wine-700 #7a1832` (primary), `wine-800 #61122a`, `wine-950 #330816`, `wine-500 #b53a63`, `wine-300 #e08ba6`. Gold `gold-500 #d4af37`, `gold-600 #b9942c`, `gold-300 #ebd876`. Backgrounds `ivory-50 #fffdf4`, `ivory-100 #fff8e7`. Text `charcoal-900 #252525`, `charcoal-500 #6f6f6f`. Plus `shadow-card`, `shadow-card-hover`, `shadow-soft`, and keyframe animations (`fade-in`, `scale-in`, `slide-up`, `slide-in-right`). All 11 steps of `wine` and `charcoal` and 5 of `ivory` are defined in the `@theme` block — `ivory` stops at 400, so `ivory-500` and below do not exist.

Fonts: Inter (sans, body) and Playfair Display (display, headings) via `next/font/google`.

---

## Key Implementation Notes

- **`next.config.ts`** allows `remotePatterns` for `images.unsplash.com`, `randomuser.me`, `*.supabase.co` and `upload.wikimedia.org`. These are **live dependencies, not leftovers**: `/success-stories` pulls `STATIC_IMAGES.couple1` (Unsplash) for its hero, every story card image is a remote Unsplash URL, and temples render Wikimedia commons photos. The home hero, the logo and the login side panel are local (`src/assets/*`). Two things in this file drift easily: the comment beside the `*.supabase.co` pattern still points at a `migrations/0001_registration_photo_uploads.sql` that **does not exist** (there is no `migrations/` folder — the buckets are created in `table_creation.md`), and `experimental.serverActions.allowedOrigins` is pinned to `["subhavivahamdemo.vercel.app"]`, which **must equal the deployment host**. Vercel reports its own host in `x-forwarded-host`, which does not match the browser's `Origin`, and Next aborts the action on that CSRF check with a bare 500 before the action runs — so every form (admin login included) fails. If you deploy under a different host, add it to `allowedOrigins` (or source the list from an env var) and redeploy.
- **The login page image is vendored, not hotlinked.** `STATIC_IMAGES.heroAlt` (`src/lib/constants.ts`) is a static import of `src/assets/login-hero.jpg` (740×740, ~47 KB), and the `<Image>` in `login-form.tsx` is `priority unoptimized` inside a `max-h-[560px]` container. Earlier candidates from `cdn11.bigcommerce.com` and `img.magnific.com` were tried as remote URLs but timed out behind Next's image optimizer in dev, so they were dropped rather than whitelisted — if a future image must be remote, prefer a host that is actually fast.
- **Images**: components use Next `<Image>`. Story images are fetched at `w=200`, so they belong in avatar-sized frames only — do not scale one into a hero or a half-width panel. Larger panels should use `STATIC_IMAGES.couple1..3` (1200–1400px) or a local `src/assets` import.
- **No comments policy** — mostly holds, with deliberate exceptions: `features/jathagam/service.ts` and `features/jathagam/data.ts` (they document non-obvious mapping decisions) and `components/jathagam/jathagam-calculator.tsx` (debounce race, missing `overflow-hidden`) carry explanatory comments. Keep new explanatory comments in those files; elsewhere match the surrounding style.
- **Registration** (`src/components/forms/register-form.tsx`) is an **8-step wizard** (Account → Basics → Background → Family → Lifestyle → Location & about → Partner Preferences → Photos). On submit it calls the **`registerMember` server action** (`src/app/(public)/register/actions.ts`), which writes the Supabase Auth user → `users` → `profiles` → `profile_photos` rows and emails the office, then calls the client `registerWithProfile` so the auth provider picks up the new session. Per-step validation lives in **`src/lib/registration.ts`**, not in the component, so the same rules run server-side. Several things worth knowing:
  - **The password field uses `PasswordInput`** (`components/ui/password-input.tsx`) — the same eye/eye-off reveal toggle as login — so "Create your login" and login never drift apart in behaviour.
  - **A rejected submit navigates to the step that owns the error.** The server action validates all eight steps in one pass, so it can return an error for a field the wizard is no longer showing (e.g. a duplicate email on step 1 or a duplicate mobile on step 2). `ERROR_FIELD_STEPS` in `register-form.tsx` maps every error key to its step, and `earliestStepWithErrors()` sends the member back to the earliest step with an error so the highlight is actually visible — the old behaviour showed the notice with nothing highlighted on screen.
  - Two fields are worth knowing:
    - **The introduction has a real floor: `ABOUT_MIN = 300` characters** (and `ABOUT_MAX = 1500`, enforced because `profiles.about` is an unbounded `text` column). Both are counted on the **trimmed** value, so trailing whitespace cannot pad a short answer past the bar. The hint shows `n/300 characters minimum · 1500 maximum` off one shared `aboutLength` variable.
    - **Birth location is restricted to Tamil Nadu districts** (`TAMIL_NADU_DISTRICTS`, 38 entries) — this is still a known limitation to raise before launch.
- **Community options come from the database, not a constant.** `src/app/(public)/register/page.tsx` is `force-dynamic` and passes `fetchCommunities()` into the form, and the same `communities` array feeds both the **Community** and **Preferred community(ies)** controls — they are one admin-managed list, so a community an admin deactivates disappears from registration immediately. An empty list renders an empty checkbox group rather than a fallback list; verify `select count(*) from communities where active = true` before assuming the form is broken.
- **Astrology API** — there is no local porutham engine. `marriageMatchAction` forwards the browser-supplied payload to the engine with **no server-side re-validation and no rate limiting**; place autocomplete is the only guard on cost. Ownership, uptime, rate limits and auth for the engine are all unconfirmed. An astrologer should still sign off on the score wording and thresholds.
- **Jathagam results are not persisted.** `CALCULATION_METHOD` / `CALCULATION_VERSION` exist in `service.ts` so a result could be tied to a scoring version, but no history table or storage exists yet.
- **Astrologer sign-off is still outstanding** on the Ashtakoota/Porutham presentation.
- **Membership checkout is live — and manual, with no gateway.** A member on `/membership` picks a paid plan and opens the checkout modal (`components/membership/plan-checkout.tsx`): it shows the office UPI id / QR and the amount, and takes a payment-screenshot upload. `submitPaymentRequest` (`src/app/(public)/membership/actions.ts`) uploads the screenshot to the private `payment_screenshots` bucket and files a pending `membership_payments` row. **Approval is the grant path**: `approvePaymentAction` on the admin Payments screen creates the `subscriptions` row and sets the member's plan; `rejectPaymentAction` closes the request without granting. Per-plan limits are enforced from **`src/lib/payments/quotas.ts`** — `PHOTO_QUOTA` `{ free: 1, silver: 5, premium: 10 }`, `INTEREST_QUOTA` `{ free: 3, silver: 25, premium: null }` (unlimited) — via `resolveMemberPlan` / `resolvePlanLimits`.
- **Notifications** rows are whole-row `Link`s to `/profile/[id]` when a `profileId` is present (they mark the notification read on click); otherwise a plain button. Avoid nesting interactive elements inside them (caused a hydration warning historically).
- **Supabase**: `src/lib/supabase/client.ts` and `server.ts` throw a clear "not configured" error when creds are missing, and `mode.ts` warns once on the server. `proxy.ts` swallows auth errors so a stale session cannot 500 a request.
- **`src/proxy.ts`** replaces the deprecated `middleware.ts` in Next 16; keep the filename/export (`proxy`) intact when enabling session refresh.
- **AdminShell** is an enterprise layout: fixed left sidebar + full-width content; the topbar shows only the page title (identity appears once, in the sidebar footer). React lint forbids defining components during render — prefer JSX variables.
- **Supabase env**: `.env.local` sets `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. **There is no `NEXT_PUBLIC_DATA_MODE`** — it was removed along with mock mode. `mode.ts` prefers `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and falls back to `NEXT_PUBLIC_SUPABASE_ANON_KEY`; preserve the key's trailing `-`. These values are inlined at build time, so a change needs a rebuild.
- **Moving a route between `(public)` and `(app)`** changes who can reach it and which shell renders it. After the move, run `npx next typegen` or `tsc` will fail on stale `.next/types/validator.ts` entries, and audit every link to the old path — a public link to a member page silently becomes a redirect to `/login`.
- **Async component gotcha**: making a component `async` (e.g. `PricingPlans`, `CommunitiesPage`) requires every parent to be `async` too. `tsc` will not catch this — it fails at build with a Pages-Router/Server-Component error.
- **SQL execution**: there is no local Postgres or Docker in this environment. Schema, RLS, and seed changes must be pasted into the Supabase SQL editor. The editor continues past errors, so a half-failed batch looks successful — always confirm with `select … from pg_policies`.
- **All schema, RLS, trigger and policy changes ship through the root SQL files — there is no `migrations/` folder.** A new column is an `add column if not exists` block plus a backfill `update` plus `set not null` in `table_creation.md`, so re-pasting the file rolls a live database forward safely (follow `profiles.district`, `profiles.caste`, the `profile_details` fold-in). A `create unique index`, a `create trigger`, or a policy rewrite is written idempotently too and lands in `table_creation.md` or `table_policies.sql` (policy definitions always in the latter), and `table_deletion_query.md` gains any teardown it needs — so a fresh database gets every change by re-pasting `table_deletion_query.md` → `table_creation.md` → `table_policies.sql` in order, and nothing needs a numbered migration file.
- **One-off copy edits are done as a one-row `update` in the Supabase SQL editor, not a schema file.** The retired `update_community_descriptions.sql` was the precedent: an idempotent `update … from (values …)` that could be pasted and re-pasted. Keep wording changes separate from `table_creation.md`, which is about structure.
- **Adding a member `(app)` page:** compose `MemberPageHeader` (it carries the back-to-dashboard link the hidden sidebar cannot provide), and add the path to `FULL_WIDTH_ROUTES` in `dashboard-shell.tsx` **only** if it is a dense grid rather than a form — or, for a family of routes like `/profile/[id]`, add a `pathname.startsWith(...)` clause instead of one entry per id. If it is a new nav destination, add it to **both** the `items` array and the hand-written `MobileTabBar` list in `dashboard-nav.tsx`, at the requested position — those two files, not `constants.ts`, own the member nav.
- **`DemoStoreProvider` is gone.** There is no `localStorage` demo state layer and no `useDemoStore()`. Anything interactive that needs to persist is a database row; if a feature genuinely cannot be one yet, keep its state local to the component rather than reviving a global mirror.
- **Anything that branches on the member's gender** must handle `null` and must read it from `AppUser.gender` / `MemberIdentity.gender` (both from `profiles.gender`), never from the email or a hardcoded list.
- **A `200` from a `PATCH`/`POST` against Supabase does not mean a row changed.** With RLS, a request that matches no writable row returns success having written nothing. Any write made outside an admin session must be confirmed with a follow-up `select` — publishing copy is exactly where a silent no-op goes unnoticed.
- **Route 404 in dev after editing a `page.tsx`?** A stale Turbopack route manifest, not a broken component — `tsc` and `lint` both pass. Touch the file to force re-registration; if that fails, restart `npm run dev`.

---

## Conventions Checklist

- Start the dev server: `npm run dev` → http://localhost:3000
- After changes: `npx tsc --noEmit` then `npm run lint` (and `npm run build` before finishing). If a route moved or was added, `npx next typegen` first.
- Keep `app/` thin: new pages compose `components/*`, new data/logic goes into `features/<domain>/` (`queries.ts`, `actions.ts`, `data.ts`, `types.ts`).
- **Seed data lives under `features/<domain>/data.ts`; interactive mock state is gone** (`src/lib/state/demo-store.tsx` was deleted with the interests rewrite). Anything a page must show for real comes from Postgres, not from these — and the seed fallback is actively dangerous, since it hides a broken query **and** your own data edits.
- **Adding a DB loader:** public table → `lib/data/queries.ts`; private table → `lib/data/admin-queries.ts` (server-only). Never import `@/lib/supabase/server` from `queries.ts`. Verify the row count against the database — the seed fallback will hide a broken query **and will also hide your own data edits** (see [The seed is a fallback](#the-seed-is-a-fallback-not-the-source-of-truth)).
- **Changing page content that comes from the database:** update the table, not `features/<domain>/data.ts`. Editing the seed is a no-op whenever the table has rows.
- Use `cn()` from `@/lib/utils` for conditional className merging.
- Follow the existing component style (function components, `lucide-react` icons, Tailwind utility classes, design tokens) shown in `src/components/ui/*`.
- Home sections: add under `components/home/`, wrap in `<section>` + `SectionHeading`, wire into `page.tsx` only.
- **Admin**: route under `(admin)/admin/(protected)/`, compose shared `Card/Table/Row/Cell/Pill`; every page starts with `requireAdmin()`, every action starts with `assertAdmin()`, and any bundled rows live in `features/<domain>/data.ts`.
- **Admin auth**: never gate the admin area on `useAuth().isAdmin` or on `DEMO_CREDENTIALS`. Use `requireAdmin()` in a page/layout and `assertAdmin()` in an action; both read the server-validated `app_metadata.role` claim.
- **Publishing content publicly**: anything an outsider can submit needs an explicit review gate — see the `is_approved` / `active` pattern under Vendor Services. Never let a public write path set the flag the public read filter depends on.
- Mobile: verify with the audit conventions above (tables scroll, grids fall back to 1-col, fixed-width elements get `shrink-0` siblings).