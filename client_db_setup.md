# Client DB setup — complete checklist

One-time, per Supabase project. Follow top to bottom; the order matters in three
places and each is called out. Everything under **SQL editor** is pasted and run.
Everything under **Dashboard** cannot be done in SQL.

---

## 1. Env file

Copy `.env.example` to `.env.local` and fill it in from Dashboard → Project
Settings → API.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
JATHAGAM_API_URL=
```

- Do **not** set `NEXT_PUBLIC_DATA_MODE`. It no longer exists. `src/lib/data/mode.ts`
  is Supabase-only and ignores it; the variable was the reason a project with no
  key silently served empty pages instead of erroring.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is optional. Set it only if your project issues
  the older `anon` key instead of a `sb_publishable_` one.
- `JATHAGAM_API_URL` may stay empty. The app then ships a disabled calculator with
  an explanatory message rather than failing.
- Anything starting with `NEXT_PUBLIC_` is baked into the browser bundle. Restart
  the dev server after changing it, or the old value keeps being served.

---

## 2. SQL editor — run in this order

### 2.1 `table_creation.md`

Creates everything the app reads:

| | |
|---|---|
| Tables | `users`, `communities`, `profiles`, `profile_photos`, `interests`, `membership_plans`, `subscriptions`, `success_stories`, `service_providers` |
| Constraints | `idx_users_email` unique on `lower(email)`, `idx_users_phone` unique on `phone_number` |
| Storage | bucket `profile-photos`, public, 1 MB, jpeg/png/webp only |
| Functions | `registration_email_taken`, `registration_phone_taken`, `owns_profile_folder` (all `security definer`) |
| Storage policies | the upload policies `/register` depends on |

Note the vendor table is **`service_providers`**, not `services`.

### 2.2 `table_policies.sql`

Row level security for every table. On `public.users` this creates `users_read`,
`users_insert_self`, `users_update`, `users_admin_write`.

`users_insert_self` is the one that makes registration work at all. Without it the
first insert of `/register` fails with `42501`, and because `profiles_insert` keys
on the `users` row, the profile and the photo uploads fail behind it.

It must run after 2.1 — the file creates indexes and policies on tables that do not
exist until then.

### 2.3 privilege-pin trigger (inside `table_creation.md`)

`trg_pin_user_privileges` stops a member writing their own `role`,
`is_membership_user` or `membership_plan` on `public.users`. RLS can check that a
row is yours but cannot compare old against new, so that check has to live in a
trigger. Admin requests carry the `admin` app-metadata claim, the server's
service-role key carries `role: service_role`, and both pass straight through,
so `/admin/users` role edits still work. The SQL editor
(no JWT) passes through too, so seeds still apply.

It lives in `table_creation.md` right after the `users` table rather than in a
separate file, so step 2.1 alone installs it. The function body is
single-quoted: when the SQL editor dropped `$$` bodies from an earlier version
of the policies file, every statement failed at once.

### 2.4 `seed_data.sql`

Demo content: communities, profiles with photos, users and
success stories. Run after 2.1. Running it from the SQL editor bypasses RLS, so its
position relative to 2.2 and 2.3 does not matter.

Safe to re-run — every insert is `on conflict do update`.

---

## 3. Dashboard — the parts SQL cannot do

### 3.1 Turn off email confirmation

Authentication → Sign In / Providers → Email → **Confirm email: OFF**.

This is the setting most likely to be missed. `authenticate()` in
`src/app/(public)/register/actions.ts:145` needs `signUp` to hand back a session in
the same call. With confirmation on it does not, registration throws *"this site
still requires email confirmation"*, and it leaves an orphan auth user behind — so
the member's retry then dead-ends on *"not confirmed"*.

### 3.2 Reload the schema cache

Project Settings → API → **Reload schema**. Press it once after 2.4.

PostgREST caches the table list. Until the cache is reloaded every read fails with:

```
{"code":"PGRST205","message":"Could not find the table 'public.profiles' in the schema cache"}
```

The tables are really there — the app is talking to a stale cache. A rebuild does
not fix it; only this button does.

### 3.3 Admin login

Full steps in `admin_creation_steps.txt`. In short: create the auth user with Auto
Confirm ticked, set **Raw App Meta Data** (not User Meta Data) to `{"role":"admin"}`,
then link it:

```sql
update public.users u
set auth_user_id = a.id, updated_at = now()
from auth.users a
where a.email = 'admintest@subhavivaham.com'
  and u.user_id = 'user-admin'
