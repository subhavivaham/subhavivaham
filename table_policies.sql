create index if not exists idx_users_auth on public.users (auth_user_id);
create index if not exists idx_profiles_user on public.profiles (user_id);
create index if not exists idx_profiles_status on public.profiles (status);
create index if not exists idx_profiles_gender on public.profiles (gender);
create index if not exists idx_profiles_city on public.profiles (city);
create index if not exists idx_profiles_religion on public.profiles (religion);
create index if not exists idx_profiles_community on public.profiles (community);
create index if not exists idx_profiles_marital on public.profiles (marital_status);
create index if not exists idx_profile_photos_profile on public.profile_photos (profile_id);
create index if not exists idx_interests_from on public.interests (from_profile_id);
create index if not exists idx_interests_to on public.interests (to_profile_id);
create index if not exists idx_interests_status on public.interests (status);
create index if not exists idx_subscriptions_user on public.subscriptions (user_id);
create index if not exists idx_subscriptions_status on public.subscriptions (status);
-- the admin queue filters by status and reads newest first; the member view
-- reads their own rows.
create index if not exists idx_membership_payments_user on public.membership_payments (user_id);
create index if not exists idx_membership_payments_status on public.membership_payments (status, created_at desc);
create index if not exists idx_success_stories_status on public.success_stories (status);
create index if not exists idx_service_providers_type on public.service_providers (type);
-- temples is read on every public page render, newest first.
create index if not exists idx_temples_added_at on public.temples (added_at desc);
-- the detail page reads one temple's gallery and service list together.
create index if not exists idx_temple_images_temple on public.temple_images (temple_id, sort_order);
create index if not exists idx_temple_services_temple on public.temple_services (temple_id, sort_order);

-- public reference data -----------------------------------------------------

alter table public.communities enable row level security;
drop policy if exists communities_read on public.communities;
create policy communities_read on public.communities
  for select to anon, authenticated
  using (active);
drop policy if exists communities_admin_write on public.communities;
create policy communities_admin_write on public.communities
  for all to authenticated
  using ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'))
  with check ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'));

alter table public.membership_plans enable row level security;
drop policy if exists membership_plans_read on public.membership_plans;
create policy membership_plans_read on public.membership_plans
  for select to anon, authenticated
  using (is_active);
drop policy if exists membership_plans_admin_write on public.membership_plans;
create policy membership_plans_admin_write on public.membership_plans
  for all to authenticated
  using ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'))
  with check ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'));

alter table public.success_stories enable row level security;
drop policy if exists success_stories_read on public.success_stories;
create policy success_stories_read on public.success_stories
  for select to anon, authenticated
  using (status = 'published');
drop policy if exists success_stories_admin_write on public.success_stories;
create policy success_stories_admin_write on public.success_stories
  for all to authenticated
  using ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'))
  with check ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'));

alter table public.service_providers enable row level security;
-- both gates must be open before anon can read a row. an unapproved listing is
-- not just filtered out of the page, it is unreadable over a direct table read.
-- is_approved is the review gate, active is the on/off switch for a listing that
-- has already been approved. table_creation.md adds the is_approved column.
drop policy if exists service_providers_read on public.service_providers;
create policy service_providers_read on public.service_providers
  for select to anon, authenticated
  using (is_approved and active);
drop policy if exists service_providers_admin_write on public.service_providers;
create policy service_providers_admin_write on public.service_providers
  for all to authenticated
  using ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'))
  with check ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'));

-- a vendor self-registering on /vendor-register. insert only, for anon, and the
-- with check pins both gates shut, so a caller cannot post itself straight onto
-- the public page. approval is an admin flipping is_approved, which only an
-- authenticated admin can do. update and delete stay admin-only, so a pending
-- row can only be edited by us.
--
-- this is deliberately the weakest write path in the schema: any anonymous
-- visitor may insert a row. rate limiting belongs in front of the action for
-- production; the row itself is inert while it sits unapproved.
drop policy if exists service_providers_public_insert on public.service_providers;
create policy service_providers_public_insert on public.service_providers
  for insert to anon
  with check (is_approved = false and active = false);

