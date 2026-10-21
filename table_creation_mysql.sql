-- MySQL 8 (Hostinger) schema for Subha Vivaham.
-- Converted from table_creation.md (PostgreSQL/Supabase).
-- Requires MySQL >= 8.0.13 (expression defaults for UUID()).
--
-- Deliberately dropped (no MySQL/Supabase equivalent, handled in app code):
--   * auth_user_id FK to auth.users  -> Supabase auth is gone; session layer owns identity
--   * pin_user_privileges trigger     -> register action writes role='member' itself
--   * registration_email/phone_taken  -> plain SELECT in the register action
--   * owns_profile_folder / owns_user_folder + all 43 RLS policies -> every query
--     must filter by user_id / owner explicitly
--   * storage.buckets inserts        -> photos go to filesystem (public/uploads)
--   * profile_details merge blocks    -> one-off Postgres migrations, not needed

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
create table if not exists users (
    id                 char(36)     not null default (uuid()) primary key,
    user_id            varchar(64)  not null unique,
    auth_user_id       char(36)     null,
    password_hash      varchar(255) null,
    name               varchar(255) not null,
    email              varchar(320) not null,
    role               varchar(32)  not null default 'member',
    status             varchar(32)  not null default 'active',
    phone_number       varchar(32)  null,
    is_membership_user tinyint(1)   not null default 0,
    membership_plan    varchar(32)  null,
    joined_at          datetime     null,
    created_at         datetime     not null default current_timestamp,
    updated_at         datetime     not null default current_timestamp
);

create table if not exists communities (
    id                 varchar(64)  not null primary key,
    name               varchar(128) not null,
    tamil_name         varchar(128) not null,
    description        text         null,
    tamil_description  text         null,
    visible_members    int          not null default 0,
    active             tinyint(1)   not null default 1,
    created_at         datetime     not null default current_timestamp,
    updated_at         datetime     not null default current_timestamp
);

create table if not exists profiles (
    id                 char(36)     not null default (uuid()) primary key,
    profile_id         varchar(64)  not null unique,
    user_id            varchar(64)  null,
    full_name          varchar(255) not null,
    gender             varchar(16)  not null,
    date_of_birth      date         null,
    age                smallint     null,
    height             smallint     null,
    marital_status     varchar(32)  not null,
    religion           varchar(64)  null,
    community          varchar(64)  null,
    caste              varchar(64)  null,
    mother_tongue      varchar(64)  null,
    state              varchar(64)  null,
    district           varchar(64)  null,
    city               varchar(64)  null,
    education          varchar(128) null,
    college            varchar(128) null,
    profession         varchar(128) null,
    company            varchar(128) null,
    income             varchar(64)  null,
    country            varchar(64)  not null default 'India',
    about              text         null,
    verified           tinyint(1)   not null default 0,
    status             varchar(16)  not null default 'inactive',
    online             tinyint(1)   not null default 0,
    last_active        datetime     null,
    profile_created_on date         null,
    horoscope_link     text         null,
    father_occupation  varchar(128) null,
    mother_occupation  varchar(128) null,
    brother_count      smallint     not null default 0,
    sister_count       smallint     not null default 0,
    family_type        varchar(32)  not null default 'nuclear',
    family_location    varchar(128) null,
    family_values      varchar(255) null,
    gotra              varchar(64)  null,
    horoscope_required tinyint(1)   not null default 0,
    diet               varchar(32)  not null default 'vegetarian',
    smoking            varchar(16)  not null default 'never',
    drinking           varchar(16)  not null default 'never',
    hobbies            json         not null,
    fitness            varchar(128) null,
    sports             varchar(128) null,
    music              varchar(128) null,
    food               varchar(128) null,
    appearances        varchar(255) null,
    min_age            smallint     not null default 21,
    max_age            smallint     not null default 35,
    min_height         smallint     not null default 150,
    max_height         smallint     not null default 190,
    pref_religion      varchar(64)  null,
    pref_mother_tongues json        not null,
    pref_communities   json         not null,
    pref_education     json         not null,
    pref_professions   json         not null,
    pref_diet          varchar(32)  null,
    pref_smoking       varchar(16)  null,
    pref_drinking      varchar(16)  null,
    pref_income        varchar(64)  null,
    pref_locations     json         not null,
    pref_marital_statuses json      not null,
    interested_profile json         not null,
    created_at         datetime     not null default current_timestamp,
    updated_at         datetime     not null default current_timestamp,
    key idx_profiles_user (user_id)
) default charset = utf8mb4 collate = utf8mb4_unicode_ci;

