# Subha Vivaham — Premium Matrimony Platform

Front-end codebase for **Subha Vivaham** ("சுப விவாஹம்"), a premium Tamil Nadu matrimony platform ("Connecting hearts, bringing families together"). The app is **MySQL-only**: there is no mock mode, no data-mode switch, and no Supabase anywhere. Page data is read from a real MySQL database through a pooled `mysql2` connection, and reads that fail are logged server-side rather than quietly served from bundled seed rows.

> **Migration status — the app is fully off Supabase.** The Supabase SDK is gone from `package.json`, the `src/lib/supabase/` folder is deleted, and every read/write goes through `src/lib/db.ts` (mysql2). Auth is **scrypt + a `sessions` table + an `sv_session` httpOnly cookie** (`src/lib/auth/session.ts`), not Supabase Auth. Because MySQL has **no row level security**, authorization is explicit: every member read filters by `user_id`, every admin action calls `assertAdmin()`, and the admin console ships its own `users.role = 'admin'` gate. See [Data Source (MySQL only)](#data-source-mysql-only) and [Auth](#auth--sessions).

> **Schema files.** `table_creation_mysql.sql` is the authoritative MySQL 8 schema (**16 tables**), followed by `primary_seed_mysql.sql` (plans, site_config, the admin account, communities) and then `success_stories_seed.sql`. `seed_data.sql` is the **original Postgres dump** — it has **not** been converted to MySQL and must be ported before it can be imported (see [Seed data](#seed-data)). `tables_document.md` and `table_deletion_query.md` are the legacy Postgres reference files.

> **`table_creation_mysql.sql` is idempotent and additive.** Every table is `create table if not exists`; column additions are `alter table … add column if not exists`; indexes use `create … index if not exists`; triggers are `drop trigger if exists` then `create trigger`. Re-running it rolls a live database forward. **RLS is not part of it** — there is no equivalent file, because MySQL has no RLS. Authorization lives in the application (see the note above).

> **JSON columns come back as strings from mysql2/MariaDB.** Any `json` column read must go through `parseJson()` / `jsonList()` in `src/lib/data/mappers.ts`. Reading one raw and calling `.map()` on it is the single most common bug in this codebase.

> **Content the database owns.** `/communities` and `/success-stories` render from MySQL, so the `features/*/data.ts` files are fallbacks used only when a table is empty.

---

## Getting Started (new developers — start here)

Prerequisites:

- Node.js 22.x + npm
- A MySQL 8 (or MariaDB) database with `table_creation_mysql.sql` applied — the app cannot render page data without it.

### SQL run order

| # | File | What it does | If you skip it |
| --- | --- | --- | --- |
| 1 | `table_creation_mysql.sql` | 16 tables, columns, indexes, `email_lower` generated column, `updated_at` triggers, the temple-image cap trigger | **nothing works** |
| 2 | `primary_seed_mysql.sql` | `communities`, the three `membership_plans`, the `site_config` row, **and the admin account** | no plans to subscribe to; no admin login; `/membership` renders empty |
| 3 | `success_stories_seed.sql` | the `success_stories` rows | `/success-stories` renders empty |
| 4 | `seed_data.sql` | the rest of the demo rows — **still Postgres syntax, must be converted first** | users/profiles/temples/services are empty |

### Local setup (XAMPP)

```bash
# 1. start MySQL in the XAMPP control panel, then create the database
#     name: subhavivaham · collation: utf8mb4_unicode_ci
# 2. import table_creation_mysql.sql, then primary_seed_mysql.sql,
#     then success_stories_seed.sql (phpMyAdmin → Import)
# 3. add DB_* to .env.local (see the env table below) — the defaults
#     already point at XAMPP (127.0.0.1:3306, root, empty password, subhavivaham)
npm install
npm run dev        # Turbopack dev server → http://localhost:3000
```

Dev vs. production speed: `npm run dev` compiles each route **on demand**; first visit to a route — or any visit after editing it — takes a moment on Windows. For a faithful, fast check use the production build:

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

> **Dependency fragility:** `typescript` and other dev dependencies have intermittently vanished from `node_modules` here. The reliable fix is to keep the committed `package-lock.json` and run `npm ci` rather than `npm install`. A truncated install shows up as *"This is not the tsc command you are looking for"*.

---

## Tech Stack

| Layer | Technology | Notes |
| --- | --- | --- |
| Framework | **Next.js 16.3.5** (App Router, Turbopack) | Server components by default, `"use client"` where needed |
| UI | **React 19.2.8** | Hooks + Context, no Redux. `useActionState` is the form-with-server-action pattern (see admin login, vendor register) |
| Language | **TypeScript 5** (strict) | Path alias `@/*` → `./src/*` |
| Styling | **Tailwind CSS 4** (`@tailwindcss/postcss`) | Design tokens via `@theme` in `globals.css` |
| Icons | **lucide-react** (v1.47.0) | Brand icons were removed — do not import them |
| Styling utils | **clsx** + **tailwind-merge** | `cn()` helper |
| Motion | **framer-motion 14** | Used in exactly three places: the scroll-reveal primitives, the `Modal`, and the wedding-intro overlay. Everything else animates with the CSS keyframes in `globals.css` — see [Motion & Animation](#motion--animation) |
| Backend | **mysql2/promise** (pooled) + raw SQL | The only data layer — MySQL, no ORM. See `src/lib/db.ts` |
| Auth | **Node `crypto` scrypt** + a `sessions` table + `sv_session` cookie | No third-party auth. See `src/lib/auth/session.ts` |
| Email | **resend** | Server-only transactional mail (`features/services/notify.ts`) |
| Fonts | `next/font/google` | Inter (sans) + Playfair Display (display) |
| Lint | **ESLint 9** (`eslint-config-next`, core-web-vitals + TS) | Also flags components created inside render (`react-hooks/static-components`) |
| Package manager | npm | Node 22.x |

Scripts:

```bash
npm run dev        # start dev server (Turbopack)
npm run build      # production build (next build --webpack)
npm run start      # serve production build
npm run lint       # ESLint over the project
```

---

## Project Structure

```
table_creation_mysql.sql    # 1st — THE MySQL schema: 16 tables, indexes, triggers (idempotent)
primary_seed_mysql.sql      # 2nd — communities + membership_plans + site_config + admin account (idempotent)
success_stories_seed.sql    # 3rd — success_stories rows (Postgres syntax, NOT yet converted)
seed_data.sql               # 4th — users/profiles/temples/services dump (Postgres syntax, NOT converted)
table_deletion_query.md     # legacy Postgres teardown (reference only)
tables_document.md          # legacy Postgres annotated column reference (reference only)
memebership_feature_list.md # the Free / Silver / Premium plan copy the plans table mirrors
README.md                   # top-level overview
production_setup.md         # local scratch pad of the production env values (KEEP OUT OF GIT)
next.config.ts              # images.remotePatterns + serverActions.allowedOrigins
code_documentation.md       # this file
src/
├── proxy.ts                  # Optimistic /admin cookie check (Next 16, replaced middleware.ts)
├── app/                      # Next.js App Router (routes = pages; thin compositions only)
│   ├── layout.tsx            # Root layout: fonts, metadata, AppProviders
│   ├── globals.css           # Tailwind v4 @theme tokens + global styles
│   ├── icon.png              # Favicon (generated from the logo)
│   ├── api/auth/             # login / logout / session route handlers (JSON, cookie-backed)
│   ├── (public)/             # Marketing / guest routes (layout: Header + Footer)
│   │   ├── page.tsx          # Home page
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
│   │   ├── search/           # the ONLY profile browser; member-only
│   │   ├── grooms/  brides/  # member-only SearchView presets + back link
│   │   └── profile/ (+ [id]/page.tsx, actions.ts = all member interest writes)
│   └── (admin)/              # Admin area — session + users.role gate
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
│   ├── profile/              # profile-card, profile-sections (SHARED), profile-view, photo-gallery
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
│   └── ui/                   # button, badge, avatar, modal, field (incl. PasswordInput), checkbox, …
├── features/                 # Domain logic + fallback seed (one folder per feature)
│   ├── auth/                 # auth-provider.tsx — members area only; cookie-backed (see Auth)
│   ├── profiles/             # queries.ts (filter/sort/match scoring), loaders.ts ("use server" DB bridge), data.ts (seed)
│   ├── search/               # types.ts (SearchFilters, SortKey), helpers.ts (queryString/parseQuery)
│   ├── communities/  stories/  membership/   # data.ts (fallback seed); membership/ also period.ts
│   ├── interests/            # data.ts — the DB loader for /interests (server-only)
│   ├── services/             # types.ts, data.ts (ServiceInput), notify.ts (Resend email)
│   ├── temples/              # types.ts — Temple, TempleInput, TempleFestival, TempleDayTiming
│   └── jathagam/             # service.ts (external API client + mapping), data.ts (nakshatras, RASI_*)
├── types/                    # index.ts — all domain types (Profile, Interest, AppUser, …)
├── hooks/
└── lib/
    ├── db.ts                 # mysql2 pool + q / q1 / run / tx — THE data access layer
    ├── auth/session.ts       # scrypt hash/verify, createSession/destroySession, getSessionUser
    ├── uploads.ts            # filesystem uploads under public/uploads (saveUpload/deleteUpload/…)
    ├── data/
    │   ├── mappers.ts        # DB row → domain model (toProfile, toStory, toPlan, …) + parseJson/jsonList
    │   ├── queries.ts        # public loaders (server-only — imports db.ts)
    │   ├── admin-queries.ts  # admin loaders (server-only) — no seed fallback at all
    │   ├── public-actions.ts # "use server" bridge so client components can fetch public data
    │   ├── member-dal.ts     # MEMBER GATE: getCurrentMember/requireMember/assertMember
    │   └── admin-dal.ts      # ADMIN GATE: ADMIN_CLAIM, getCurrentAdmin, requireAdmin, assertAdmin
    ├── payments/             # quotas.ts (per-plan limits) + quota-defaults.ts (client-safe numbers)
    ├── constants.ts          # BRAND, ADMIN_NAV, CONTAINER, form option lists, photo/bucket limits
    ├── registration.ts       # shared wizard constants + per-step validation (ABOUT_MIN / ABOUT_MAX)
    ├── utils.ts              # cn, formatDate (hydration-safe), formatRelativeTime, ageFromDateOfBirth, uid, …
    └── state/                # toast-provider.tsx
```

> `MEMBER_NAV` in `src/lib/constants.ts` is **dead** — the member sidebar is defined locally in `components/layout/dashboard-nav.tsx`. Do not add a second nav list.

Design decisions:

- **`app/` is thin** — `page.tsx` files compose components and own metadata only; business logic lives in `features/` + `components/`.
- **`features/<name>/queries.ts`** = read functions, **`actions.ts`** = mutations, **`data.ts`** = fallback seed / the form submit shape, **`types.ts`** = feature-local types.
- Moving a page to `components/` (or a query to `features/`) is always safe: everything imports via the `@/…` alias.
- No dead-code hoarding: the demo loading hook (`hooks/use-fake-loading`) was removed — do not re-introduce fake loading.

---

## Data Source (MySQL only)

`src/lib/db.ts` is the single entry point. There is **no mode flag and no mock mode**.

| Export | Purpose |
| --- | --- |
| `pool` | one `mysql.createPool` for the process; `dateStrings: true` so DATE/DATETIME come back as `"yyyy-mm-dd"` strings (the shape the mappers expect) |
| `q<T>(sql, params)` | `pool.execute`, returns all rows |
| `q1<T>(sql, params)` | first row or `null` |
| `run(sql, params)` | for inserts/updates/deletes; returns the result packet |
| `tx(fn)` | checks out a connection, `beginTransaction`, runs `fn(client)` with `q`/`q1`/`run` bound to that connection, commits, rolls back on throw, releases |

Connection settings come from the environment, defaulting to XAMPP:

| Variable | Dev default | Prod | Notes |
| --- | --- | --- | --- |
| `DB_HOST` | `localhost` | required | Hostinger host (often `localhost` on the same account) |
| `DB_PORT` | `3306` | required | |
| `DB_USER` | `root` | required | Hostinger prefixes the user (`u521035242_viswa`) |
| `DB_PASSWORD` | `""` | required | quote it if it contains `#` or `>` |
| `DB_NAME` | `subhavivaham` | required | Hostinger prefixes it (`u521035242_subhavivaham`) |
| `JATHAGAM_API_URL` | set | required for `/jathagam` | astrology engine client (server only) |
| `JATHAGAM_API_KEY` | — | optional | sent as `Authorization: Bearer` |
| `RESEND_API_KEY` | optional | required to send mail | Resend (server-only) |
| `EMAIL_FROM` | optional | recommended | defaults to `Subha Vivaham <onboarding@resend.dev>`; a verified domain is needed to mail arbitrary members |
| `VENDOR_NOTIFY_EMAIL` | optional | optional | inbox for registration notices (defaults to `subhavivaham2017@gmail.com`) |

> **Never prefix `JATHAGAM_*` with `NEXT_PUBLIC_`** — that would ship the endpoint and key to the browser. `/jathagam` passes the calculator a plain `enabled` boolean instead.

> **`privacy_setup.md` / `production_setup.md` hold real credentials and must stay out of git.** `.env*` is gitignored; these scratch files are not — add them to `.gitignore` or delete them before committing.

### Loader modules — the client-boundary rule

**mysql2 must never enter the browser bundle.** `db.ts` imports `mysql2/promise`, which pulls Node's `net`/`tls`. Any module that imports `db.ts` is therefore **server-only**, and must not be imported (even dynamically) from a `"use client"` file.

| Module | Client type | Tables | Importable from |
| --- | --- | --- | --- |
| `lib/db.ts` | mysql2 pool | — | server only |
| `lib/data/queries.ts` | **server-only** (imports `db.ts`) | public tables | server components / server actions |
| `lib/data/admin-queries.ts` | server-only | all admin tables | server components / route handlers |
| `lib/data/member-dal.ts` | server-only | `users`, `profiles` | server components / server actions |
| `lib/data/admin-dal.ts` | server-only | `users` | server components / server actions |
| `features/profiles/loaders.ts` | **`"use server"`** | via `queries.ts` | client components (as server actions) |
| `lib/data/public-actions.ts` | **`"use server"`** | via `queries.ts` | client components (as server actions) |
| `features/interests/data.ts` | server-only | `interests`, `profiles`, `profile_photos` | server components only |
| `lib/payments/quotas.ts` | takes the pool (no import of client state) | `subscriptions`, `membership_plans`, `users`, `interests` | server actions / server components |
| `lib/payments/quota-defaults.ts` | **client-safe** (no `db.ts`) | — | anywhere |
| `features/services/notify.ts` | wraps Resend | — | server actions only |

**How client components read data:** they do **not** import `queries.ts`. `search-view.tsx`, the dashboard, matches and preferences call the `"use server"` functions in `features/profiles/loaders.ts` and `lib/data/public-actions.ts` over the wire, so `db.ts`/mysql2 stay on the server. Directly importing `queries.ts` from a client file breaks the build with a mysql2 `net`/`tls` resolution error.

> **`parseJson` / `jsonList`.** mysql2 returns `json` columns as raw strings. `toProfile`, `toPlan` and the interest loader all funnel array columns (`hobbies`, `pref_*`, `interested_profile`, plan `features`) through `parseJson`/`jsonList` in `mappers.ts`. If a read crashes on `.map is not a function`, that column skipped the parser.

`member-dal.ts` is the members-area gate. `getCurrentMember()` is `cache()`d and returns `MemberIdentity | null`:

| Field | Source |
| --- | --- |
| `authUserId` / `userId` | the `users` row behind the `sessions` row (see [Auth](#auth--sessions)) |
| `email`, `name` | `users.email` / `users.name` |
| `profileId` | `profiles.profile_id` — the **public** text key, used in URLs |
| `profileUuid` | `profiles.id` — the **uuid**, used by `interests.from_profile_id` / `to_profile_id` |
| `gender` | `profiles.gender`, narrowed to `"male" \| "female" \| null` |

> **`profileId` vs `profileUuid` is the easiest thing to get wrong in the members area.** Routes and `/profile/[id]` links are keyed on **`profileId`**; the `interests` table is keyed on **`profileUuid`**. Any write to `interests` must resolve one to the other with an explicit lookup.

> **`fetchProfiles()` filters in SQL** — `where verified = 1 and status = 'active'`. `fetchOwnProfile(profileId)` deliberately does **not**: a fresh registration is inactive until an admin verifies it, and the owner must still see their own row on their dashboard. `fetchAdminServices()` reads `service_providers` with **no filter** (admins must see unapproved rows); `fetchServices()` filters in the query.

---

## Auth & sessions

There is **no Supabase Auth**. Authentication is three pieces:

| Piece | Where | What it does |
| --- | --- | --- |
| Password hashing | `hashPassword` / `verifyPassword` in `src/lib/auth/session.ts` | `scrypt:<saltB64>:<hashB64>`, verified with `timingSafeEqual` |
| Session store | `sessions` table | `token_hash` (sha256 of a 32-byte random token), `user_id`, `expires_at` (+30 days) |
| Transport | `sv_session` cookie | `httpOnly`, `sameSite: "lax"`, `secure` in production; the raw token is never stored, only its sha256 |

`createSession(userId)` mints the token, inserts its hash, and sets the cookie. `destroySession()` deletes the row and clears the cookie. `getSessionUser()` reads the cookie, hashes it, and joins `sessions → users` (rejecting expired rows) to return `{ userId, email, name, role, status, phone, isMembershipUser, membershipPlan }` or `null`.

### The members area auth is client-cookie-backed

- `features/auth/auth-provider.tsx` fetches **`/api/auth/session`** on mount to learn who is signed in, and offers `login` (POST `/api/auth/login`) / `logout` (POST `/api/auth/logout`). There is deliberately **no copy of the member in `localStorage`** — a stored copy is not a session.
- `src/app/api/auth/{login,logout,session}/route.ts` are the JSON endpoints: login verifies the password against `users.password_hash`, checks `status`, calls `createSession`, and returns the `AppUser`; session rebuilds the `AppUser` from `getSessionUser()`; logout calls `destroySession()`.
- `AppUser` = `{ id, email, mobile, name, profileId, gender, plan }`. `gender` may be `null`, so any UI branching on it needs a fallback.
- The registration flow writes every row and calls `createSession` itself before `registerWithProfile` runs, so the new session is live immediately.

### The admin area

Route structure:

| File | Role |
| --- | --- |
| `src/app/(admin)/layout.tsx` | **Deliberately empty pass-through.** The guard lives in `(protected)` so `/admin/login` stays reachable. |
| `src/app/(admin)/admin/(protected)/layout.tsx` | `await requireAdmin()`, then renders `<AdminShell …>`. Redirects to `/admin/login` when there is no admin. |
| `src/app/(admin)/admin/login/page.tsx` | `force-dynamic`; redirects to `/admin` if already an admin. |
| `src/app/(admin)/admin/auth-actions.ts` | `"use server"`. `adminSignIn` lower-cases the email, verifies the password, rejects non-`admin` roles and disabled accounts, `createSession`, `redirect("/admin")`. `adminSignOut` destroys the session. |

`src/lib/data/admin-dal.ts`:

| Export | Behaviour |
| --- | --- |
| `ADMIN_CLAIM = "admin"` | the required `users.role` value |
| `getCurrentAdmin()` | `cache()`d; `getSessionUser()`, then requires `role === "admin"`; looks the display name up on `users` (falling back to the email) |
| `requireAdmin()` | `cache()`d; `redirect("/admin/login")` when there is no admin |
| `assertAdmin()` | throwing variant for server actions — `throw new Error("Not authorised.")` |

Three layers:

1. **`src/proxy.ts`** — an optimistic `/admin*` check: if the `sv_session` cookie is absent, redirect to `/admin/login`. The file states plainly this is only a fast path (a cookie is forgeable).
2. **`requireAdmin()`** in the `(protected)` layout **and again in every protected page**.
3. **`assertAdmin()` as the first statement of every server action** — because MySQL has no RLS, this is the whole boundary.

> **There is no `isAdmin` on the member context.** Authorization is the server-side `users.role` check; the member `AuthProvider` exposes only `user`, `login`, `registerWithProfile`, `logout`, `isLoggedIn`, `isLoading`.

> **Two auth systems coexist but no longer overlap:** the admin area is the `users.role = 'admin'` check; the members area is the cookie session. An admin who is also a member signs into the members area as an ordinary member.

---

## Admin Console

### `AdminShell` — enterprise layout (`src/components/layout/admin-shell.tsx`)
- **Desktop**: fixed left sidebar `w-64` (logo header, icon+label nav from `ADMIN_NAV`, footer with avatar-initial + name + "View site" + "Sign out"), content offset with `lg:pl-64`.
- **Topbar**: sticky, full-width, breadcrumb showing the current page title + actions. On mobile, sign-out collapses to an icon and a hamburger opens the drawer.
- **Mobile**: slide-in drawer (`w-72`, `max-w-[85vw]`, backdrop), reusing the same nav block.
- Active nav item = exact match for `/admin`, otherwise `pathname.startsWith(href)`.

### Admin pages

`src/app/(admin)/admin/(protected)/` — 8 server components: `requireAdmin()` → the matching `fetchAdmin*` loader → the manager component. **All 8 are DB-backed with no seed fallback.**

| Route | Loader | Manager |
| --- | --- | --- |
| `/admin` | `fetchDashboardData()` | dashboard (StatCards + recent tables) |
| `/admin/users` | `fetchAdminUsers()` | `UsersManager` |
| `/admin/profiles` | `fetchAdminProfiles()` | `ProfilesManager` |
| `/admin/communities` | `fetchAdminCommunities()` | `CommunitiesManager` |
| `/admin/memberships` | `fetchAdminPlans()` + `fetchAdminSubscriptions()` + `fetchAdminPayments()` | `MembershipsManager` |
| `/admin/services` | `fetchAdminServices()` | `ServicesManager` |
| `/admin/temples` | `fetchAdminTemples()` | `TemplesManager` |
| `/admin/config` | `fetchSiteConfig()` | `ConfigForm` |

### Admin server actions (`src/app/(admin)/admin/actions.ts`)

`"use server"`. Exports `type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }`. **Every exported action calls `await assertAdmin()` as its first statement.** The uniform pattern: write to MySQL, `revalidatePath(...)`, then **re-read the whole list and return it**.

| Group | Actions |
| --- | --- |
| Users | `deleteUserAction`, `updateUserStatusAction`, `updateAllUserStatusAction`, `updateUserRoleAction` |
| Profiles | `createProfileAction` (inserts `users` **first** for the FK, then `profiles`), `updateProfileAction` (also writes `users.name/email/phone_number`), `setProfileStatusAction`, `setProfileVerifiedAction`, `deleteProfileAction` |
| Profile photos | `addProfilePhotoAction`, `addProfilePhotoUploadAction`, `removeProfilePhotoAction`, `setPrimaryProfilePhotoAction`, `moveProfilePhotoAction` |
| Communities | `createCommunityAction`, `updateCommunityAction`, `setCommunityActiveAction`, `deleteCommunityAction` |
| Memberships | `upsertPlanAction`, `deletePlanAction`, `createSubscriptionAction`, `setSubscriptionStatusAction`, `changeSubscriptionPlanAction`, `renewSubscriptionAction`, `setUserMembershipAction` |
| Payments | `approvePaymentAction` (the grant path — creates the subscription), `rejectPaymentAction`, `uploadPaymentScreenshotAction` |
| Services | `createServiceAction`, `updateServiceAction`, `setServiceActiveAction`, `approveServiceAction`, `rejectServiceAction`, `deleteServiceAction` |
| Temples | `createTempleAction`, `updateTempleAction`, `setTempleActiveAction`, `approveTempleAction`, `rejectTempleAction`, `deleteTempleAction`, `saveTempleFestivalsAction`, `saveTempleServicesAction`, `addTempleImagesAction`, `deleteTempleImageAction`, `reorderTempleImagesAction` |
| Config | `updateSiteConfigAction` |

> **`createProfileAction` requires a real email and mobile and a login password.** The admin add form collects them; the action validates (`EMAIL_RE` / `MOBILE_RE` from `src/lib/registration.ts`), rejects duplicates, and inserts `password_hash`. The create form **prefills the password with `subhavivaham`** (still editable) so an admin can hand the account over immediately.

> **`updateProfileAction` writes the `users` row too.** Email/mobile/name live on `users`, so an edit that changes them updates both tables; a **blank password means "keep the current one"**.

> **JSON columns are written with `JSON.stringify`.** `profileColumns()` stringifies `hobbies`, `pref_*` arrays, etc. `hobbies` is authored as free text and split on commas/newlines at write time.

### Shared admin table kit (`src/components/admin/table.tsx`)
- `Card`, `Table(head, children)`, `Row`, `Cell`, `Pill(tone)` — server-safe, no `"use client"`.
- Companions: `row-actions.tsx` (`RowActions`, `IconAction`) and `confirm-dialog.tsx` (`ConfirmDialog`).
- `shared.tsx` (client): `PageHeader`, generic `FilterTabs<T>`, `SearchInput`, `Toolbar`, `ToolbarSelect`, `AddButton`, `useConfirm()`. **`FilterTabs` is also used by the public services page.**

### Vendor Services (`/admin/services`)

- `src/features/services/types.ts` — `ServiceType = "mandapam" | "broker" | "catering" | "event" | "photography" | "decoration"`. The `broker` key's display label is `"Franchise Partner"`, read from `SERVICE_TYPE_LABELS` everywhere the label renders.
- **Two gates**, both must be true for a listing to appear publicly:
  | Gate | Meaning | Set by |
  | --- | --- | --- |
  | `is_approved` | A human reviewed it. | admin create (`1`); vendor register (`0`); approve/reject |
  | `active` | On/off switch for an approved listing. | admin create (`1`); vendor register (`0`); `setServiceActiveAction` |
  - `approveServiceAction` sets **both** together, so approving a switched-off row cannot leave it approved-but-invisible.
- `src/components/admin/services-manager.tsx` — client CRUD: category filters, add/edit modal, per-row actions, delete confirm. Pending rows sort first and get an approve / not-approve action.

---

## Temples (`/temples`, `/temples/[temple_id]`, `/admin/temples`)

Four tables — `temples` plus `temple_services` / `temple_images` / `temple_festivals` — and three retirements inside `temples` itself.

### Review gates

`temples` carries `is_approved` and `active`, and the admin has the full set (`approveTempleAction`, `rejectTempleAction`, `setTempleActiveAction`). `TemplesManager` shows `Pending` / `Live` / `Off` pills. **The public read does not yet filter on the gates** — `fetchTemples()` does not push the equivalent of `.eq(...)` the way `fetchServices()` does. Making it real means adding the two filters to `fetchTemples()` (there is no RLS policy to change).

### What replaced what (vs. the old Postgres schema)

| Was | Is now | Why |
| --- | --- | --- |
| `temples.timings text` | seven `*_timings` columns, Sunday first | a single string cannot say *which day* a visitor is asking about |
| `temples.special_days text` | `temple_festivals` rows | a blob cannot be listed, sorted, or hidden once a date has passed |
| `temples.latitude` / `longitude` | `temples.maps_url text` | nothing read them; the admin has the Google **Share** link in hand |
| `temples.services jsonb` | `temple_services` rows | jsonb cannot edit one price, hide one service, or set an order |

### Types (`src/features/temples/types.ts`)

| Export | Notes |
| --- | --- |
| `Temple` | `timings: TempleDayTiming[]` — **already filtered**, so a blank day is absent |
| `TempleInput` | `timings: string[]` — seven free-text values in `TEMPLE_DAYS` order |
| `TempleDay` / `TEMPLE_DAYS` | the seven day keys, **Sunday first** |
| `TempleFestival` | `{ id, name, happensOn: string \| null, sortOrder }` |
| `isHttpUrl`, `isGoogleMapsUrl` | shared by the client form and the server action |

### Timings — the two states that are not the same

`null` means "not filled in" and **the day is hidden publicly**. The literal string `Closed` is what the admin types to say the temple is shut and **it does render**.

### Festivals

- `happens_on` is **nullable on purpose** — a null renders as the name alone.
- **The public page filters; the admin page does not** — the admin must see a past festival to update its date.
- `saveTempleFestivalsAction` is a **whole-list replace** (delete then insert).

### Validation — required major fields

Client `validate()` and server `templeRow()` carry the same rules: `name` (≤120), `address`, `city`, `district`, `nameTa`, `contact` (`/^[0-9+()\s.-]{7,20}$/`), `contactPerson`, `mapsUrl` (a Google Maps link), `history` (≥40 chars) all required; `whatsapp`, `email`, `website` optional. Errors render inline, and the form scrolls to and focuses the first invalid `[data-field]`.

### Create vs Edit

**Edit** saves each concern separately. **Create stages festivals and images locally**, then after `createTempleAction` returns it identifies the new id by set-difference, saves festivals, and uploads images. A partial failure is possible (a temple can exist with no festivals).

### Images and the five-image cap

Five **including the cover** — a row count, so it cannot live in the bucket. A `before insert` trigger on `temple_images` counts `temples.cover_image`; the action re-checks it. `MAX_TEMPLE_IMAGE_BYTES` (300 KB) must match the bucket's configured limit.

> **Neither public page renders `temple.coverImage`.** Upload/replace/remove work, but the cover is currently admin-only data.

---

## Footer (`src/components/layout/footer.tsx`)

- Dark brand panel on `bg-charcoal-950`, 12-column grid: brand block, **Explore** (mirrors `PUBLIC_NAV`), **Account** (Login, Profile Register, Vendor Register), **Registered Offices** + WhatsApp/Email from `BRAND`.
- Bottom bar: `© {year} {BRAND.name} ({BRAND.nameTamil}). All rights reserved.` — no GSTIN.

---

## Routing (App Router)

| Route | Group | Purpose |
| --- | --- | --- |
| `/` | `(public)` | Marketing home |
| `/login`, `/register` | `(public)` | Sign-in (email + password); 8-step registration wizard |
| `/jathagam` | `(public)` | Natchathram porutham calculator (live API) |
| `/services`, `/vendor-register` | `(public)` | Vendor directory; public submission (inserts unapproved) |
| `/communities` (+ `[id]`), `/success-stories` (+ `[id]`), `/membership` | `(public)` | DB-backed public pages |
| `/temples` (+ `[temple_id]`) | `(public)` | Temple directory + detail |
| `/search` | `(app)` | **Member-only** profile browser (the only one) |
| `/profile/[id]` | `(app)` | Full profile detail, DB-backed, `force-dynamic` |
| `/dashboard` (+ `/preferences`, `/profile`) | `(app)` | Member home |
| `/matches`, `/interests` | `(app)` | Recommendations; sent/received interests |
| `/grooms`, `/brides` | `(app)` | `SearchView` presets pinned to one gender |
| `/admin` (+ `/admin/*`) | `(admin)` | Admin console |

Layout groups:

- **Root** — fonts, metadata, `AppProviders`.
- **`(public)`** — `Header` + `main` + `Footer`. **There is no guest-facing profile browser.**
- **`(app)`** — `await getCurrentMember()`; `redirect("/login")` when there is no member, then `DashboardShell`.
- **`(admin)`** — pass-through; the guard is in `(protected)`.

---

## Home Page Sections (`src/app/(public)/page.tsx`)

| # | Component | Section | Notes |
| --- | --- | --- | --- |
| 1 | `Hero` | Hero | Bilingual headline, CTAs to `/#featured-profiles` + `/register` |
| 2 | (inline) | Featured Profiles | `SectionHeading` + `<ProfileGrid>` with `getFeaturedProfiles(8)` |
| 3 | `WhyChooseUs` | Why Subha Vivaham | Value-props grid |
| 4 | `HowItWorks` | How It Works | The 4-step trust process; references **R. Viswanathan @ 85086 30290** |
| 5 | `CommunitiesSection` | All Tamil Communities | community pills linking to `/communities` |
| 6 | `JathagamSection` | Jathagam Porutham | Dark band; 12 Rasi tiles as a client-side selector |
| 7 | (inline) `Faq` | Questions, answered | Accordion |
| 8 | `FinalCta` | CTA band | |

Note on contacts: `components/home/*` hardcode **R. Viswanathan — 85086 30290** — **separate** from `BRAND` (proprietor S. Ramalingam Pillai, `+91 88839 43711`) which drives footer/header.

---

## Motion & Animation

**Two systems.** CSS keyframes own anything declarative (`animate-fade-in`, `animate-slide-up`, `animate-scale-in`, etc. in the `@theme` block of `globals.css`). framer-motion owns only what CSS cannot: scroll-triggered reveals with stagger, and enter/exit presence.

framer-motion appears in exactly three files plus the primitives:

| File | Uses | Why it cannot be CSS |
| --- | --- | --- |
| `src/components/ui/reveal.tsx` | `motion.div` + variants | `whileInView` + `staggerChildren` |
| `src/components/ui/modal.tsx` | `AnimatePresence`, `motion.div`/`motion.button` | an exit animation needs the subtree mounted |
| `src/components/wedding-intro/*` | `AnimatePresence`, `motion.*` | 4-stage state machine with `onAnimationComplete` |

### `src/components/ui/reveal.tsx` — the only sanctioned entry point

| Export | Contract |
| --- | --- |
| `Reveal({ children, className?, delay?, y?, amount? })` | single-element fade + rise, `whileInView` |
| `RevealGroup({ children, className?, stagger?, mode?, amount? })` | container + stagger; `mode` is `"inView"` or `"mount"` |
| `RevealItem({ children, className? })` | one cell; must be a **direct** child of the group |

**One easing curve:** `[0.16, 1, 0.3, 1]` — the same as the `slide-up` keyframe, so JS and CSS motion match.

**Reduced motion is a real branch** — each component returns a plain `<div>` (not a no-op transition), because a `motion.div` with `initial` writes `opacity: 0` into the SSR HTML.

### `Modal` (`src/components/ui/modal.tsx`)

- `if (!isHydrated) return null` — the portal target must exist first.
- The portal renders whenever hydrated, **not** only when `open`, because `AnimatePresence` needs the subtree mounted to play the exit.
- **`dismissOnBackdrop`** (default `true`): long-form modals pass `false` so a stray outside tap cannot discard typed input. The close button and Escape still work.
- Portalled to `document.body` on purpose (a transformed/overflow-hidden ancestor becomes the containing block for `position: fixed`).

### Scroll locking — the one thing that can brick the page

`Modal` and the `wedding-intro` overlay set `document.body.style.overflow = "hidden"`. If the overlay's `onAnimationComplete` handoff never fires, the overlay unmounts visually but the lock survives and **the whole page cannot be scrolled**. When a page "cannot scroll", check for a stranded `overflow: hidden` on `body` first.

---

## State & Data Flow

All global state lives in React Context, composed in `src/components/providers/app-providers.tsx`:

```
ToastProvider → AuthProvider → pages
```

- **`ToastProvider`** — `useToast()` returns `toast(message, kind?)`. Top-right stack, auto-dismiss 3.5s, caps at 4.
- **`AuthProvider`** — members area only (see [Auth](#auth--sessions)). **The admin area does not use it.**

---

## Member Area (`(app)`)

### Session gate

`src/app/(app)/layout.tsx` calls `await getCurrentMember()` and `redirect("/login")` when there is no member. Anything reading private data still goes through the DAL.

### `DashboardShell` (`src/components/layout/dashboard-shell.tsx`)

- **Width is per route, not global.** `FULL_WIDTH_ROUTES` is a `Set` of exact paths plus a `/profile/` prefix rule. Dense grids and multi-column filter bars render full width; forms keep `max-w-7xl`.
- Desktop: 240 px sticky sidebar + content column.
- Mobile: logo + search icon + sign-out top row; `MobileTabBar` pinned at the bottom.

### Sidebar order (`src/components/layout/dashboard-nav.tsx`)

**Desktop:** `Dashboard`, `My Matches`, **browse**, `Interests`, `My Profile`. **Mobile** (`MobileTabBar`) is a hand-written six-item list with a different order. `browse(gender)` returns `{ label, href, short, icon }`:

| Signed-in `gender` | Label | Destination |
| --- | --- | --- |
| `"male"` | Brides | `/brides` |
| `"female"` | Grooms | `/grooms` |
| `null` | Brides / Grooms | `/search` |

### Interests (`interests` table)

The record of an interest is a **row in `interests`**, not a `localStorage` array.

**Read — `src/features/interests/data.ts` (server-only):** `fetchMemberInterests()` returns `{ received, sent }`, newest first. Two queries, one per side of the pair (`to_profile_id = me` / `from_profile_id = me`). Counterpart profiles and photos are resolved in two `.in(...)` batches. A row whose counterpart was deleted is dropped. A legacy array-only send has `createdAt === ""` — the UI guards before printing a date.

**Write — `src/app/(app)/profile/actions.ts`:** all four take identity from `assertMember()`, never an argument.

| Action | Effect |
| --- | --- |
| `sendInterest(toProfileId)` | resolves `profileId` → uuid, appends to `profiles.interested_profile`, **then** inserts the `interests` row (`pending`, `viewed: false`) |
| `withdrawInterest(toProfileId)` | removes from the array, sets the row `status = 'withdrawn'` |
| `respondToInterest(id, accepted \| declined)` | recipient answers; also sets `viewed: true` |
| `markReceivedViewed()` | one bulk write for the member's unread received rows |

Three decisions worth keeping: the array is written **before** the row (a failed insert leaves the send visible); withdraw is a **mark**, not a delete; `respondToInterest` filters on `to_profile_id = session` so a sender cannot answer their own interest.

### `/brides` and `/grooms`

Member-only server components rendering `<MemberPageHeader>` then `<SearchView gender=… />`. `MemberPageHeader` supplies a **"Back to dashboard"** link, because the sidebar is hidden on phones. **Any new `(app)` page reachable only from the sidebar needs it**, except pages also in the mobile tab bar.

---

## Features (logic layer)

### `features/profiles/`
- `queries.ts` — pure functions, no React:
  - `filterProfiles(source, filters, sort)` — the real filter/sort, taking an explicit array.
  - `computeMatchScore(profile, current)` — weighted match scoring producing a 74–99 match %.
  - `getRecommendedMatches`, `getNewMatches`, `getNearbyMatches`, `getRecentlyActive`, `getFeaturedProfiles`, `getDashboardStats`.
- `loaders.ts` — `"use server"` DB-backed variants (`loadSearchProfiles`, `loadRecommendedMatches`, `loadProfile`, `loadOwnProfile`) consumed by client pages.
- `data.ts` — fallback seed list.

### `features/search/`
- `types.ts` — `SearchFilters` + `SortKey`. `helpers.ts` — `queryString()` / `parseQuery()`.

### `features/jathagam/` — a remote API client

`service.ts` (a plain fetch wrapper, no imports) and `data.ts` (reference data only). `src/app/(public)/jathagam/actions.ts` is the only path to the engine.

**`service.ts` exports:** `CALCULATION_METHOD`/`CALCULATION_VERSION`, `JathagamApiError`, `isJathagamConfigured()`, `JathagamResult<T>`/`jathagamFailure()`, `Place`, `searchPlaces(query)`, `MapPersonInput`, `Koota`, `PersonChart`, `Dosha`, `MatchReport`, `marriageMatch(boy, girl)`. Env: **`JATHAGAM_API_URL`** (required) and **`JATHAGAM_API_KEY`** (optional bearer). Requests use `cache: "no-store"` and a 20 s timeout.

> The old `calculatePorutham()` / `verdictFor()` local engine **no longer exists**. `marriageMatchAction` forwards the browser payload with **no server-side re-validation and no rate limiting** — see Key Implementation Notes.

### Public Vendor Register (`/vendor-register`)

- `actions.ts` — `registerVendorAction`: validates, inserts with **`is_approved = 0, active = 0`**, then emails the office via `sendVendorRegistrationEmail` (best-effort — a mail failure never fails the submission).
- `components/services/vendor-register-form.tsx` — field names/order/required flags mirror the admin vendor form. On success it swaps to a "we have your details" panel.

### Approval flow

```
vendor submits  →  insert is_approved=0, active=0
                →  row stored but invisible to the public query
                →  admin sees gold banner + Pending pill on /admin/services
                →  Approve  → is_approved=1, active=1  →  visible publicly
                →  Not approve → both 0, row kept   |   Hide → active=0 only
```

---

## Communities & Success Stories pages

### `/communities`
`Promise.all([fetchCommunities(), fetchProfiles()])`; per-community count computed in the page by folding `profiles` into a `Map`. Cards use `h-full` + `flex flex-col` + `mt-auto` so footers align.

### `/success-stories`
`fetchStories()`; `const [featured, ...rest] = successStories` — the first story is promoted to the featured card. Story images are low-res (`w=200`) Unsplash URLs used at **avatar size only**.

### Writing community copy — edit the database, not the seed

> **This is the single most common way to waste an hour.** `fetchCommunities()` reads the `communities` table, and `src/features/communities/data.ts` is only a fallback. Editing `data.ts` changes nothing while the table has rows.

Descriptions live in `communities`, seeded by `primary_seed_mysql.sql` (`insert … on duplicate key update`). Writes are admin-only (`assertAdmin()`).

---

## Mobile Responsiveness (conventions)

- **Tables** render through `admin/table.tsx` (`overflow-x-auto`), or wrap a raw table in `overflow-x-auto`.
- **Logo** (`brand/logo.tsx`) is responsive.
- **Stats grids**: `grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4`.
- **Admin topbar**: title pill truncates, sign-out collapses to an icon; drawer capped at `w-72 max-w-[85vw]`.
- No `whitespace-nowrap` outside a scroll container.

---

## Performance Notes

- `useFakeLoading` was **removed** — pages render real data immediately.
- Production build response times are ~30–80 ms per route (first hit ~330 ms). Perceived slowness is a **dev-mode** artifact.
- The admin area is server-rendered/static; only the shells and interactive components are client.

---

## Brand Identity

Central brand facts in `src/lib/constants.ts` → `BRAND`:

- Name **Subha Vivaham**, tagline "Connecting hearts, bringing families together."
- Website `https://www.subhavivaham.com`, proprietor **S. Ramalingam Pillai**
- Phone / WhatsApp `+91 88839 43711` (whatsapp: `88839 43711`), landline `04630 - 261186`, email `subhavivaham2017@gmail.com`
- Offices: `1-56/1, Sub Register Off Street, Murappanadu, Tuticorin - 628 252` and `3/58, Natarajar Sannathi Street, Vallanadu, Tuticorin - 628 252`
- Franchise contact used in home sections / jathagam CTA: **R. Viswanathan — 85086 30290** (kept separate from `BRAND`).

### Design tokens (`src/app/globals.css`, Tailwind v4 `@theme`)

Wine palette (maroon): `wine-700 #7a1832` (primary), `wine-800`, `wine-950`, `wine-500`, `wine-300`. Gold `gold-500`, `gold-600`, `gold-300`. Backgrounds `ivory-50`, `ivory-100`. Text `charcoal-900`, `charcoal-500`. Plus `shadow-card`, `shadow-card-hover`, `shadow-soft`, and keyframes (`fade-in`, `scale-in`, `slide-up`, `slide-in-right`).

Fonts: Inter (body) and Playfair Display (headings) via `next/font/google`.

---

## Key Implementation Notes

- **`next.config.ts`** allows `remotePatterns` for `images.unsplash.com`, `randomuser.me`, `*.supabase.co` (legacy, now unused) and `upload.wikimedia.org`. **`experimental.serverActions.allowedOrigins` must equal the deployment host** — Vercel/Hostinger report their own host in `x-forwarded-host`, which does not match the browser's `Origin`, and Next aborts the action with a bare 500. Set it to your production host (e.g. `["www.subhavivaham.com"]`) before deploying, or every form (admin login included) fails.
- **Uploads are filesystem-based.** `src/lib/uploads.ts` writes member/vendor photos under `public/uploads`. On a redeploy those files are **not** part of the build and are lost unless the disk is persistent — confirm the hosting disk, or move uploads to object storage.
- **No comments policy** — mostly holds; `features/jathagam/service.ts`, `features/jathagam/data.ts` and `components/jathagam/jathagam-calculator.tsx` carry deliberate explanatory comments.
- **Registration** (`src/components/forms/register-form.tsx`) is an **8-step wizard** (Account → Basics → Background → Family → Lifestyle → Location & about → Partner Preferences → Photos). On submit it calls the **`registerMember` server action**, which writes `users` → `profiles` → `profile_photos` inside one `tx` and calls `createSession`, then emails the office **and** sends the registrant a confirmation. Per-step validation lives in **`src/lib/registration.ts`**.
  - **A rejected submit navigates to the step that owns the error** via `ERROR_FIELD_STEPS` + `earliestStepWithErrors()`.
  - **The password field uses `PasswordInput`** (`components/ui/field.tsx`) — the same eye/eye-off toggle as the admin form.
  - **The introduction has a real floor: `ABOUT_MIN = 300` characters** (`ABOUT_MAX = 1500`), counted on the trimmed value.
  - **Hobbies** are free text split on commas/newlines at write time; the wizard keeps the raw string in local state so the commas and spaces are not swallowed as you type.
- **Community options come from the database.** `register/page.tsx` is `force-dynamic` and passes `fetchCommunities()` into the form; an empty list renders an empty checkbox group — check `select count(*) from communities where active = 1` before assuming the form is broken.
- **Astrology API** — no local engine. `marriageMatchAction` forwards the payload with no re-validation and no rate limiting; place autocomplete is the only guard on cost. An astrologer should still sign off on the score wording.
- **Jathagam results are not persisted.** `CALCULATION_METHOD`/`CALCULATION_VERSION` exist so a result could be tied to a version, but no history table exists.
- **Membership checkout is live — and manual, with no gateway.** `submitPaymentRequest` (`src/app/(public)/membership/actions.ts`) uploads a screenshot and files a pending `membership_payments` row. **Approval is the grant path**: `approvePaymentAction` creates the subscription. Per-plan limits: `PHOTO_QUOTA` `{ free: 1, silver: 5, premium: 10 }`, `INTEREST_QUOTA` `{ free: 3, silver: 25, premium: null }`.
- **Async component gotcha**: making a component `async` requires every parent to be `async` too. `tsc` will not catch this — it fails at build.
- **SQL execution**: there is no local Postgres or Docker in this environment; MySQL changes are applied through phpMyAdmin or the `mysql` client. `table_creation_mysql.sql` is idempotent, so re-run it to roll a database forward.
- **`200`/success from a write does not mean a row changed** if the `WHERE` matched nothing. Confirm write paths with a follow-up `select` when debugging.
- **Route 404 in dev after editing a `page.tsx`?** A stale Turbopack route manifest — touch the file, or restart `npm run dev`.

---

## Deployment (Hostinger, MySQL)

1. **Create the MySQL database** in hPanel → Databases. Note the **prefixed** names Hostinger assigns: database `u521035242_subhavivaham`, user `u521035242_viswa`, host usually `localhost`, port `3306`.
2. **Import** `table_creation_mysql.sql`, then `primary_seed_mysql.sql`, then `success_stories_seed.sql` (phpMyAdmin → Import). Convert `seed_data.sql` first if you want the demo rows.
3. **Set the environment variables** (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `RESEND_API_KEY`, `EMAIL_FROM`, `VENDOR_NOTIFY_EMAIL`, `JATHAGAM_API_URL`). Quote a password containing `#` or `>`.
4. **Set `next.config.ts` `allowedOrigins`** to the production host and redeploy.
5. **Build**: `npm ci` then `npm run build`; serve with `npm start` (Node 20+).
6. **Admin login**: seeded at `/admin/login` with `subhavivaham2017@gmail.com` / `viswa@123` — change it after first sign-in.
7. **Email**: to mail arbitrary members (not just the account owner), verify a domain in Resend and set `EMAIL_FROM` to an address on it. `onboarding@resend.dev` only delivers to the Resend account owner.

---

## Conventions Checklist

- Start the dev server: `npm run dev` → http://localhost:3000
- After changes: `npx tsc --noEmit` then `npm run lint` (and `npm run build` before finishing). If a route moved or was added, `npx next typegen` first.
- Keep `app/` thin: new pages compose `components/*`, new data/logic goes into `features/<domain>/`.
- **`db.ts` is server-only.** Client components must read public data through the `"use server"` bridges (`features/profiles/loaders.ts`, `lib/data/public-actions.ts`), never by importing `queries.ts`.
- **Parse every JSON column** with `parseJson` / `jsonList` from `mappers.ts` — mysql2 hands `json` back as a string.
- **Adding a DB loader:** public table → read via `lib/data/queries.ts` (server-only); private table → `lib/data/admin-queries.ts`. MySQL has no RLS, so **always filter private reads by `user_id` in SQL**.
- Use `cn()` from `@/lib/utils` for conditional className merging.
- **Admin**: route under `(admin)/admin/(protected)/`, compose shared `Card/Table/Row/Cell/Pill`; every page starts with `requireAdmin()`, every action starts with `assertAdmin()`.
- **Publishing content publicly**: anything an outsider can submit needs an explicit review gate — the `is_approved` / `active` pattern. Never let a public write path set the flag the public read filter depends on.
- **Keep `production_setup.md` out of git** — it holds real credentials.
- Mobile: verify with the audit conventions above.
