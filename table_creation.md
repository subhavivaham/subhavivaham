create table if not exists public.users (
   id                 uuid primary key default gen_random_uuid(),
   user_id            text unique not null,
   auth_user_id       uuid unique references auth.users(id) on delete cascade,
   name               text not null,
   email              text not null,
   role               text not null default 'member',
   status             text not null default 'active',
   phone_number       text,
   is_membership_user boolean not null default false,
   membership_plan    text,
   joined_at          timestamptz,
   created_at         timestamptz not null default now(),
   updated_at         timestamptz not null default now()
);

create or replace function public.pin_user_privileges()
returns trigger
language plpgsql
as 'begin
    if auth.jwt() is null
       or coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''') = ''admin''
       or coalesce(auth.jwt() ->> ''role'', '''') = ''service_role''
    then
        return new;
    end if;

    if tg_op = ''INSERT'' then
        new.role := ''member'';
        new.is_membership_user := false;
        new.membership_plan := null;
    else
        new.role := old.role;
        new.is_membership_user := old.is_membership_user;
        new.membership_plan := old.membership_plan;
    end if;

    return new;
end;';

revoke all on function public.pin_user_privileges() from public;

drop trigger if exists trg_pin_user_privileges on public.users;

create trigger trg_pin_user_privileges
before insert or update on public.users
for each row
execute function public.pin_user_privileges();