returning u.user_id, u.email, u.auth_user_id;
```

The claim is what authorises admin access — `public.users.role` is not read for
that. Skipping the claim step lets you sign in and then bounce straight back to the
login page.

### 3.4 Demo member logins

Full steps in `src/app/(public)/services/testlogin.md`. Two members, both with Auto
Confirm ticked:

| Role | Email | Password |
| --- | --- | --- |
| Groom | `demo@subhavivaham.com` | `Demo@123` |
| Bride | `ananya@subhavivaham.com` | `Demo@123` |

Then link them, which is also what makes the seeded profiles sign-in-capable:

```sql
update public.users u
set auth_user_id = a.id, updated_at = now()
from auth.users a
where u.email = a.email
  and u.role = 'member'
returning u.user_id, u.email, u.auth_user_id;
```

---

## 4. Verify

Run `db_diagnostic.sql`. It reports functions, policies, RLS per table, row counts,
storage policies and the bucket.

Then the two checks for the newer objects:

```sql
-- expect users_read, users_insert_self, users_update, users_admin_write
select policyname, cmd, roles::text, with_check
from pg_policies
where schemaname = 'public' and tablename = 'users'
order by policyname;

-- expect trg_pin_user_privileges, enabled
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.users'::regclass
  and not tgisinternal;

-- expect auth_linked true for both
select u.user_id,
       u.email,
       u.auth_user_id is not null               as auth_linked,
       a.email_confirmed_at is not null         as auth_confirmed,
       p.profile_id,
       p.verified
from public.users u
left join auth.users a on a.id = u.auth_user_id
left join public.profiles p on p.user_id = u.user_id
where u.role = 'member'
  and u.email in ('demo@subhavivaham.com', 'ananya@subhavivaham.com');
```

Then in the browser:

- `/brides` and `/grooms` list the seeded profiles. `verified = true` is what makes
  a profile public; a fresh registration is `verified = false` until an admin
  approves it, so it will not appear there and that is correct.
- `/login` with either demo account lands on `/dashboard`.
- `/register` completes and can sign in immediately with the email just chosen.
  **The mobile number is not a login credential** — it is stored and unique-checked,
  but Supabase Auth never receives it, so sign-in is email and password only.

---

## 5. If something looks broken

| Symptom | Cause | Fix |
| --- | --- | --- |
| `PGRST205`, table "not in schema cache" | stale PostgREST cache | Dashboard → API → Reload schema |
| Empty lists everywhere, no error | key missing or wrong project | check `NEXT_PUBLIC_SUPABASE_URL` matches the project, restart dev server |
| Mock/demo data instead of the database | `NEXT_PUBLIC_DATA_MODE` still set | delete it, restart |
| Registration fails *"requires email confirmation"* | confirm email still on | 3.1 |
| Registration fails on saving the account | `users_insert_self` missing | re-run 2.2 |
| Cannot log in, *"Email not confirmed"* | Auto Confirm skipped | recreate the auth user with it ticked |
| Signs in, bounces back to `/login` | auth user not linked to `public.users` | re-run the link `UPDATE` |
| Admin signs in, bounces back to `/admin/login` | `app_metadata.role` claim missing | 3.3, then clear cookies and sign in again — the old token still carries no claim |
| Photo upload fails on row-level security | storage policies missing | re-run 2.1 |
| Data correct at build, empty in production | `NEXT_PUBLIC_*` set after the build | rebuild |
| Vendor pages empty | querying `services` | the table is `service_providers` |

---

## 6. Teardown

`table_deletion_query.md` drops the schema. It deletes data — read it before
running it, and keep a backup if the project holds real members.