-- temples -------------------------------------------------------------------
-- this table had row level security switched on with no select policy at all,
-- which does not fail loudly: postgrest answers 200 with an empty array, so
-- fetchTemples returned [] and the public page rendered its empty state while
-- every row sat in the table. a bad column name still returns 400, which is
-- how you tell "no rows visible" apart from "no such table".
--
-- READS ARE CURRENTLY OPEN TO EVERYONE. this is deliberate for now and it is the
-- one decision here still open for review. is_approved and active exist and are
-- both editable in the admin, but neither decides visibility, so a temple an
-- admin has unpublished or rejected is still readable by anyone with the
-- publishable key, and the "hidden from the public site" toast in
-- temples-manager is untrue.
--
-- to make publishing real, the only line that changes is the using clause:
--
--   using (is_approved and active);
--
-- which is exactly service_providers_read below. doing that needs no application
-- change at all, because fetchTemples would then be filtering rows the database
-- already removed. the alternative is deleting the approve/reject/publish buttons
-- and the two columns, and accepting that nothing is gated.
alter table public.temples enable row level security;
drop policy if exists temples_read on public.temples;
create policy temples_read on public.temples
  for select to anon, authenticated
  using (true);
-- writes stay admin-only. without this the open read above would be the only
-- thing standing between an anonymous visitor and an edit to the listing.
drop policy if exists temples_admin_write on public.temples;
create policy temples_admin_write on public.temples
  for all to authenticated
  using ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'))
  with check ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'));

-- temple_services ------------------------------------------------------------
-- a child of temples, so the same two gates apply: open public read, admin-only
-- write.
--
-- is_available is the package on/off switch and IS enforced here, which is the
-- difference between this and the temple-level flags. a disabled service stays
-- in the table so an admin can switch it back on, but it is not readable by the
-- public, so it cannot be scraped straight off the API either.
--
-- the admin dashboard needs to see the disabled rows, and it reads through the
-- cookie-backed client in admin-queries.ts as an authenticated admin, so the
-- read policy has to admit them to that role. without the branch below, the
-- dashboard would show every package as available.
--
-- the enable line above is not optional: a policy on a table whose RLS is off is
-- dead text, and the table then falls back to its grants rather than these
-- conditions. every other table in this file carries the same statement.
alter table public.temple_services enable row level security;
drop policy if exists temple_services_read on public.temple_services;
create policy temple_services_read on public.temple_services
  for select to anon, authenticated
  using (
    is_available
    or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  );

drop policy if exists temple_services_admin_write on public.temple_services;
create policy temple_services_admin_write on public.temple_services
  for all to authenticated
  using ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'))
  with check ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'));

-- temple_images --------------------------------------------------------------
-- one row per gallery image. there is no availability flag to honour, so the
-- public read is unconditional: removing an image is done by deleting the row.
alter table public.temple_images enable row level security;
drop policy if exists temple_images_read on public.temple_images;
create policy temple_images_read on public.temple_images
  for select to anon, authenticated
  using (true);

drop policy if exists temple_images_admin_write on public.temple_images;
create policy temple_images_admin_write on public.temple_images
  for all to authenticated
  using ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'))
  with check ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'));

-- temple_festivals ------------------------------------------------------------
-- a child of temples, so the same two gates as temple_images: open public read,
-- admin-only write. there is no availability flag — a festival is removed by
-- deleting its row.
--
-- past festivals are NOT filtered here. the date filter belongs in the query
-- (fetchFestivals), not in the policy, for two reasons: the admin dashboard
-- needs to see past rows so an operator can update the date for next year, and
-- a policy comparing against current_date would need to be re-evaluated per row
-- anyway. the index idx_temple_festivals_upcoming is what makes the filter cheap.
alter table public.temple_festivals enable row level security;
drop policy if exists temple_festivals_read on public.temple_festivals;
create policy temple_festivals_read on public.temple_festivals
  for select to anon, authenticated
  using (true);