create table if not exists public.communities (
    id                 text primary key,
    name               text not null,
    tamil_name         text not null,
    description        text,
    tamil_description  text,
    visible_members    integer not null default 0,
    active             boolean not null default true,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create table if not exists public.profiles (
    id                 uuid primary key default gen_random_uuid(),
    profile_id         text unique not null,
    user_id            text references public.users(user_id),
    full_name          text not null,
    gender             text not null,
    date_of_birth      date,
    age                smallint,
    height             smallint,
    marital_status     text not null,
    religion           text,
    community          text,
    caste              text,
    mother_tongue      text,
    state              text,
    district           text,
    city               text,
    education          text,
    college            text,
    profession         text,
    company            text,
    income             text,
    country            text not null default 'India',
    about              text,
    verified           boolean not null default false,
    status             text not null default 'inactive',
    online             boolean not null default false,
    last_active        timestamptz,
    profile_created_on date,
    horoscope_link     text,
    father_occupation  text,
    mother_occupation  text,
    brother_count      smallint not null default 0,
    sister_count       smallint not null default 0,
    family_type        text not null default 'nuclear',
    family_location    text,
    family_values      text,
    gotra              text,
    horoscope_required boolean not null default false,
    diet               text not null default 'vegetarian',
    smoking            text not null default 'never',
    drinking           text not null default 'never',
    hobbies            text[] not null default '{}',
    fitness            text,
    sports             text,
    music              text,
    food               text,
    appearances        text,
    min_age            smallint not null default 21,
    max_age            smallint not null default 35,
    min_height         smallint not null default 150,
    max_height         smallint not null default 190,
    pref_religion      text,
    pref_mother_tongues text[] not null default '{}',
    pref_communities   text[] not null default '{}',
    pref_education     text[] not null default '{}',
    pref_professions   text[] not null default '{}',
    pref_diet          text,
    pref_smoking       text,
    pref_drinking      text,
    pref_income        text,
    pref_locations     text[] not null default '{}',
    pref_marital_statuses text[] not null default '{single}',
    interested_profile text[] not null default '{}',
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

update public.profiles set marital_status = 'single' where marital_status = 'never-married';

do $$
begin
    if to_regclass('public.profile_details') is not null then
        update public.profiles p
           set father_occupation        = d.father_occupation,
               mother_occupation        = d.mother_occupation,
               brother_count            = d.brother_count,
               sister_count             = d.sister_count,
               family_type              = d.family_type,
               family_location          = d.family_location,
               family_values            = d.family_values,
               gotra                    = d.gotra,
               horoscope_required       = d.horoscope_required,
               diet                     = d.diet,
               smoking                  = d.smoking,
               drinking                 = d.drinking,
               hobbies                  = d.hobbies,
               fitness                  = d.fitness,
               sports                   = d.sports,
               music                    = d.music,
               food                     = d.food,
               appearances              = d.appearances,
               min_age                  = d.min_age,
               max_age                  = d.max_age,
               min_height               = d.min_height,
               max_height               = d.max_height,
               pref_religion            = d.pref_religion,
               pref_mother_tongues      = d.pref_mother_tongues,
               pref_communities         = d.pref_communities,
               pref_education           = d.pref_education,
               pref_professions         = d.pref_professions,
               pref_diet                = d.pref_diet,
               pref_smoking             = d.pref_smoking,
               pref_drinking            = d.pref_drinking,
               pref_income              = d.pref_income,
               pref_locations           = d.pref_locations,
               pref_marital_statuses    = d.pref_marital_statuses
          from public.profile_details d
         where d.profile_id = p.id;
    end if;
end $$;

update public.profiles
   set pref_marital_statuses = array(
         select case s when 'never-married' then 'single' else s end
           from unnest(pref_marital_statuses) as s
       )
 where 'never-married' = any(pref_marital_statuses);

drop table if exists public.profile_details;

create table if not exists public.profile_photos (
    id          uuid primary key default gen_random_uuid(),
    profile_id  uuid not null references public.profiles(id) on delete cascade,
    url         text not null,
    is_primary  boolean not null default false,
    caption     text,
    sort_order  smallint not null default 0,
    created_at  timestamptz not null default now()
);

create table if not exists public.interests (
    id              uuid primary key default gen_random_uuid(),
    interest_id     text unique not null,
    from_profile_id uuid not null references public.profiles(id) on delete cascade,
    to_profile_id   uuid not null references public.profiles(id) on delete cascade,
    status          text not null default 'pending',
    message         text,
    viewed          boolean not null default false,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create table if not exists public.membership_plans (
    id          text primary key,
    label       text not null,
    price       numeric(10,2) not null default 0,
    period      text not null,
    popular     boolean not null default false,
    is_active   boolean not null default true,
    sort_order  smallint not null default 0,
    features    jsonb not null default '[]',
    compare_features jsonb not null default '[]',
    photo_limit    integer not null default 1,
    interest_limit integer
);

create table if not exists public.subscriptions (
    id              uuid primary key default gen_random_uuid(),
    subscription_id text unique not null,
    user_id         text not null references public.users(user_id),
    plan            text not null references public.membership_plans(id),
    member_name     text not null,
    amount          integer not null default 0,
    renews_on       date,
    status          text not null default 'active',
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create table if not exists public.membership_payments (
    id              uuid primary key default gen_random_uuid(),
    payment_id      text unique not null,
    user_id         text not null references public.users(user_id),
    plan            text not null,
    plan_name       text not null,
    member_name     text not null,
    amount          numeric(10,2) not null default 0,
    screenshot_path text not null,
    status          text not null default 'pending'
                        check (status in ('pending', 'approved', 'rejected')),
    note            text,
    reviewed_at     timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as 'begin
  new.updated_at := now();
  return new;
end;';

revoke all on function public.touch_updated_at() from public;

create table if not exists public.success_stories (
    id            uuid primary key default gen_random_uuid(),
    slug          text unique not null,
    couple        text not null,
    short_names   text,
    location      text,
    image         text,
    match_percent smallint,
    tagline       text,
    quote         text,
    story         text[] not null default '{}',
    days_matched  text,
    status        text not null default 'published',
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create table if not exists public.temples (
    id          text primary key default gen_random_uuid()::text,
    temple_id   text unique not null,
    name        text not null,
    name_ta     text,
    deity       text,
    cover_image text,
    address     text,
    city        text,
    district    text,
    state       text,
    country     text not null default 'India',
    maps_url    text,
    history     text,
    sunday_timings    text,
    monday_timings    text,
    tuesday_timings   text,
    wednesday_timings text,
    thursday_timings  text,
    friday_timings    text,
    saturday_timings  text,
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

create table if not exists public.temple_images (
    id         text primary key default gen_random_uuid()::text,
    temple_id  text not null references public.temples(temple_id) on delete cascade,
    url        text not null,
    alt        text,
    sort_order smallint not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.temple_festivals (
    id         text primary key default gen_random_uuid()::text,
    temple_id  text not null references public.temples(temple_id) on delete cascade,
    name       text not null,
    happens_on date,
    sort_order smallint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_temple_services_temple on public.temple_services (temple_id, sort_order);
create index if not exists idx_temple_images_temple on public.temple_images (temple_id, sort_order);
create index if not exists idx_temple_festivals_upcoming on public.temple_festivals (happens_on, temple_id);
create index if not exists idx_temple_services_featured on public.temple_services (is_featured) where is_featured;
create index if not exists idx_temples_added_at on public.temples (added_at desc);

create table if not exists public.service_providers (
    id          text primary key default gen_random_uuid()::text,
    service_id  text unique not null,
    type        text not null,
    name        text not null,
    contact     text,
    city        text,
    address     text,
    phone       text,
    details     text,
    is_approved boolean not null default true,
    active      boolean not null default true,
    added_at    timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create table if not exists public.site_config (
    id             text primary key,
    banner_text    text not null default '',
    banner_enabled boolean not null default false,
    office_address text not null default '',
    updated_at     timestamptz not null default now()
);

insert into public.site_config (id, banner_text, banner_enabled)
values ('main', '', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'profile-photos',
    'profile-photos',
    true,
    102400,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
    set public             = excluded.public,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'temple-images',
    'temple-images',
    true,
    307200,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
    set public             = excluded.public,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.enforce_temple_image_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    existing integer;
    has_cover boolean;
begin
    select count(*) into existing
    from public.temple_images
    where temple_id = new.temple_id;

    select cover_image is not null into has_cover
    from public.temples
    where temple_id = new.temple_id;

    if coalesce(has_cover, false) then
        existing := existing + 1;
    end if;

    if existing >= 5 then
        raise exception 'A temple can have at most 5 images including the cover (temple_id=%)', new.temple_id
            using errcode = 'check_violation';
    end if;
    return new;
end;
$$;

drop trigger if exists temple_images_cap on public.temple_images;
create trigger temple_images_cap
    before insert on public.temple_images
    for each row execute function public.enforce_temple_image_cap();

create unique index if not exists idx_users_email on public.users (lower(email));
create unique index if not exists idx_users_phone on public.users (phone_number);

create or replace function public.registration_email_taken(candidate_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.users where lower(email) = lower(candidate_email));
$$;

create or replace function public.registration_phone_taken(candidate_phone text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.users where phone_number = candidate_phone);
$$;

revoke all on function public.registration_email_taken(text) from public;
revoke all on function public.registration_phone_taken(text) from public;
grant execute on function public.registration_email_taken(text) to anon, authenticated;
grant execute on function public.registration_phone_taken(text) to anon, authenticated;

drop policy if exists users_self_insert on public.users;
create policy users_self_insert on public.users
  for insert to authenticated
  with check (
    auth_user_id = auth.uid()
    and role = 'member'
    and status = 'active'
  );

create or replace function public.owns_profile_folder(folder text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles p
        join public.users u on u.user_id = p.user_id
        where p.profile_id = folder
          and u.auth_user_id = auth.uid()
    );
$$;

revoke all on function public.owns_profile_folder(text) from public;
grant execute on function public.owns_profile_folder(text) to authenticated;

drop policy if exists profile_photos_storage_read on storage.objects;
create policy profile_photos_storage_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'profile-photos');

drop policy if exists profile_photos_storage_insert on storage.objects;
create policy profile_photos_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (
      public.owns_profile_folder((storage.foldername(name))[1])
      or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
    )
  );

drop policy if exists profile_photos_storage_update on storage.objects;
create policy profile_photos_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and (
      public.owns_profile_folder((storage.foldername(name))[1])
      or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
    )
  )
  with check (
    bucket_id = 'profile-photos'
    and (
      public.owns_profile_folder((storage.foldername(name))[1])
      or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
    )
  );

drop policy if exists profile_photos_storage_delete on storage.objects;
create policy profile_photos_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and (
      public.owns_profile_folder((storage.foldername(name))[1])
      or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
    )
  );

drop policy if exists temple_images_storage_read on storage.objects;
create policy temple_images_storage_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'temple-images');

drop policy if exists temple_images_storage_insert on storage.objects;
create policy temple_images_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'temple-images'
    and (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  );

drop policy if exists temple_images_storage_update on storage.objects;
create policy temple_images_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'temple-images'
    and (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  )
  with check (
    bucket_id = 'temple-images'
    and (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  );

drop policy if exists temple_images_storage_delete on storage.objects;
create policy temple_images_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'temple-images'
    and (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'payment-screenshots',
    'payment-screenshots',
    false,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
    set public             = excluded.public,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.owns_user_folder(folder text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.users u
        where u.user_id = folder
          and u.auth_user_id = auth.uid()
    );
$$;

revoke all on function public.owns_user_folder(text) from public;
grant execute on function public.owns_user_folder(text) to authenticated;

drop policy if exists payment_screenshots_storage_read on storage.objects;
create policy payment_screenshots_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-screenshots'
    and (
      public.owns_user_folder((storage.foldername(name))[1])
      or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
    )
  );

drop policy if exists payment_screenshots_storage_insert on storage.objects;
create policy payment_screenshots_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-screenshots'
    and (
      public.owns_user_folder((storage.foldername(name))[1])
      or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
    )
  );

drop policy if exists payment_screenshots_storage_update on storage.objects;
create policy payment_screenshots_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'payment-screenshots'
    and (
      public.owns_user_folder((storage.foldername(name))[1])
      or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
    )
  )
  with check (
    bucket_id = 'payment-screenshots'
    and (
      public.owns_user_folder((storage.foldername(name))[1])
      or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
    )
  );

drop policy if exists payment_screenshots_storage_delete on storage.objects;
create policy payment_screenshots_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'payment-screenshots'
    and (
      public.owns_user_folder((storage.foldername(name))[1])
      or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
    )
  );