-- MySQL has no column defaults for JSON literals other than expressions:
alter table profiles
    modify hobbies json not null default (json_array()),
    modify pref_mother_tongues json not null default (json_array()),
    modify pref_communities json not null default (json_array()),
    modify pref_education json not null default (json_array()),
    modify pref_professions json not null default (json_array()),
    modify pref_locations json not null default (json_array()),
    modify pref_marital_statuses json not null default (json_array('single')),
    modify interested_profile json not null default (json_array());

create table if not exists profile_photos (
    id          char(36)    not null default (uuid()) primary key,
    profile_id  char(36)    not null,
    url         text        not null,
    is_primary  tinyint(1)  not null default 0,
    caption     varchar(255) null,
    sort_order  smallint    not null default 0,
    created_at  datetime    not null default current_timestamp,
    constraint fk_photos_profile foreign key (profile_id) references profiles(id) on delete cascade
);

create table if not exists interests (
    id              char(36)    not null default (uuid()) primary key,
    interest_id     varchar(64) not null unique,
    from_profile_id char(36)    not null,
    to_profile_id   char(36)    not null,
    status          varchar(16) not null default 'pending',
    message         text        null,
    viewed          tinyint(1)  not null default 0,
    created_at      datetime    not null default current_timestamp,
    updated_at      datetime    not null default current_timestamp,
    constraint fk_interests_from foreign key (from_profile_id) references profiles(id) on delete cascade,
    constraint fk_interests_to   foreign key (to_profile_id)   references profiles(id) on delete cascade
);

create table if not exists membership_plans (
    id               varchar(64)   not null primary key,
    label            varchar(64)   not null,
    price            decimal(10,2) not null default 0,
    period           varchar(32)   not null,
    popular          tinyint(1)    not null default 0,
    is_active        tinyint(1)    not null default 1,
    sort_order       smallint      not null default 0,
    features         json          not null,
    compare_features json          not null,
    photo_limit      int           not null default 1,
    interest_limit   int           null
) default charset = utf8mb4 collate = utf8mb4_unicode_ci;

alter table membership_plans
    modify features json not null default (json_array()),
    modify compare_features json not null default (json_array());

create table if not exists subscriptions (
    id              char(36)    not null default (uuid()) primary key,
    subscription_id varchar(64) not null unique,
    user_id         varchar(64) not null,
    plan            varchar(64) not null,
    member_name     varchar(255) not null,
    amount          int         not null default 0,
    renews_on       date        null,
    status          varchar(16) not null default 'active',
    created_at      datetime    not null default current_timestamp,
    updated_at      datetime    not null default current_timestamp,
    constraint fk_subs_user foreign key (user_id) references users(user_id) on delete cascade,
    constraint fk_subs_plan foreign key (plan)    references membership_plans(id)
);

create table if not exists membership_payments (
    id              char(36)     not null default (uuid()) primary key,
    payment_id      varchar(64)  not null unique,
    user_id         varchar(64)  not null,
    plan            varchar(64)  not null,
    plan_name       varchar(64)  not null,
    member_name     varchar(255) not null,
    amount          decimal(10,2) not null default 0,
    screenshot_path text         not null,
    status          varchar(16)  not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected')),
    note            text         null,
    reviewed_at     datetime     null,
    created_at      datetime     not null default current_timestamp,
    updated_at      datetime     not null default current_timestamp,
    constraint fk_pay_user foreign key (user_id) references users(user_id) on delete cascade
);

