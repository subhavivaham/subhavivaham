<div align="center">

# ✦ Subha Vivaham ✦

### சுப விவாஹம்

**Traditional Values. Meaningful Matches.**

A premium Tamil Nadu matrimony platform — where heritage-inspired elegance meets a calm, modern experience.

<br />

[![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![MySQL](https://img.shields.io/badge/MySQL_8-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com)

<br />

> *“Connecting hearts, bringing families together.”*

</div>

---

## The Platform

**Subha Vivaham** is built around a simple promise: help Tamil families find a life partner with **confidence, dignity and warmth**. It weaves an editorial marketing site, a private members' area, and a full administrative console into one cohesive, responsive web application.

Every screen is crafted to feel **established, trustworthy and quietly luxurious** — never loud, never clinical. The result is an experience that honours tradition while feeling unmistakably modern.

---

## What Makes It Premium

<table>
<tr>
<td width="50%" valign="top">

### A Heritage Palette

A deep **maroon** identity lifted by **gold** accents, set on soft **ivory** with charcoal text — traditional yet contemporary.

</td>
<td width="50%" valign="top">

### Editorial Typography

**Playfair Display** gives headings a magazine-like elegance, while **Inter** keeps body copy crisp and effortless to read.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### Purposeful Motion

Gentle reveal, fade and slide animations guide the eye and reward interaction — always restrained, never distracting.

</td>
<td width="50%" valign="top">

### Trust by Design

Private contact details, clear review states and calm empty states keep every step reassuring and respectful.

</td>
</tr>
</table>

<div align="center">

![Maroon](https://img.shields.io/badge/Maroon-7B2D3B?style=for-the-badge)
![Gold](https://img.shields.io/badge/Gold-C7A24A?style=for-the-badge)
![Ivory](https://img.shields.io/badge/Ivory-FBF8F3?style=for-the-badge&labelColor=E8E0D4&color=FBF8F3)
![Charcoal](https://img.shields.io/badge/Charcoal-2B2B2B?style=for-the-badge)

</div>

---

## The Journey

**For visitors**, the experience is open and inviting. The home page sets the tone with a full-bleed hero, a "why us" story, a how-it-works flow, featured success stories, membership pricing and a trust-and-FAQ section. Guests can wander the temple directory, explore marriage services, read published success stories, and even try the Jathagam (natchathram porutham) calculator before signing up.

**For members**, the experience turns personal. After a guided, multi-step registration, members enter a focused area with a persistent sidebar, a warm dashboard, daily matches, an interests inbox, a rich profile viewer and an inline profile editor. Everything points toward one outcome — the right introduction.

**For the families behind every profile**, the experience stays respectful and private: contact details are never public, and visibility is deliberate and controlled.

---

<div align="center">

## Explore the Platform

</div>

<table>
<tr>
<td width="33%" valign="top">

### 🌸 Public Site

- **Home** — hero, featured profiles, stories, pricing
- **Register** — guided profile wizard
- **Login** — clean, branded sign-in
- **Jathagam** — porutham calculator
- **Temples** — heritage directory
- **Services** — curated vendors
- **Communities** — member listings
- **Success Stories** — real journeys
- **Membership** — plan comparison

</td>
<td width="33%" valign="top">

### 💍 Members' Area

- **Dashboard** — stats & recommendations
- **Matches / Interests** — suggested partners, inbox
- **Search / Brides / Grooms** — refined browser
- **My Profile** — polished view & editor
- **Preferences** — partner criteria
- **Profile detail** — elegant full view

</td>
<td width="33%" valign="top">

### 🛡️ Admin Console

An enterprise-grade console for managing:

- Members & profiles
- Communities
- Membership plans & payments
- Vendor services
- Temples
- Site-wide configuration & announcements

</td>
</tr>
</table>

---

<div align="center">

## Membership

**Begin free. Upgrade with confidence.**

</div>

A simple, honest path: a free tier to start, and paid tiers that unlock more photos, more interests and direct contact access. What's included at each level is shown plainly — upgrading is a short, guided flow, never a checkout maze.

---

<div align="center">

## Run It Locally

</div>

The app is **MySQL-only** — there is no mock mode and no Supabase. It needs a MySQL 8 (or MariaDB) database before any page will render data.

```bash
# 1. create a MySQL database named `subhavivaham` (utf8mb4) — XAMPP works
# 2. import the schema, then the seeds (order matters):
#      table_creation_mysql.sql   -> 16 tables, indexes, triggers
#      primary_seed_mysql.sql     -> plans, config, admin account, communities
#      success_stories_seed.sql   -> success stories
#    (seed_data.sql is still Postgres syntax and must be converted first)
# 3. copy the DB_* values into .env.local — the defaults already point at XAMPP
npm install
npm run dev      # start the dev server  → http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run lint     # lint the project
```

<div align="center">

Then open **http://localhost:3000** — admin console at **/admin/login**

</div>

### Environment

| Variable | Purpose |
| --- | --- |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | MySQL connection (defaults: `localhost:3306`, `root`, empty, `subhavivaham`) |
| `JATHAGAM_API_URL` `JATHAGAM_API_KEY` | Astrology engine for `/jathagam` (server-only) |
| `RESEND_API_KEY` `EMAIL_FROM` `VENDOR_NOTIFY_EMAIL` | Transactional email via Resend |

> Auth is **scrypt + a `sessions` table + an `sv_session` httpOnly cookie** — not Supabase Auth. MySQL has no row level security, so authorization is explicit: member reads filter by `user_id` and admin actions call `assertAdmin()`.

---

<div align="center">

## Tech Stack

</div>

**Next.js 16** (App Router) · **React 19** · **TypeScript** · **Tailwind CSS 4** · **mysql2** (pooled, raw SQL — no ORM) · **Resend** · **framer-motion**.

---

<div align="center">

## Before You Deploy

</div>

- Set **`experimental.serverActions.allowedOrigins`** in `next.config.ts` to your production host (e.g. `["www.subhavivaham.com"]`) — otherwise every form, admin login included, returns a bare 500.
- Provide the `DB_*` variables on the server and import the SQL files into the Hostinger database first.
- **Uploads are filesystem-based** (`public/uploads`) and are lost on redeploy unless the disk is persistent.
- **Keep `production_setup.md` out of git** — it holds real credentials.

---

<div align="center">

## Brand & Contact

**Subha Vivaham · சுப விவாஹம்**

*Traditional Values. Meaningful Matches.*

[![Website](https://img.shields.io/badge/Website-subhavivaham.com-7B2D3B?style=for-the-badge&logo=googlechrome&logoColor=white)](https://www.subhavivaham.com)
[![Phone](https://img.shields.io/badge/Call-+91_88839_43711-C7A24A?style=for-the-badge&logo=whatsapp&logoColor=white)](tel:+918883943711)
[![Email](https://img.shields.io/badge/Email-subhavivaham2017@gmail.com-2B2B2B?style=for-the-badge&logo=gmail&logoColor=white)](mailto:subhavivaham2017@gmail.com)

**Offices:** Murappanadu & Vallanadu, Tuticorin, Tamil Nadu

<br />

<sub>For developers: <code>code_documentation.md</code> is the detailed technical reference for the architecture, data layer and every page.</sub>

</div>