drop policy if exists temple_festivals_admin_write on public.temple_festivals;
create policy temple_festivals_admin_write on public.temple_festivals
  for all to authenticated
  using ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'))
  with check ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'));

-- NOTE: the two policies above are created but their tables are only created in
-- table_creation.md. run that file first or these fail with 42p01, and remember
-- every policy here still has to be applied to the live database by hand --
-- editing this file does nothing on its own.


-- site_config -------------------------------------------------------------------
-- single-row table holding the public banner text and its on/off switch.
alter table public.site_config enable row level security;
drop policy if exists site_config_read on public.site_config;
create policy site_config_read on public.site_config
  for select to anon, authenticated
  using (true);
drop policy if exists site_config_admin_write on public.site_config;
create policy site_config_admin_write on public.site_config
  for all to authenticated
  using ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'))
  with check ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'));

-- profiles ------------------------------------------------------------------
-- family, lifestyle and preference columns live on this row too, so these four
-- policies are the only ones that decide who can read or write them.

alter table public.profiles enable row level security;
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to anon, authenticated
  using (
    -- a member always sees their own row, even while it is unverified: the
    -- dashboard reads it back to show them what the admin queue is missing
    user_id = (select users.user_id from public.users where users.auth_user_id = auth.uid())
    -- the public browse pages are scoped to live profiles only. registration
    -- writes verified=false / status=inactive, and the admin approval writes
    -- both on, so a profile is invisible to everyone but its owner (and the
    -- admin branch below) until it has been verified.
    or (verified = true and status = 'active')
    -- admins read through an admin-session client, which must see every row in
    -- the queue, active, rejected and pending alike
    or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  );
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (
    user_id = (select users.user_id from public.users where users.auth_user_id = auth.uid())
    or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  );
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (
    user_id = (select users.user_id from public.users where users.auth_user_id = auth.uid())
    or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  )
  with check (
    user_id = (select users.user_id from public.users where users.auth_user_id = auth.uid())
    or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  );
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated
  using (
    user_id = (select users.user_id from public.users where users.auth_user_id = auth.uid())
    or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  );

alter table public.profile_photos enable row level security;
drop policy if exists profile_photos_read on public.profile_photos;
create policy profile_photos_read on public.profile_photos
  for select to anon, authenticated
  using (true);
drop policy if exists profile_photos_insert on public.profile_photos;
create policy profile_photos_insert on public.profile_photos
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = public.profile_photos.profile_id
        and p.user_id = (select users.user_id from public.users where users.auth_user_id = auth.uid())
    )
    or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  );
drop policy if exists profile_photos_update on public.profile_photos;
create policy profile_photos_update on public.profile_photos
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = public.profile_photos.profile_id
        and p.user_id = (select users.user_id from public.users where users.auth_user_id = auth.uid())
    )
    or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = public.profile_photos.profile_id
        and p.user_id = (select users.user_id from public.users where users.auth_user_id = auth.uid())
    )
    or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  );
drop policy if exists profile_photos_delete on public.profile_photos;
create policy profile_photos_delete on public.profile_photos
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = public.profile_photos.profile_id
        and p.user_id = (select users.user_id from public.users where users.auth_user_id = auth.uid())
    )
    or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  );

-- private member data -------------------------------------------------------

alter table public.users enable row level security;
drop policy if exists users_read on public.users;
create policy users_read on public.users
  for select to authenticated
  using (
    auth_user_id = auth.uid()
    or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  );
-- the /register action writes this row itself, using the session it has just
-- created, so without an insert policy the first statement of registration
-- fails with 42501 and every later step fails behind it: profiles_insert keys
-- on the users row, so the profile and the photos go down with it.
--
-- the check is deliberately narrow. auth_user_id must be the caller's own uid,
-- so nobody can mint an account for someone else, and role is pinned to member
-- so a signup cannot arrive pre-promoted. the role and membership columns are
-- held still on update by trg_pin_user_privileges in table_creation.md.
drop policy if exists users_insert_self on public.users;
create policy users_insert_self on public.users
  for insert to authenticated
  with check (
    auth_user_id = auth.uid()
    and role = 'member'
  );