create table if not exists success_stories (
    id            char(36)    not null default (uuid()) primary key,
    slug          varchar(128) not null unique,
    couple        varchar(255) not null,
    short_names   varchar(255) null,
    location      varchar(128) null,
    image         text        null,
    match_percent smallint    null,
    tagline       varchar(255) null,
    quote         text        null,
    story         json        not null,
    days_matched  varchar(64) null,
    status        varchar(16) not null default 'published',
    created_at    datetime    not null default current_timestamp,
    updated_at    datetime    not null default current_timestamp
) default charset = utf8mb4 collate = utf8mb4_unicode_ci;

alter table success_stories modify story json not null default (json_array());

create table if not exists temples (
    id                 char(36)    not null default (uuid()) primary key,
    temple_id          varchar(64) not null unique,
    name               varchar(255) not null,
    name_ta            varchar(255) null,
    deity              varchar(128) null,
    cover_image        text        null,
    address            text        null,
    city               varchar(64) null,
    district           varchar(64) null,
    state              varchar(64) null,
    country            varchar(64) not null default 'India',
    maps_url           text        null,
    history            text        null,
    sunday_timings     varchar(128) null,
    monday_timings     varchar(128) null,
    tuesday_timings    varchar(128) null,
    wednesday_timings  varchar(128) null,
    thursday_timings   varchar(128) null,
    friday_timings     varchar(128) null,
    saturday_timings   varchar(128) null,
    contact            varchar(64) null,
    whatsapp           varchar(64) null,
    email              varchar(320) null,
    contact_person     varchar(128) null,
    website            text        null,
    is_approved        tinyint(1)  not null default 1,
    active             tinyint(1)  not null default 1,
    added_at           datetime    not null default current_timestamp,
    updated_at         datetime    not null default current_timestamp
) default charset = utf8mb4 collate = utf8mb4_unicode_ci;

create table if not exists temple_services (
    id           char(36)    not null default (uuid()) primary key,
    temple_id    varchar(64) not null,
    name         varchar(255) not null,
    details      text        null,
    price        int         not null default 0,
    image        text        null,
    terms        text        null,
    is_available tinyint(1)  not null default 1,
    is_featured  tinyint(1)  not null default 0,
    sort_order   smallint    not null default 0,
    created_at   datetime    not null default current_timestamp,
    updated_at   datetime    not null default current_timestamp,
    constraint fk_ts_temple foreign key (temple_id) references temples(temple_id) on delete cascade
);

create table if not exists temple_images (
    id         char(36)    not null default (uuid()) primary key,
    temple_id  varchar(64) not null,
    url        text        not null,
    alt        varchar(255) null,
    sort_order smallint    not null default 0,
    created_at datetime    not null default current_timestamp,
    constraint fk_ti_temple foreign key (temple_id) references temples(temple_id) on delete cascade
);

create table if not exists temple_festivals (
    id         char(36)    not null default (uuid()) primary key,
    temple_id  varchar(64) not null,
    name       varchar(255) not null,
    happens_on date        null,
    sort_order smallint    not null default 0,
    created_at datetime    not null default current_timestamp,
    updated_at datetime    not null default current_timestamp,
    constraint fk_tf_temple foreign key (temple_id) references temples(temple_id) on delete cascade
);

create table if not exists service_providers (
    id          char(36)    not null default (uuid()) primary key,
    service_id  varchar(64) not null unique,
    type        varchar(64) not null,
    name        varchar(255) not null,
    contact     varchar(64) null,
    city        varchar(64) null,
    address     text        null,
    phone       varchar(64) null,
    details     text        null,
    is_approved tinyint(1)  not null default 1,
    active      tinyint(1)  not null default 1,
    added_at    datetime    not null default current_timestamp,
    updated_at  datetime    not null default current_timestamp
) default charset = utf8mb4 collate = utf8mb4_unicode_ci;

create table if not exists site_config (
    id             varchar(64)  not null primary key,
    banner_text    varchar(255) not null default '',
    banner_enabled tinyint(1)   not null default 0,
    office_address varchar(255) not null default '',
    updated_at     datetime     not null default current_timestamp
);

