-- ============================================================================
-- Subha Vivaham - database tables
--
-- Every table and column below maps to a real type in the codebase. The seed
-- row counts in the comments are what src/features/*/data.ts holds today.
--
-- READ THIS FIRST - tables_document.md is not the file you run.
--
-- This is the annotated reference: it explains what each column is for and why.
-- The executable schema lives in three other files, and pasting THIS one creates
-- an incomplete, insecure database:
--
--   1. table_deletion_query.md   drops every table/policy/function (optional)
--   2. table_creation.md         the real schema - run this
--   3. table_policies.sql        RLS + policies - run this
--   4. seed_data.sql             the rows - run this
--
-- The gap matters: table_creation.md creates tables but never runs
-- `enable row level security` (all RLS lives in table_policies.sql), so stopping
-- after it leaves every table readable and writable by anyone holding the anon
-- key, which ships in the client bundle. Run all four.
--
-- Where the two disagree, table_creation.md is authoritative - it is what runs.
-- This file is kept in step by hand.
-- ============================================================================


-- 1. users ------------------------------------------------------------------
-- The admin Users screen reads this: src/features/users/data.ts, 7 seed rows.
-- 1 admin + 6 members, statuses active / suspended / blocked.
--
-- id is a generated uuid that nothing uses. user_id is the natural key every
-- other table and every url references, so it is what you match on.
create table if not exists public.users (
    id                 uuid primary key default gen_random_uuid(),
    user_id            text unique not null,        -- seed id, e.g. user-praveen
    auth_user_id       uuid unique references auth.users(id) on delete cascade,
    name               text not null,
    email              text not null,               -- used as the login id
    role               text not null default 'member',  -- member | admin
    status             text not null default 'active',  -- active | suspended | blocked
    phone_number       text,
    is_membership_user boolean not null default false,
    membership_plan    text,
    joined_at          timestamptz,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
    -- membership is not a copy of the active subscription here on purpose: it is
    -- a separate flag the register form writes, and the two already disagree in
    -- the seed data (user-kavya is free in users but premium in sub-4).
);


-- 2. communities ------------------------------------------------------------
-- src/features/communities/data.ts, 16 seed rows.
-- id is the slug used by the /communities/[id] URLs, so it is the primary key.
create table if not exists public.communities (
    id                 text primary key,           -- iyer, kongu-vellalar
    name               text not null,              -- profiles.community holds this value
    tamil_name         text not null,
    description        text,
    tamil_description  text,
    visible_members    integer not null default 0, -- denormalised display count
    active             boolean not null default true,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);


-- 3. profiles ---------------------------------------------------------------
-- src/features/profiles/data.ts, 14 seed rows.
-- religion, community, mother_tongue, state and city are plain text because that
-- is what the app stores. Seed values do not match the dropdown lists in
-- src/lib/constants.ts (income "₹25 - ₹35 Lakh" is not in INCOME_RANGES, city
-- "Udaipur" is not in INDIAN_CITIES), so they must not be constrained.
-- join communities on profiles.community = communities.name.
--
-- family, lifestyle and partner preference were once a 1:1 side table
-- (profile_details). Nothing read them apart - every page selected both tables
-- and stitched the rows back together, and the register form wrote two rows for
-- one profile - so they are columns here. Every one of them has a default, so a
-- profile that never filled those sections still reads back.
create table if not exists public.profiles (
    id                 uuid primary key default gen_random_uuid(),
    profile_id         text unique not null,      -- seed id, e.g. p-ananya
    user_id            text references public.users(user_id),
    full_name          text not null,
    gender             text not null,             -- female | male
    date_of_birth      date,
    age                smallint,                  -- stored in the app, recompute on read
    height             smallint,                  -- centimetres
    marital_status     text not null,             -- single | divorced | widowed | annulled
    religion           text,
    community          text,
    mother_tongue      text,
    state              text,
    district           text,
    caste              text,                       -- free text, not constrained
    city               text,                       -- free text, not constrained to a list
    education          text,
    college            text,
    profession         text,
    company            text,
    income             text,
    country            text not null default 'India',
    about              text,

    -- family
    father_occupation  text,
    mother_occupation  text,
    brother_count      smallint not null default 0,
    sister_count       smallint not null default 0,
    family_type        text not null default 'nuclear',  -- nuclear | joint | extended
    family_location    text,
    family_values      text,
    gotra              text,
    horoscope_required boolean not null default false,

    -- lifestyle
    diet               text not null default 'vegetarian',
    smoking            text not null default 'never',
    drinking           text not null default 'never',
    hobbies            text[] not null default '{}',
    fitness            text,
    sports             text,
    music              text,
    food               text,
    appearances        text,

    -- partner preference. min_age / min_height are what this profile is looking
    -- for, not its own age and height above.
    min_age            smallint not null default 21,
    max_age            smallint not null default 35,
    min_height         smallint not null default 150,   -- centimetres
    max_height         smallint not null default 190,
    pref_religion      text,        -- a single value, not a list
    pref_communities   text[] not null default '{}',   -- 'Any' means no filter
    pref_mother_tongues text[] not null default '{}',
    pref_education     text[] not null default '{}',
    pref_professions   text[] not null default '{}',
    pref_locations     text[] not null default '{}',   -- empty list means match all
    pref_income        text,
    pref_diet          text,
    pref_smoking       text,
    pref_drinking      text,
    pref_marital_statuses text[] not null default '{single}',

    verified           boolean not null default false,
    status             text not null default 'inactive',  -- active | inactive | rejected
    online             boolean not null default false,    -- written once, never updated
    last_active        timestamptz,
    profile_created_on date,
    horoscope_link     text,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
    -- Deliberately not columns, because the app computes them:
    --   first_name       = full_name split on whitespace
    --   height_text      = height converted to feet/inches
    --   match_percentage = weighted score from src/features/profiles/queries.ts
    --   is_online        = last_active within the last 5 minutes
);


-- 4. profile_photos ---------------------------------------------------------
-- Profile.photos is an array in the app (3 per profile, order matters, index 0
-- is the main photo) so it becomes rows here. url points at the image file.
create table if not exists public.profile_photos (
    id          uuid primary key default gen_random_uuid(),
    profile_id  uuid not null references public.profiles(id) on delete cascade,
    url         text not null,
    is_primary  boolean not null default false,
    caption     text,
    sort_order  smallint not null default 0,
    created_at  timestamptz not null default now()
);


-- 5. interests --------------------------------------------------------------
-- src/features/interests/data.ts, 6 seed rows. The app embeds a whole copy of
-- the profile in each interest; here it is just the id, so the interest page
-- joins the profile instead of reading a snapshot that goes stale.
-- direction is derived: from_profile_id = me means sent, otherwise received.
create table if not exists public.interests (
    id              uuid primary key default gen_random_uuid(),
    interest_id     text unique not null,          -- seed id, e.g. i1
    from_profile_id uuid not null references public.profiles(id) on delete cascade,
    to_profile_id   uuid not null references public.profiles(id) on delete cascade,
    status          text not null default 'pending',
                                                   -- pending | accepted | declined | withdrawn
    message         text,
    viewed          boolean not null default false,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);


-- 6. membership_plans -------------------------------------------------------
-- src/features/membership/data.ts, 3 seed rows. price is in whole rupees
-- exactly as the app stores it (0, 899, ...) - no paise conversion here.
-- label_price ("₹899") is a display string and is not stored.
create table if not exists public.membership_plans (
    id          text primary key,                  -- free | silver | premium
    label       text not null,                     -- Free | Silver | Premium
    price       integer not null default 0,
    period      text not null,                     -- forever | 30 Days | 90 Days
    popular     boolean not null default false,
    is_active   boolean not null default true,
    sort_order  smallint not null default 0,
    features    jsonb not null default '[]',       -- [{"label":"...","included":true}]
    compare_features jsonb not null default '[]',  -- [{"label":"...","value":true|false|"text"}]
    photo_limit    integer not null default 1,     -- dashboard photo upload cap
    interest_limit integer                        -- monthly interest cap; null = unlimited
);


-- 7. subscriptions ----------------------------------------------------------
-- src/features/membership/store.ts, 5 seed rows. member_name and amount are
-- copies of the user name and the plan price; they are kept because the app
-- shows them without a join, and they are snapshotted so a later price change
-- does not rewrite history.
create table if not exists public.subscriptions (
    id              uuid primary key default gen_random_uuid(),
    subscription_id text unique not null,          -- seed id, e.g. sub-1
    user_id         text not null references public.users(user_id),
    plan            text not null references public.membership_plans(id),
    member_name     text not null,
    amount          integer not null default 0,
    renews_on       date,                          -- the app stores a plain date
    status          text not null default 'active', -- active | cancelled | expired
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);


-- 8. membership_payments ----------------------------------------------------
-- The self-service paid checkout. A member picks a paid plan, pays the price by
-- UPI, uploads a screenshot as proof, and this table holds that request as
-- 'pending'. An admin reconciles it later: approving writes the subscription
-- (section 7) and activates the plan, rejecting records the note. No seed rows -
-- the table is written only by a real payer.
--
-- payment_id is the natural key the app references, mirroring subscription_id.
--
-- plan is NOT a foreign key to membership_plans: a payment is history and has to
-- survive the plan being repriced, renamed or deleted, so plan_name snapshots
-- the human label too. amount matches membership_plans.price's numeric(10,2)
-- (test prices like 0.50 need paise) and is copied at purchase time.
--
-- screenshot_path is the storage object key in the private payment-screenshots
-- bucket; the app never stores a public url, it mints a short-lived signed url
-- to read it. status is one of pending | approved | rejected, and reviewed_at is
-- set on the decision, so a 'pending' row with no reviewed_at is exactly one
-- still waiting in the queue.
create table if not exists public.membership_payments (
    id              uuid primary key default gen_random_uuid(),
    payment_id      text unique not null,          -- seed id, e.g. pay-1a2b3c4d5e6f
    user_id         text not null references public.users(user_id),
    plan            text not null,                 -- membership_plans.id, no FK on purpose
    plan_name       text not null,                 -- snapshot of the plan label
    member_name     text not null,                 -- snapshot of the member name
    amount          numeric(10,2) not null default 0,
    screenshot_path text not null,                 -- object key in payment-screenshots
    status          text not null default 'pending', -- pending | approved | rejected
    note            text,                          -- the reject reason, shown to the member
    reviewed_at     timestamptz,                   -- set when an admin decides
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    constraint membership_payments_status_check
        check (status in ('pending', 'approved', 'rejected'))
);


-- 9. success_stories --------------------------------------------------------
-- src/features/stories/data.ts, 6 seed rows, all published. There is no admin
-- screen for these any more, so the table is read-only from the app.
-- The app's id is already the slug used by /success-stories/[id].
create table if not exists public.success_stories (
    id            uuid primary key default gen_random_uuid(),
    slug          text unique not null,            -- shreya-aditya
    couple        text not null,                   -- "Shreya & Aditya"
    short_names   text,
    location      text,
    image         text,
    match_percent smallint,
    tagline       text,
    quote         text,
    story         text[] not null default '{}',    -- 3 paragraphs each
    days_matched  text,                            -- "9 months", "6 weeks"
    status        text not null default 'published', -- published | draft
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);


-- 10. service_providers -----------------------------------------------------
-- src/features/services/data.ts, 11 seed rows. type is the only fixed list
-- here; city is free text (Tuticorin, Kovilpatti, Thoothukudi are not in
-- INDIAN_CITIES) and phone is a mixed-format string.
--
-- TWO GATES, and both must be true for a listing to render publicly:
--   is_approved   a human reviewed it.    default true.  admin create true,
--                                            vendor register false
--   active        on/off for an approved row. default true.
-- Splitting them means an approved vendor can be taken down for a season and
-- switched back on without going through review again.
create table if not exists public.service_providers (
    id          text primary key default gen_random_uuid()::text,
    service_id  text unique not null,              -- seed id, e.g. svc-m1
    type        text not null,
    -- mandapam | broker | catering | event | photography | decoration
    name        text not null,
    contact     text,
    city        text,
    -- street address. asked for and shown for mandapam listings; null elsewhere.
    -- added by an idempotent `add column if not exists` block in table_creation.md.
    address     text,
    phone       text,
    details     text,
    is_approved boolean not null default true,
    active      boolean not null default true,
    added_at    timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);


-- 11. temples ----------------------------------------------------------------
-- seed_data.sql, 26 rows. The public /temples directory and the admin Temple
-- screen both read this.
--
-- id exists only to give the table a standard uuid primary key; temple_id is the
-- natural key the app and every url use, so an insert supplying only temple_id
-- must not fail on the primary key - hence the default.
create table if not exists public.temples (
    id          text primary key default gen_random_uuid()::text,
    temple_id   text unique not null,              -- slug used in /temples/[temple_id]
    name        text not null,
    name_ta     text,                              -- shown beside the English name
    deity       text,
    cover_image text,                              -- storage url of the main image
    -- location. city is the town, district disambiguates it (four districts have
    -- a town called Madurai), address is the street a visitor would write.
    address     text,
    city        text,
    district    text,
    state       text,
    country     text not null default 'India',
    -- the Google Maps share link for Get Directions. a pasted url rather than a
    -- latitude/longitude pair: those two columns were dropped because nothing read
    -- them and an admin looking up a pin has the share link in hand already.
    -- text and not a strict url type, because Share hands out a short link
    -- (maps.app.goo.gl, youtu.be).
    maps_url    text,
    history     text,
    -- opening hours, one column per weekday. a single `timings` string cannot say
    -- what a visitor needs to know: which day they are asking about.
    --
    -- seven fixed columns rather than a temple_timings table because the set of
    -- days is fixed - there is no variable to normalize away, and a child table
    -- would add a second table and a second save cycle for seven possible rows.
    --
    -- each is free text, not a time range: a temple can open three times a day
    -- ("5:00 AM - 12:30 PM, 4:00 PM - 10:00 PM") and some keep an unscheduled
    -- window. null means the admin has not filled it in and the day is hidden on
    -- the public page; the admin writes "Closed" to say so deliberately, which is
    -- why an empty box and a closed day are different things.
    sunday_timings    text,
    monday_timings    text,
    tuesday_timings   text,
    wednesday_timings text,
    thursday_timings  text,
    friday_timings    text,
    saturday_timings  text,
    -- festivals live in the temple_festivals table below. special_days was a
    -- single free-text blob covering festivals, special pujas and seasonal notes,
    -- which cannot be listed, sorted or hidden once a date has passed.
    -- contact is the phone number and keeps its original name so the existing
    -- admin form and seed rows keep working.
    contact        text,
    whatsapp       text,
    email          text,
    contact_person text,
    website        text,
    is_approved boolean not null default true,
    active      boolean not null default true,
    added_at    timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);


-- 12. temple_services -------------------------------------------------------
-- One row per service. This was a temples.services jsonb array, and jsonb cannot
-- do any of the three things the admin dashboard needs: edit a price without
-- rewriting the array, hide a service without deleting the row, or set an order.
--
-- price is whole rupees, matching membership_plans.price. 0 renders as
-- "On request", so "ask the temple" stays distinguishable from a free service.
--
-- is_available and is_featured are deliberately separate: a service can be
-- featured and still be switched off.
create table if not exists public.temple_services (
    id           text primary key default gen_random_uuid()::text,
    temple_id    text not null references public.temples(temple_id) on delete cascade,
    name         text not null,
    details      text,
    price        integer not null default 0,
    image        text,
    terms        text,
    is_available boolean not null default true,
    is_featured  boolean not null default false,
    sort_order   smallint not null default 0,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);


-- 13. temple_images ---------------------------------------------------------
-- The gallery. cover_image on the temple row is the main image and this holds the
-- rest; a temple with no rows has no gallery, which the page renders as no
-- gallery rather than as a broken frame.
--
-- FIVE-IMAGE CAP ENCLUDING THE COVER. A row count, so the storage bucket cannot
-- express it: enforced by public.enforce_temple_image_cap() on a before-insert
-- trigger and re-checked in the upload action. Setting cover_image = null
-- releases the slot.
create table if not exists public.temple_images (
    id         text primary key default gen_random_uuid()::text,
    temple_id  text not null references public.temples(temple_id) on delete cascade,
    url        text not null,
    alt        text,
    sort_order smallint not null default 0,
    created_at timestamptz not null default now()
);


-- 14. temple_festivals ------------------------------------------------------
-- A temple has several festivals a year and the operator needs to add and drop
-- them one at a time, which two more columns on temples could never do.
--
-- happens_on is a plain date, not a year: temple festivals follow the lunar
-- calendar, so the Gregorian date moves every year and the admin re-enters it
-- each season. null means "date not announced yet" and renders as the festival
-- name alone rather than as a wrong or invented date.
--
-- past rows are NOT filtered in the RLS policy. The date filter lives in the
-- query, because the admin dashboard needs to see past rows to update the date
-- for next year.
create table if not exists public.temple_festivals (
    id         text primary key default gen_random_uuid()::text,
    temple_id  text not null references public.temples(temple_id) on delete cascade,
    name       text not null,
    happens_on date,
    sort_order smallint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- ============================================================================
-- Indexes
--
-- Optional but worth adding: these are the columns the app actually reads and
-- filters on. All use if not exists, so re-running is safe.
-- ============================================================================

create index if not exists users_status_idx on public.users (status);

create unique index if not exists communities_name_idx on public.communities (name);

-- the public browse page: active profiles, newest first
create index if not exists profiles_active_idx on public.profiles (profile_created_on desc)
    where status = 'active';
create index if not exists profiles_gender_idx on public.profiles (gender)
    where status = 'active';
create index if not exists profiles_community_idx on public.profiles (community)
    where status = 'active';
create index if not exists profiles_city_idx on public.profiles (city, gender)
    where status = 'active';
create index if not exists profiles_state_idx on public.profiles (state)
    where status = 'active';
create index if not exists profiles_last_active_idx on public.profiles (last_active desc)
    where status = 'active';
create index if not exists profiles_age_idx on public.profiles (age)
    where status = 'active';
create index if not exists profiles_height_idx on public.profiles (height)
    where status = 'active';
create index if not exists profiles_religion_idx on public.profiles (religion)
    where status = 'active';
create index if not exists profiles_mother_tongue_idx on public.profiles (mother_tongue)
    where status = 'active';
create index if not exists profiles_education_idx on public.profiles (education)
    where status = 'active';
create index if not exists profiles_profession_idx on public.profiles (profession)
    where status = 'active';
create index if not exists profiles_name_idx on public.profiles (full_name);

-- lifestyle and preference filters, which live on the same row now. the app
-- filters the merged profiles in memory, so these are there for when the
-- filtering moves into the query
create index if not exists profiles_diet_idx on public.profiles (diet);
create index if not exists profiles_pref_communities_idx
    on public.profiles using gin (pref_communities);

-- movePhoto reorders photos and forces index 0 to be the main one
create unique index if not exists profile_photos_order_idx
    on public.profile_photos (profile_id, sort_order);
create unique index if not exists profile_photos_primary_idx
    on public.profile_photos (profile_id) where is_primary;

-- stops the same two people sending each other two interests
create unique index if not exists interests_pair_idx on public.interests (
    least(from_profile_id, to_profile_id),
    greatest(from_profile_id, to_profile_id)
);
create index if not exists interests_inbox_idx on public.interests (to_profile_id, status);
create index if not exists interests_outbox_idx on public.interests (from_profile_id, status);

create index if not exists subscriptions_active_idx on public.subscriptions (user_id)
    where status = 'active';
create index if not exists subscriptions_renewal_idx on public.subscriptions (renews_on)
    where status = 'active';

create index if not exists membership_payments_user_idx
    on public.membership_payments (user_id);
create index if not exists membership_payments_status_idx
    on public.membership_payments (status, created_at desc);

create index if not exists success_stories_published_idx
    on public.success_stories (created_at desc) where status = 'published';

create index if not exists service_providers_type_idx on public.service_providers (type)
    where active;
create index if not exists service_providers_city_idx on public.service_providers (city)
    where active;

-- temples. the directory filters on active/is_approved and orders by added_at
create index if not exists idx_temples_added_at on public.temples (added_at desc);

-- the gallery and the service list are always read with their temple, and the
-- admin form reads both for one temple at a time
create index if not exists idx_temple_services_temple
    on public.temple_services (temple_id, sort_order);
create index if not exists idx_temple_images_temple
    on public.temple_images (temple_id, sort_order);
-- the public page filters to happens_on >= current_date and orders by it, so the
-- date leads rather than temple_id
create index if not exists idx_temple_festivals_upcoming
    on public.temple_festivals (happens_on, temple_id);
-- a featured service is pulled across every temple for the highlight rail
create index if not exists idx_temple_services_featured
    on public.temple_services (is_featured) where is_featured;


-- ============================================================================
-- 12b. temple image storage
--
-- The files behind temple cover_image and temple_images.url live in a supabase
-- storage bucket rather than in a table, so this is not a create table. The
-- bucket and its storage.objects policies are written in table_creation.md.
--
-- bucket            temple-images, public so logged-out visitors can see it
--                   (a second bucket rather than sharing profile-photos, so the
--                   temple gallery can be admin-writable while profile photos
--                   stay owned by the member who uploaded them)
-- path              <temples.temple_id>/<n>-<uuid>.<ext>   for gallery images
--                   <temples.temple_id>/cover-<uuid>.<ext> for the cover
-- file_size_limit   307200 bytes (300 KB), matching MAX_TEMPLE_IMAGE_BYTES
--                   in src/lib/constants.ts. The number appears in exactly two
--                   places and they must agree: the bucket rejects an oversized
--                   file with a bare 413 the admin form never sees.
-- allowed_mime_types  image/jpeg, image/png, image/webp
--
-- The five-image cap is a ROW COUNT, so the bucket cannot express it. It is
-- enforced by public.enforce_temple_image_cap() (a before-insert trigger on
-- temple_images that also counts temples.cover_image) and re-checked in the
-- upload action, which is the belt to the trigger's braces.
-- ============================================================================


-- ============================================================================
-- 12c. payment screenshot storage
--
-- The proof behind membership_payments.screenshot_path lives in a supabase
-- storage bucket rather than in a table. The bucket and its storage.objects
-- policies are written in table_creation.md.
--
-- bucket            payment-screenshots, PRIVATE (public = false) — unlike the
--                   other two buckets. A payment screenshot is between the
--                   member and the office, not gallery content, so it must
--                   never be reachable by a plain url. The admin queue and the
--                   member read it through a short-lived signed url minted
--                   server-side (fetchAdminPayments in admin-queries.ts).
-- path              <users.user_id>/<uuid>.<ext>         member upload
--                   <users.user_id>/admin-<uuid>.<ext>   admin attaching proof
-- file_size_limit   2097152 bytes (2 MB), matching MAX_PAYMENT_SCREENSHOT_BYTES
--                   in src/lib/constants.ts. Appears in exactly two places and
--                   they must agree.
-- allowed_mime_types  image/jpeg, image/png, image/webp
--
-- The first folder is the member's app-level user_id, resolved by
-- public.owns_user_folder() in table_creation.md (the same shape as
-- owns_profile_folder, but keyed on users.user_id rather than a profile_id).
-- ============================================================================


-- ============================================================================
-- Not in this file, and why
--
-- payment gateway   no gateway integration. the paid checkout is manual: the
--                   member pays the plan price by UPI and uploads a screenshot,
--                   and an admin reconciles it. The ledger itself IS in this
--                   file — membership_payments (section 8) — so this is the
--                   gateway that is absent, not the table.
-- profile_views     the "see who viewed my profile" screen does not exist
-- trust_actions     blocks and reports were removed with the admin panel
-- admin_audit_logs  nothing writes an audit trail yet
--
-- temple_timings    deliberately NOT a table. Seven fixed weekday columns on
--                   temples hold the set of days, which is fixed - see the sunday_
--                   timings block above for why a child table would only add a
--                   second save cycle.
-- temple_locations  deliberately not latitude/longitude. maps_url replaced them;
--                   nothing read them and an admin looking up a pin has the share
--                   link in hand already.
-- temple_special_days  deliberately not a column. festivals became rows in
--                   temple_festivals, which can be sorted and hidden by date.
--
-- Add them when the feature that needs them is actually built.
-- ============================================================================