drop policy if exists users_update on public.users;
create policy users_update on public.users
  for update to authenticated
  using (
    auth_user_id = auth.uid()
    or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  )
  with check (
    auth_user_id = auth.uid()
    or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  );
drop policy if exists users_admin_write on public.users;
create policy users_admin_write on public.users
  for all to authenticated
  using ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'))
  with check ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'));

alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_read on public.subscriptions;
create policy subscriptions_read on public.subscriptions
  for select to authenticated
  using (
    user_id = (select users.user_id from public.users where users.auth_user_id = auth.uid())
    or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  );
drop policy if exists subscriptions_insert on public.subscriptions;
create policy subscriptions_insert on public.subscriptions
  for insert to authenticated
  with check ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'));
drop policy if exists subscriptions_update on public.subscriptions;
create policy subscriptions_update on public.subscriptions
  for update to authenticated
  using (
    user_id = (select users.user_id from public.users where users.auth_user_id = auth.uid())
    or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  )
  with check ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'));
drop policy if exists subscriptions_delete on public.subscriptions;
create policy subscriptions_delete on public.subscriptions
  for delete to authenticated
  using ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'));

-- membership_payments --------------------------------------------------------
-- the self-service paid checkout. a member files a pending request with their
-- own session and reads it back to see the decision; an admin reconciles every
-- row from the dashboard and is the only one who may change a status.
alter table public.membership_payments enable row level security;
drop policy if exists membership_payments_read on public.membership_payments;
create policy membership_payments_read on public.membership_payments
  for select to authenticated
  using (
    user_id = (select users.user_id from public.users where users.auth_user_id = auth.uid())
    or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  );
-- the member creates the row, and with check pins user_id to the caller AND
-- status to 'pending', so a forged payload can neither file against someone
-- else nor arrive pre-approved. approving is an admin update below, so a member
-- cannot grant themselves the plan by writing the row.
drop policy if exists membership_payments_insert on public.membership_payments;
create policy membership_payments_insert on public.membership_payments
  for insert to authenticated
  with check (
    user_id = (select users.user_id from public.users where users.auth_user_id = auth.uid())
    and status = 'pending'
  );
drop policy if exists membership_payments_update on public.membership_payments;
create policy membership_payments_update on public.membership_payments
  for update to authenticated
  using ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'))
  with check ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'));
drop policy if exists membership_payments_delete on public.membership_payments;
create policy membership_payments_delete on public.membership_payments
  for delete to authenticated
  using ((select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'));

alter table public.interests enable row level security;
drop policy if exists interests_read on public.interests;
create policy interests_read on public.interests
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = public.interests.from_profile_id
        and p.user_id = (select users.user_id from public.users where users.auth_user_id = auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = public.interests.to_profile_id
        and p.user_id = (select users.user_id from public.users where users.auth_user_id = auth.uid())
    )
    or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  );
drop policy if exists interests_insert on public.interests;
create policy interests_insert on public.interests
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = public.interests.from_profile_id
        and p.user_id = (select users.user_id from public.users where users.auth_user_id = auth.uid())
    )
  );
drop policy if exists interests_update on public.interests;
create policy interests_update on public.interests
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = public.interests.from_profile_id
        and p.user_id = (select users.user_id from public.users where users.auth_user_id = auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = public.interests.to_profile_id
        and p.user_id = (select users.user_id from public.users where users.auth_user_id = auth.uid())
    )
    or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = public.interests.from_profile_id
        and p.user_id = (select users.user_id from public.users where users.auth_user_id = auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = public.interests.to_profile_id
        and p.user_id = (select users.user_id from public.users where users.auth_user_id = auth.uid())
    )
    or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  );
-- the sender may recall their own interest, and an admin may moderate a pair.
-- without the admin branch an admin reviewing the table cannot act on a row,
-- even though every other command on this table opens to the role claim.
drop policy if exists interests_delete on public.interests;
create policy interests_delete on public.interests
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = public.interests.from_profile_id
        and p.user_id = (select users.user_id from public.users where users.auth_user_id = auth.uid())
    )
    or (select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  );