-- ---------------------------------------------------------------------------
-- indexes
create index if not exists idx_temple_services_temple on temple_services (temple_id, sort_order);
create index if not exists idx_temple_images_temple on temple_images (temple_id, sort_order);
create index if not exists idx_temple_festivals_upcoming on temple_festivals (happens_on, temple_id);
create index if not exists idx_temple_services_featured on temple_services (is_featured, temple_id);
create index if not exists idx_temples_added_at on temples (added_at);
-- MariaDB rejects functional indexes ( (lower(email)) ), so lower(email) is
-- materialised into a stored generated column and the unique index goes on that.
alter table users
    add column if not exists email_lower varchar(320) as (lower(email)) stored;
create unique index if not exists idx_users_email on users (email_lower);
create unique index if not exists idx_users_phone on users (phone_number);

-- ---------------------------------------------------------------------------
-- updated_at maintained by the database, same job the Postgres touch trigger did
drop trigger if exists trg_touch_users;
create trigger trg_touch_users before update on users
    for each row set new.updated_at = current_timestamp;

drop trigger if exists trg_touch_communities;
create trigger trg_touch_communities before update on communities
    for each row set new.updated_at = current_timestamp;

drop trigger if exists trg_touch_profiles;
create trigger trg_touch_profiles before update on profiles
    for each row set new.updated_at = current_timestamp;

drop trigger if exists trg_touch_interests;
create trigger trg_touch_interests before update on interests
    for each row set new.updated_at = current_timestamp;

drop trigger if exists trg_touch_subscriptions;
create trigger trg_touch_subscriptions before update on subscriptions
    for each row set new.updated_at = current_timestamp;

drop trigger if exists trg_touch_payments;
create trigger trg_touch_payments before update on membership_payments
    for each row set new.updated_at = current_timestamp;

drop trigger if exists trg_touch_stories;
create trigger trg_touch_stories before update on success_stories
    for each row set new.updated_at = current_timestamp;

drop trigger if exists trg_touch_temples;
create trigger trg_touch_temples before update on temples
    for each row set new.updated_at = current_timestamp;

drop trigger if exists trg_touch_temple_services;
create trigger trg_touch_temple_services before update on temple_services
    for each row set new.updated_at = current_timestamp;

drop trigger if exists trg_touch_temple_festivals;
create trigger trg_touch_temple_festivals before update on temple_festivals
    for each row set new.updated_at = current_timestamp;

drop trigger if exists trg_touch_service_providers;
create trigger trg_touch_service_providers before update on service_providers
    for each row set new.updated_at = current_timestamp;

-- same rule as public.enforce_temple_image_cap(): max 5 incl. cover.
-- the body has several statements, so the statement delimiter must be swapped
-- to // or the client (phpMyAdmin) splits it at the first "declare ... ;"
drop trigger if exists temple_images_cap;
DELIMITER //
create trigger temple_images_cap before insert on temple_images
    for each row
    begin
        declare existing int;
        declare has_cover bool;
        select count(*) into existing from temple_images where temple_id = new.temple_id;
        select cover_image is not null into has_cover from temples where temple_id = new.temple_id;
        if coalesce(has_cover, false) then
            set existing = existing + 1;
        end if;
        if existing >= 5 then
            signal sqlstate '45000'
                set message_text = 'A temple can have at most 5 images including the cover';
        end if;
    end//
DELIMITER ;

-- ---------------------------------------------------------------------------
-- app sessions (replace Supabase Auth). the browser holds a random token in an
-- httpOnly cookie; only its sha256 lands here.
create table if not exists sessions (
    id          char(36)    not null default (uuid()) primary key,
    token_hash  char(64)    not null unique,
    user_id     varchar(64) not null,
    created_at  datetime    not null default current_timestamp,
    expires_at  datetime    not null,
    constraint fk_sessions_user foreign key (user_id) references users(user_id) on delete cascade
);

-- ---------------------------------------------------------------------------
insert ignore into site_config (id, banner_text, banner_enabled)
values ('main', '', false);

-- make sure the session ends with FK enforcement on (a failed/partial import
-- can leave it off, which hides broken references until later)
SET FOREIGN_KEY_CHECKS=1;
