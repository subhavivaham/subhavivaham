"use server";

// every admin mutation, on mysql. each action re-checks the admin claim itself
// rather than trusting the layout guard, because a server action is an
// independently reachable endpoint. mysql has no RLS, so assertAdmin() plus the
// explicit key filters below are the whole boundary.
//
// the shape is uniform on purpose: write, then re-read the whole list and hand
// it back. the client managers replace their state with the returned rows, so a
// partial local edit can never drift from the database.
import { revalidatePath, updateTag } from "next/cache";
import { randomUUID } from "crypto";
import { q, q1, run, tx } from "@/lib/db";
import { assertAdmin } from "@/lib/data/admin-dal";
import { EMAIL_RE, MOBILE_RE } from "@/lib/registration";
import { hashPassword } from "@/lib/auth/session";
import { deleteUpload, listUploads, parseUploadUrl, saveUpload } from "@/lib/uploads";
import {
  MAX_PAYMENT_SCREENSHOT_BYTES,
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  MAX_TEMPLE_IMAGES,
  MAX_TEMPLE_IMAGE_BYTES,
  MIN_PHOTOS,
  PAYMENT_SCREENSHOT_BUCKET,
  PAYMENT_SCREENSHOT_TYPES,
  PHOTO_BUCKET,
  PHOTO_TYPES,
  TEMPLE_COVER_PREFIX,
  TEMPLE_IMAGE_BUCKET,
  TEMPLE_IMAGE_TYPES,
  paymentScreenshotSizeError,
  photoExtension,
  photoSizeError,
  templeImageSizeError,
} from "@/lib/constants";
import {
  fetchAdminCommunities,
  fetchAdminPayments,
  fetchAdminPlans,
  fetchAdminProfiles,
  fetchAdminServices,
  fetchAdminSubscriptions,
  fetchAdminTemples,
  fetchAdminUsers,
} from "@/lib/data/admin-queries";
import { mapsUrl } from "@/lib/data/mappers";
import { syncCommunityVisibleMembers } from "@/lib/data/community-counts";
import { syncMemberEntitlement } from "@/lib/data/memberships";
import { addPeriod, hasExpired } from "@/features/membership/period";
import type { Community } from "@/features/communities/data";
import type { CommunityInput } from "@/features/communities/store";
import type { ServiceProvider } from "@/features/services/types";
import type { ServiceInput } from "@/features/services/data";
import {
  isHttpUrl,
  TEMPLE_DAYS,
  type Temple,
  type TempleInput,
} from "@/features/temples/types";
import type { ProfileInput } from "@/features/profiles/store";
import type {
  AdminRole,
  AdminUser,
  MembershipPayment,
  MembershipPlan,
  MembershipTier,
  Profile,
  ProfileStatus,
  Subscription,
  SubscriptionStatus,
  UserStatus,
} from "@/types";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return { ok: false, error: message };
}

function newId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function nowSql(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function todaySql(): string {
  return new Date().toISOString().slice(0, 10);
}

function ageFrom(dob: string): number {
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

function guard<T>(work: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  return work().catch(fail);
}

// builds "set a = ?, b = ?" from a patch object, so create and update can share
// one column list and a new field can never be saved by one path only.
function setClause(patch: Record<string, unknown>): { sql: string; values: unknown[] } {
  const keys = Object.keys(patch);
  return {
    sql: keys.map((key) => `\`${key}\` = ?`).join(", "),
    values: keys.map((key) => patch[key]),
  };
}

function insertClause(row: Record<string, unknown>): { sql: string; values: unknown[] } {
  const keys = Object.keys(row);
  return {
    sql: `(${keys.map((key) => `\`${key}\``).join(", ")}) values (${keys.map(() => "?").join(", ")})`,
    values: keys.map((key) => row[key]),
  };
}

// A plan's duration belongs to the plan, but the members already on it were
// sold a term that has to move with it. Each active subscription is re-dated
// from when it started, then the affected members' entitlements are re-derived
// so a shortened plan that has already lapsed takes effect at once.
async function reschedulePlanSubscriptions(planId: string, period: string): Promise<void> {
  const rows = await q<{ subscription_id: string; user_id: string; created_at: string }>(
    "select subscription_id, user_id, created_at from subscriptions where plan = ? and status = 'active'",
    [planId]
  );

  const affected = new Set<string>();
  for (const row of rows) {
    const start = row.created_at ? new Date(String(row.created_at)) : new Date();
    await run("update subscriptions set renews_on = ? where subscription_id = ?", [
      addPeriod(start, period),
      row.subscription_id,
    ]);
    affected.add(String(row.user_id));
  }

  for (const userId of affected) {
    await syncMemberEntitlement(userId);
  }
}

// maps a ProfileInput onto the profiles table, sharing one column list between
// create and update so the two can never disagree. json columns are stringified
// because mysql2 would otherwise send arrays through String() ("1,2,3").
function profileColumns(input: ProfileInput): Record<string, unknown> {
  return {
    full_name: input.fullName.trim(),
    gender: input.gender,
    date_of_birth: input.dateOfBirth || null,
    age: input.dateOfBirth ? ageFrom(input.dateOfBirth) : 0,
    height: input.height,
    marital_status: input.maritalStatus,
    religion: input.religion || null,
    community: input.community || null,
    caste: input.caste.trim() || null,
    mother_tongue: input.motherTongue || null,
    education: input.education || null,
    college: input.college || null,
    profession: input.profession || null,
    company: input.company || null,
    income: input.income || null,
    country: input.country || "India",
    state: input.state || null,
    district: input.district || null,
    city: input.city.trim() || null,
    about: input.about.trim() || null,
    // family
    father_occupation: input.fatherOccupation.trim() || null,
    mother_occupation: input.motherOccupation.trim() || null,
    brother_count: input.brotherCount,
    sister_count: input.sisterCount,
    family_type: input.familyType,
    family_location: input.familyLocation.trim() || null,
    family_values: input.familyValues.trim() || null,
    gotra: input.gotra.trim() || null,
    horoscope_required: input.horoscopeRequired ? 1 : 0,
    // lifestyle
    diet: input.diet,
    smoking: input.smoking,
    drinking: input.drinking,
    hobbies: JSON.stringify(
      input.hobbies
        .split(/[,\n]/)
        .map((h) => h.trim())
        .filter(Boolean)
        .slice(0, 12)
    ),
    fitness: input.fitness.trim() || null,
    sports: input.sports.trim() || null,
    music: input.music.trim() || null,
    food: input.food.trim() || null,
    appearances: input.appearances.trim() || null,
    // partner preference
    min_age: input.prefMinAge,
    max_age: input.prefMaxAge,
    min_height: input.prefMinHeight,
    max_height: input.prefMaxHeight,
    pref_religion: input.prefReligion || null,
    pref_mother_tongues: JSON.stringify(input.prefMotherTongues),
    pref_communities: JSON.stringify(input.prefCommunities),
    pref_education: JSON.stringify(input.prefEducations),
    pref_professions: JSON.stringify(input.prefProfessions),
    pref_locations: JSON.stringify(input.prefLocations),
    pref_marital_statuses: JSON.stringify(input.prefMaritalStatuses),
    pref_income: input.prefIncome || null,
    pref_diet: input.prefDiet || null,
    pref_smoking: input.prefSmoking || null,
    pref_drinking: input.prefDrinking || null,
  };
}

// any change to a profile can change what the public browse pages are allowed to
// show, so every profile mutation invalidates them.
function revalidateProfileSurfaces() {
  revalidatePath("/admin/profiles");
  revalidatePath("/brides");
  updateTag("public-data");
  revalidatePath("/grooms");
  updateTag("public-data");
  revalidatePath("/search");
  updateTag("public-data");
}

/* -- users ---------------------------------------------------------------- */

// profiles.user_id references users(user_id), so dependent rows have to be
// cleared before the account row or the delete trips the FK. sessions cascade
// from users, profile_photos and interests cascade from profiles.
export async function deleteUserAction(userId: string): Promise<ActionResult<AdminUser[]>> {
  return guard(async () => {
    await assertAdmin();
    await run("delete from profiles where user_id = ?", [userId]);
    await run("delete from subscriptions where user_id = ?", [userId]);
    await run("delete from users where user_id = ?", [userId]);

    revalidatePath("/admin/users");
    return { ok: true, data: await fetchAdminUsers() };
  });
}

export async function updateUserStatusAction(
  userId: string,
  status: UserStatus
): Promise<ActionResult<AdminUser[]>> {
  return guard(async () => {
    await assertAdmin();
    await run("update users set status = ? where user_id = ?", [status, userId]);

    revalidatePath("/admin/users");
    return { ok: true, data: await fetchAdminUsers() };
  });
}

export async function updateAllUserStatusAction(
  status: UserStatus
): Promise<ActionResult<AdminUser[]>> {
  return guard(async () => {
    await assertAdmin();
    // scoped to members so a bulk action cannot lock every admin out
    await run("update users set status = ? where role = 'member'", [status]);

    revalidatePath("/admin/users");
    return { ok: true, data: await fetchAdminUsers() };
  });
}

export async function updateUserRoleAction(
  userId: string,
  role: AdminRole
): Promise<ActionResult<AdminUser[]>> {
  return guard(async () => {
    await assertAdmin();
    await run("update users set role = ? where user_id = ?", [role, userId]);

    revalidatePath("/admin/users");
    return { ok: true, data: await fetchAdminUsers() };
  });
}

/* -- profiles ------------------------------------------------------------- */

// the same bar the register form applies: at least one photo, at most
// MAX_PHOTOS, and each one a type and size the bucket will take.
function checkPickedPhotos(files: File[]): File[] {
  const photos = files.filter((file) => file instanceof File && file.size > 0);
  if (photos.length < MIN_PHOTOS)
    throw new Error(`Attach at least ${MIN_PHOTOS} photo so members can recognise the profile.`);
  if (photos.length > MAX_PHOTOS) throw new Error(`Attach at most ${MAX_PHOTOS} photos.`);
  for (const photo of photos) {
    if (!(PHOTO_TYPES as readonly string[]).includes(photo.type))
      throw new Error(`${photo.name} — photos must be JPEG, PNG or WebP.`);
    if (photo.size > MAX_PHOTO_BYTES) throw new Error(photoSizeError(photo.size));
  }
  return photos;
}

// photos go up in order, the first one becoming the primary. returns the public
// urls it created so a caller can undo the whole group on failure.
async function attachPhotos(
  profileUuid: string,
  profileKey: string,
  photos: File[]
): Promise<string[]> {
  const uploaded: string[] = [];
  try {
    for (const [index, photo] of photos.entries()) {
      const key = `${profileKey}/${index + 1}-${randomUUID().slice(0, 8)}.${photoExtension(photo.type)}`;
      const url = await saveUpload(PHOTO_BUCKET, key, photo, photo.type);
      uploaded.push(url);
      await run(
        "insert into profile_photos (profile_id, url, is_primary, sort_order) values (?, ?, ?, ?)",
        [profileUuid, url, index === 0 ? 1 : 0, index + 1]
      );
    }
  } catch (error) {
    await removeUploadUrls(uploaded);
    throw error;
  }
  return uploaded;
}

// best-effort removal of stored public urls we just wrote
async function removeUploadUrls(urls: string[]): Promise<void> {
  for (const url of urls) {
    const parsed = parseUploadUrl(url);
    if (parsed) await deleteUpload(parsed.bucket, parsed.key);
  }
}

export async function createProfileAction(
  input: ProfileInput,
  photos: File[] = []
): Promise<ActionResult<Profile[]>> {
  return guard(async () => {
    await assertAdmin();
    const name = input.fullName.trim();
    if (!name) throw new Error("Full name is required.");
    const email = input.email.trim().toLowerCase();
    const mobile = input.mobile.replace(/[\s+-]/g, "");
    if (!email) throw new Error("Email is required.");
    if (!EMAIL_RE.test(email)) throw new Error("Enter a valid email address.");
    if (!mobile) throw new Error("Mobile number is required.");
    if (!MOBILE_RE.test(mobile)) throw new Error("Enter a valid 10-digit mobile number.");
    const taken = await q1<{ user_id: string }>(
      "select user_id from users where email = ? or phone_number = ? limit 1",
      [email, mobile]
    );
    if (taken) throw new Error("That email or mobile number is already registered.");
    if (!input.password) throw new Error("Password is required.");
    if (input.password.length < 8) throw new Error("Use at least 8 characters.");
    const picked = checkPickedPhotos(photos);

    // profiles.user_id references users(user_id), so the account row has to
    // exist before the profile row or the insert trips the FK
    const userId = newId("user");
    await run(
      "insert into users (user_id, auth_user_id, name, email, phone_number, role, status, password_hash, joined_at) " +
        "values (?, ?, ?, ?, ?, 'member', 'active', ?, ?)",
      [userId, userId, name, email, mobile, hashPassword(input.password), nowSql()]
    );

    const profileKey = newId("p");
    const profileUuid = randomUUID();
    const patch = {
      id: profileUuid,
      profile_id: profileKey,
      user_id: userId,
      // an admin typing the profile in has vouched for it, so it lands verified
      // and live. a self-registered profile is the one that waits in the queue.
      verified: 1,
      status: "active",
      online: 0,
      last_active: nowSql(),
      profile_created_on: todaySql(),
      ...profileColumns(input),
    };
    const insert = insertClause(patch);
    await run(`insert into profiles ${insert.sql}`, insert.values);

    // a failed upload undoes the create rather than leaving a photo-less
    // profile sitting in the list. deleting the profile cascades its photo rows.
    try {
      await attachPhotos(profileUuid, profileKey, picked);
    } catch (uploadFailure) {
      await run("delete from profiles where profile_id = ?", [profileKey]);
      await run("delete from users where user_id = ?", [userId]);
      throw uploadFailure;
    }

    await syncCommunityVisibleMembers([input.community]);

    revalidateProfileSurfaces();
    return { ok: true, data: await fetchAdminProfiles() };
  });
}

export async function updateProfileAction(
  profileKey: string,
  input: ProfileInput
): Promise<ActionResult<Profile[]>> {
  return guard(async () => {
    await assertAdmin();
    // the community the profile is leaving has to be recounted as well, so its
    // name is read before the update overwrites it
    const previous = await q1<{ user_id: string; community: string | null }>(
      "select user_id, community from profiles where profile_id = ?",
      [profileKey]
    );
    if (!previous) throw new Error("Profile not found.");

    // contact details live on the users row, so the edit form's email and
    // mobile are written there too — with a duplicate check that skips the
    // profile's own account
    const name = input.fullName.trim();
    if (!name) throw new Error("Full name is required.");
    const email = input.email.trim().toLowerCase();
    const mobile = input.mobile.replace(/[\s+-]/g, "");
    if (!email || !EMAIL_RE.test(email)) throw new Error("Enter a valid email address.");
    if (!mobile || !MOBILE_RE.test(mobile)) throw new Error("Enter a valid 10-digit mobile number.");
    const clash = await q1<{ user_id: string }>(
      "select user_id from users where (email = ? or phone_number = ?) and user_id <> ? limit 1",
      [email, mobile, previous.user_id]
    );
    if (clash) throw new Error("That email or mobile number is already registered.");
    // a blank password on edit means "keep the one already on the account"
    if (input.password && input.password.length < 8)
      throw new Error("Use at least 8 characters.");
    const nextPasswordHash = input.password ? hashPassword(input.password) : null;
    await run(
      nextPasswordHash
        ? "update users set name = ?, email = ?, phone_number = ?, password_hash = ? where user_id = ?"
        : "update users set name = ?, email = ?, phone_number = ? where user_id = ?",
      nextPasswordHash
        ? [name, email, mobile, nextPasswordHash, previous.user_id]
        : [name, email, mobile, previous.user_id]
    );

    const patch = profileColumns(input);
    const set = setClause(patch);
    await run(`update profiles set ${set.sql} where profile_id = ?`, [
      ...set.values,
      profileKey,
    ]);

    await syncCommunityVisibleMembers([previous?.community, input.community]);

    revalidateProfileSurfaces();
    return { ok: true, data: await fetchAdminProfiles() };
  });
}

export async function setProfileStatusAction(
  profileKey: string,
  status: ProfileStatus
): Promise<ActionResult<Profile[]>> {
  return guard(async () => {
    await assertAdmin();
    await run("update profiles set status = ? where profile_id = ?", [status, profileKey]);

    revalidateProfileSurfaces();
    return { ok: true, data: await fetchAdminProfiles() };
  });
}

export async function setProfileVerifiedAction(
  profileKey: string,
  verified: boolean
): Promise<ActionResult<Profile[]>> {
  return guard(async () => {
    await assertAdmin();
    // registration lands the profile as verified=false / status=inactive, and
    // the public pages need both before a profile is visible. approving
    // therefore does both in one step.
    if (verified) {
      await run("update profiles set verified = 1, status = 'active' where profile_id = ?", [
        profileKey,
      ]);
    } else {
      await run("update profiles set verified = 0 where profile_id = ?", [profileKey]);
    }

    revalidateProfileSurfaces();
    return { ok: true, data: await fetchAdminProfiles() };
  });
}

export async function deleteProfileAction(
  profileKey: string
): Promise<ActionResult<Profile[]>> {
  return guard(async () => {
    await assertAdmin();
    // read before the delete: afterwards there is no row left to ask which
    // community lost a member
    const existing = await q1<{ community: string | null }>(
      "select community from profiles where profile_id = ?",
      [profileKey]
    );

    // profile_photos and interests both cascade from profiles
    await run("delete from profiles where profile_id = ?", [profileKey]);

    await syncCommunityVisibleMembers([existing?.community]);

    revalidateProfileSurfaces();
    return { ok: true, data: await fetchAdminProfiles() };
  });
}

/* -- profile photos -------------------------------------------------------- */

// profile_photos.profile_id points at the profiles uuid, not the public
// profile_id, so every photo action resolves the key first.
async function photoProfile(profileKey: string): Promise<{ id: string; profileId: string }> {
  const data = await q1<{ id: string; profile_id: string }>(
    "select id, profile_id from profiles where profile_id = ?",
    [profileKey]
  );
  if (!data) throw new Error("Profile not found.");
  return { id: data.id, profileId: data.profile_id };
}

export async function addProfilePhotoAction(
  profileKey: string,
  url: string
): Promise<ActionResult<Profile[]>> {
  return guard(async () => {
    await assertAdmin();
    const trimmed = url.trim();
    if (!trimmed) throw new Error("Enter a photo URL.");

    const { id: profileUuid } = await photoProfile(profileKey);

    const existing = await q1<{ last: number | null }>(
      "select max(sort_order) as last from profile_photos where profile_id = ?",
      [profileUuid]
    );
    const next = (existing?.last ?? 0) + 1;
    await run(
      "insert into profile_photos (profile_id, url, is_primary, sort_order) values (?, ?, ?, ?)",
      [profileUuid, trimmed, next === 1 ? 1 : 0, next]
    );

    revalidateProfileSurfaces();
    return { ok: true, data: await fetchAdminProfiles() };
  });
}

// the same upload the register form does, so an admin can attach a member's
// photos without going through a member account. type, size and count rules are
// re-checked here because the browser picker is only a convenience.
export async function addProfilePhotoUploadAction(
  profileKey: string,
  files: File[]
): Promise<ActionResult<Profile[]>> {
  return guard(async () => {
    await assertAdmin();
    const photos = files.filter((file) => file instanceof File && file.size > 0);
    if (photos.length === 0) throw new Error("Choose at least one photo.");
    if (photos.length > MAX_PHOTOS) throw new Error(`Upload at most ${MAX_PHOTOS} photos at once.`);
    for (const photo of photos) {
      if (!(PHOTO_TYPES as readonly string[]).includes(photo.type))
        throw new Error(`${photo.name} — photos must be JPEG, PNG or WebP.`);
      if (photo.size > MAX_PHOTO_BYTES) throw new Error(photoSizeError(photo.size));
    }

    const { id: profileUuid, profileId } = await photoProfile(profileKey);

    const existing = await q1<{ last: number | null }>(
      "select max(sort_order) as last from profile_photos where profile_id = ?",
      [profileUuid]
    );
    let sortOrder = (existing?.last ?? 0) + 1;
    const isFirst = sortOrder === 1;

    // one upload at a time, and rolled back as a group: a half-attached gallery
    // is worse than no gallery
    const uploaded: string[] = [];
    for (const photo of photos) {
      const key = `${profileId}/${sortOrder}-${randomUUID().slice(0, 8)}.${photoExtension(photo.type)}`;
      try {
        const url = await saveUpload(PHOTO_BUCKET, key, photo, photo.type);
        uploaded.push(url);
        await run(
          "insert into profile_photos (profile_id, url, is_primary, sort_order) values (?, ?, ?, ?)",
          [profileUuid, url, isFirst ? 1 : 0, sortOrder]
        );
      } catch (error) {
        await removeUploadUrls(uploaded);
        throw error;
      }
      sortOrder += 1;
    }

    revalidateProfileSurfaces();
    return { ok: true, data: await fetchAdminProfiles() };
  });
}

export async function removeProfilePhotoAction(
  profileKey: string,
  photoId: string
): Promise<ActionResult<Profile[]>> {
  return guard(async () => {
    await assertAdmin();
    // read the url first so the stored file can be swept as well as the row
    const photo = await q1<{ url: string }>(
      "select url from profile_photos where id = ?",
      [photoId]
    );
    await run("delete from profile_photos where id = ?", [photoId]);
    if (photo) await removeUploadUrls([photo.url]);

    revalidatePath("/admin/profiles");
    return { ok: true, data: await fetchAdminProfiles() };
  });
}

// promotes the given photo to slot 1 and shifts the rest down, so "primary" and
// "first in the list" stay the same thing
export async function setPrimaryProfilePhotoAction(
  profileKey: string,
  photoId: string
): Promise<ActionResult<Profile[]>> {
  return guard(async () => {
    await assertAdmin();
    const { id: profileUuid } = await photoProfile(profileKey);

    const photos = await q<{ id: string }>(
      "select id from profile_photos where profile_id = ? order by sort_order",
      [profileUuid]
    );
    if (!photos.some((p) => p.id === photoId)) throw new Error("Photo not found.");

    const next = [photoId, ...photos.map((p) => p.id).filter((id) => id !== photoId)];
    await tx(async (db) => {
      for (const [index, id] of next.entries()) {
        await db.run("update profile_photos set sort_order = ?, is_primary = ? where id = ?", [
          index + 1,
          index === 0 ? 1 : 0,
          id,
        ]);
      }
    });

    revalidateProfileSurfaces();
    return { ok: true, data: await fetchAdminProfiles() };
  });
}

export async function moveProfilePhotoAction(
  profileKey: string,
  photoId: string,
  delta: number
): Promise<ActionResult<Profile[]>> {
  return guard(async () => {
    await assertAdmin();
    const { id: profileUuid } = await photoProfile(profileKey);

    const photos = await q<{ id: string; sort_order: number; is_primary: number }>(
      "select id, sort_order, is_primary from profile_photos where profile_id = ? order by sort_order",
      [profileUuid]
    );

    const index = photos.findIndex((p) => p.id === photoId);
    if (index < 0) throw new Error("Photo not found.");

    const swapWith = index + delta;
    if (swapWith < 0 || swapWith >= photos.length) {
      return { ok: true, data: await fetchAdminProfiles() };
    }

    const a = photos[index];
    const b = photos[swapWith];
    await tx(async (db) => {
      await db.run("update profile_photos set sort_order = ?, is_primary = ? where id = ?", [
        b.sort_order,
        b.is_primary,
        a.id,
      ]);
      await db.run("update profile_photos set sort_order = ?, is_primary = ? where id = ?", [
        a.sort_order,
        a.is_primary,
        b.id,
      ]);
    });

    revalidateProfileSurfaces();
    return { ok: true, data: await fetchAdminProfiles() };
  });
}

/* -- communities ----------------------------------------------------------- */

export async function createCommunityAction(
  input: CommunityInput
): Promise<ActionResult<Community[]>> {
  return guard(async () => {
    await assertAdmin();
    const name = input.name.trim();
    if (!name) throw new Error("Community name is required.");

    await run(
      "insert into communities (id, name, tamil_name, description, tamil_description, visible_members, active) " +
        "values (?, ?, ?, ?, ?, ?, 1)",
      [
        slug(name) || newId("c"),
        name,
        input.tamilName.trim() || name,
        input.description.trim() || null,
        input.tamilDescription.trim() || null,
        input.visibleMembers ?? 0,
      ]
    );

    revalidatePath("/admin/communities");
    revalidatePath("/communities");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminCommunities() };
  });
}

export async function updateCommunityAction(
  id: string,
  input: CommunityInput
): Promise<ActionResult<Community[]>> {
  return guard(async () => {
    await assertAdmin();
    await run(
      "update communities set name = ?, tamil_name = ?, description = ?, tamil_description = ?, visible_members = ? where id = ?",
      [
        input.name.trim(),
        input.tamilName.trim(),
        input.description.trim() || null,
        input.tamilDescription.trim() || null,
        input.visibleMembers ?? 0,
        id,
      ]
    );

    revalidatePath("/admin/communities");
    revalidatePath("/communities");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminCommunities() };
  });
}

export async function setCommunityActiveAction(
  id: string,
  active: boolean
): Promise<ActionResult<Community[]>> {
  return guard(async () => {
    await assertAdmin();
    await run("update communities set active = ? where id = ?", [active ? 1 : 0, id]);

    revalidatePath("/admin/communities");
    revalidatePath("/communities");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminCommunities() };
  });
}

export async function deleteCommunityAction(id: string): Promise<ActionResult<Community[]>> {
  return guard(async () => {
    await assertAdmin();
    await run("delete from communities where id = ?", [id]);

    revalidatePath("/admin/communities");
    revalidatePath("/communities");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminCommunities() };
  });
}

/* -- memberships ----------------------------------------------------------- */

// membership_plans.id is the tier itself, so an edit updates the existing tier
// row rather than creating a second one for the same tier
export type PlanInput = {
  id?: string;
  name: MembershipTier;
  label: string;
  price: number;
  period: string;
  popular?: boolean;
  features: { label: string; included: boolean }[];
  photoLimit: number;
  interestLimit: number | null;
};

function planPhotoValue(limit: number): string {
  return limit === 1 ? "1 photo" : `Up to ${limit} photos`;
}

function planInterestValue(limit: number | null): string {
  return limit === null ? "Unlimited" : String(limit);
}

function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

export async function upsertPlanAction(
  input: PlanInput
): Promise<ActionResult<MembershipPlan[]>> {
  return guard(async () => {
    await assertAdmin();
    const id = (input.id ?? input.name) as string;
    if (!id) throw new Error("Choose a tier.");

    // the compare table keeps its own per-tier cells. the photo and interest
    // rows mirror the plan's limits, so they are regenerated from them here
    // while every other row is carried through untouched.
    const existing = await q1<{
      compare_features: unknown;
      period: string | null;
    }>("select compare_features, period from membership_plans where id = ?", [id]);
    const compareFeatures = parseJsonColumn<{ label: string; value: boolean | string }[]>(
      existing?.compare_features,
      []
    ).map((row) => {
      if (/photo/i.test(row.label)) return { ...row, value: planPhotoValue(input.photoLimit) };
      if (/interest/i.test(row.label)) return { ...row, value: planInterestValue(input.interestLimit) };
      return row;
    });

    await run(
      "insert into membership_plans (id, label, price, period, popular, features, photo_limit, interest_limit, compare_features) " +
        "values (?, ?, ?, ?, ?, ?, ?, ?, ?) " +
        "on duplicate key update label = values(label), price = values(price), period = values(period), " +
        "popular = values(popular), features = values(features), photo_limit = values(photo_limit), " +
        "interest_limit = values(interest_limit), compare_features = values(compare_features)",
      [
        id,
        input.label.trim() || id,
        input.price,
        input.period,
        input.popular ? 1 : 0,
        JSON.stringify(input.features),
        input.photoLimit,
        input.interestLimit,
        JSON.stringify(compareFeatures),
      ]
    );

    // only a changed duration moves the members already on the plan. a save
    // that leaves the period alone must not reset an admin's manual extension.
    if (existing && existing.period !== input.period) {
      await reschedulePlanSubscriptions(id, input.period);
    }

    revalidatePath("/admin/memberships");
    revalidatePath("/membership");
    return { ok: true, data: await fetchAdminPlans() };
  });
}

export async function deletePlanAction(id: string): Promise<ActionResult<MembershipPlan[]>> {
  return guard(async () => {
    await assertAdmin();

    // subscriptions.plan references membership_plans.id, so a plan still in
    // use has to be reported rather than left to fail as a raw FK error
    const used = await q1<{ n: number }>(
      "select count(*) as n from subscriptions where plan = ?",
      [id]
    );
    if (used && used.n > 0) {
      throw new Error(`${used.n} subscription(s) still use this plan.`);
    }

    await run("delete from membership_plans where id = ?", [id]);

    revalidatePath("/admin/memberships");
    return { ok: true, data: await fetchAdminPlans() };
  });
}

export async function createSubscriptionAction(
  userId: string,
  plan: MembershipTier
): Promise<ActionResult<Subscription[]>> {
  return guard(async () => {
    await assertAdmin();

    const user = await q1<{ name: string }>("select name from users where user_id = ?", [userId]);
    if (!user) throw new Error("Member not found.");

    const planRow = await q1<{ price: number; period: string }>(
      "select price, period from membership_plans where id = ?",
      [plan]
    );
    if (!planRow) throw new Error("Membership plan not found.");

    // the term is the plan's own duration, so a 30-day Silver and a 90-day
    // Premium expire when their labels say they do
    await run(
      "insert into subscriptions (subscription_id, user_id, plan, member_name, amount, renews_on, status) " +
        "values (?, ?, ?, ?, ?, ?, 'active')",
      [newId("sub"), userId, plan, user.name, planRow.price, addPeriod(new Date(), planRow.period)]
    );

    await syncMemberEntitlement(userId);

    revalidatePath("/admin/memberships");
    revalidatePath("/admin/profiles");
    return { ok: true, data: await fetchAdminSubscriptions() };
  });
}

export async function setSubscriptionStatusAction(
  subscriptionId: string,
  status: SubscriptionStatus
): Promise<ActionResult<Subscription[]>> {
  return guard(async () => {
    await assertAdmin();

    const row = await q1<{ user_id: string; renews_on: string | null; plan: string }>(
      "select user_id, renews_on, plan from subscriptions where subscription_id = ?",
      [subscriptionId]
    );
    if (!row) throw new Error("Subscription not found.");

    // reactivating a subscription whose term has already lapsed has to open a
    // new term, otherwise the date-aware reconcile expires it again on the very
    // next read. a cancellation still inside its term keeps its original date.
    if (status === "active" && hasExpired(row.renews_on)) {
      const planRow = await q1<{ period: string }>(
        "select period from membership_plans where id = ?",
        [row.plan]
      );
      await run("update subscriptions set status = ?, renews_on = ? where subscription_id = ?", [
        status,
        addPeriod(new Date(), planRow?.period),
        subscriptionId,
      ]);
    } else {
      await run("update subscriptions set status = ? where subscription_id = ?", [
        status,
        subscriptionId,
      ]);
    }

    await syncMemberEntitlement(row.user_id);

    revalidatePath("/admin/memberships");
    revalidatePath("/admin/profiles");
    return { ok: true, data: await fetchAdminSubscriptions() };
  });
}

// moving a tier re-reads the plan price, otherwise the amount and the tier
// would disagree and the revenue figure would quietly drift. the new plan's
// duration also restarts the term.
export async function changeSubscriptionPlanAction(
  subscriptionId: string,
  plan: MembershipTier
): Promise<ActionResult<Subscription[]>> {
  return guard(async () => {
    await assertAdmin();

    const row = await q1<{ user_id: string }>(
      "select user_id from subscriptions where subscription_id = ?",
      [subscriptionId]
    );
    if (!row) throw new Error("Subscription not found.");

    const planRow = await q1<{ price: number; period: string }>(
      "select price, period from membership_plans where id = ?",
      [plan]
    );
    if (!planRow) throw new Error("Membership plan not found.");

    await run(
      "update subscriptions set plan = ?, amount = ?, renews_on = ? where subscription_id = ?",
      [plan, planRow.price, addPeriod(new Date(), planRow.period), subscriptionId]
    );

    await syncMemberEntitlement(row.user_id);

    revalidatePath("/admin/memberships");
    revalidatePath("/admin/profiles");
    return { ok: true, data: await fetchAdminSubscriptions() };
  });
}

// extends a subscription by the length of its own plan, so a renewal of a
// 30-day Silver adds 30 days and a 90-day Premium adds 90.
export async function renewSubscriptionAction(
  subscriptionId: string
): Promise<ActionResult<Subscription[]>> {
  return guard(async () => {
    await assertAdmin();

    const data = await q1<{ user_id: string; renews_on: string | null; plan: string }>(
      "select user_id, renews_on, plan from subscriptions where subscription_id = ?",
      [subscriptionId]
    );
    if (!data) throw new Error("Subscription not found.");

    const planRow = await q1<{ period: string }>(
      "select period from membership_plans where id = ?",
      [data.plan]
    );

    // extend from the existing date, or from today if it already lapsed
    const base =
      data.renews_on && !hasExpired(data.renews_on) ? new Date(data.renews_on) : new Date();

    await run(
      "update subscriptions set renews_on = ?, status = 'active' where subscription_id = ?",
      [addPeriod(base, planRow?.period), subscriptionId]
    );

    await syncMemberEntitlement(data.user_id);

    revalidatePath("/admin/memberships");
    revalidatePath("/admin/profiles");
    return { ok: true, data: await fetchAdminSubscriptions() };
  });
}

/* -- membership payments -------------------------------------------------- */

// approving a payment is what actually grants the plan: it writes the same
// active subscription an admin would create by hand, marks the request
// approved and re-derives the member's entitlement from their live subscriptions.
export async function approvePaymentAction(
  paymentId: string
): Promise<ActionResult<{ payments: MembershipPayment[]; subscriptions: Subscription[] }>> {
  return guard(async () => {
    await assertAdmin();

    const payment = await q1<{
      payment_id: string;
      user_id: string;
      plan: string;
      member_name: string;
      amount: number;
      status: string;
    }>(
      "select payment_id, user_id, plan, member_name, amount, status from membership_payments where payment_id = ?",
      [paymentId]
    );
    if (!payment) throw new Error("Payment request not found.");
    if (payment.status === "approved") throw new Error("This payment is already approved.");

    const planRow = await q1<{ price: number; period: string }>(
      "select price, period from membership_plans where id = ?",
      [payment.plan]
    );

    await run(
      "insert into subscriptions (subscription_id, user_id, plan, member_name, amount, renews_on, status) " +
        "values (?, ?, ?, ?, ?, ?, 'active')",
      [
        newId("sub"),
        payment.user_id,
        payment.plan,
        payment.member_name,
        Number(payment.amount ?? planRow?.price ?? 0),
        addPeriod(new Date(), planRow?.period),
      ]
    );

    await run(
      "update membership_payments set status = 'approved', reviewed_at = ? where payment_id = ?",
      [nowSql(), paymentId]
    );

    await syncMemberEntitlement(payment.user_id);

    revalidatePath("/admin/memberships");
    revalidatePath("/admin/profiles");
    revalidatePath("/membership");
    revalidatePath("/dashboard");
    return {
      ok: true,
      data: {
        payments: await fetchAdminPayments(),
        subscriptions: await fetchAdminSubscriptions(),
      },
    };
  });
}

// rejecting leaves the row in the queue as history. it never touches the
// subscription tables, so a member who never had the plan keeps not having it.
export async function rejectPaymentAction(
  paymentId: string,
  note: string
): Promise<ActionResult<MembershipPayment[]>> {
  return guard(async () => {
    await assertAdmin();

    await run(
      "update membership_payments set status = 'rejected', note = ?, reviewed_at = ? where payment_id = ?",
      [note.trim() || null, nowSql(), paymentId]
    );

    revalidatePath("/admin/memberships");
    return { ok: true, data: await fetchAdminPayments() };
  });
}

// lets an admin attach or replace the proof on a request, for a member who sent
// the screenshot over WhatsApp or paid at the office. it only changes the file,
// not the status, so the approve/reject decision stays a separate step.
export async function uploadPaymentScreenshotAction(
  paymentId: string,
  formData: FormData
): Promise<ActionResult<MembershipPayment[]>> {
  return guard(async () => {
    await assertAdmin();

    const file = formData.get("screenshot");
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a screenshot to upload.");
    if (!(PAYMENT_SCREENSHOT_TYPES as readonly string[]).includes(file.type)) {
      throw new Error("The screenshot must be JPEG, PNG or WebP.");
    }
    if (file.size > MAX_PAYMENT_SCREENSHOT_BYTES) throw new Error(paymentScreenshotSizeError(file.size));

    const payment = await q1<{ user_id: string; screenshot_path: string }>(
      "select user_id, screenshot_path from membership_payments where payment_id = ?",
      [paymentId]
    );
    if (!payment) throw new Error("Payment request not found.");

    const key = `${payment.user_id}/admin-${randomUUID()}.${photoExtension(file.type)}`;
    const url = await saveUpload(PAYMENT_SCREENSHOT_BUCKET, key, file, file.type);

    try {
      await run("update membership_payments set screenshot_path = ? where payment_id = ?", [
        url,
        paymentId,
      ]);
    } catch (error) {
      await deleteUpload(PAYMENT_SCREENSHOT_BUCKET, key);
      throw error;
    }

    // the replaced file, if it was one of ours
    await removeUploadUrls([payment.screenshot_path ?? ""]);

    revalidatePath("/admin/memberships");
    return { ok: true, data: await fetchAdminPayments() };
  });
}

// sets a member's tier from the admin profiles list. the tier is derived from
// an active subscription, so moving to free cancels it and moving to a paid
// tier reuses the active row (or creates one) with the plan's current price.
// the denormalised users flags the rest of the app enforces against are written
// in the same step.
export async function setUserMembershipAction(
  userId: string,
  tier: MembershipTier
): Promise<ActionResult<AdminUser[]>> {
  return guard(async () => {
    await assertAdmin();

    if (tier === "free") {
      await run(
        "update subscriptions set status = 'cancelled' where user_id = ? and status = 'active'",
        [userId]
      );
    } else {
      const planRow = await q1<{ price: number; period: string }>(
        "select price, period from membership_plans where id = ?",
        [tier]
      );
      if (!planRow) throw new Error("Membership plan not found.");

      const user = await q1<{ name: string }>("select name from users where user_id = ?", [userId]);
      if (!user) throw new Error("Member not found.");

      const existing = await q1<{ subscription_id: string }>(
        "select subscription_id from subscriptions where user_id = ? and status = 'active' limit 1",
        [userId]
      );

      if (existing) {
        // the term restarts with the new plan's duration, so a stale lapsed
        // renews_on cannot immediately cancel the tier just granted
        await run(
          "update subscriptions set plan = ?, amount = ?, renews_on = ? where subscription_id = ?",
          [tier, planRow.price, addPeriod(new Date(), planRow.period), existing.subscription_id]
        );
      } else {
        await run(
          "insert into subscriptions (subscription_id, user_id, plan, member_name, amount, renews_on, status) " +
            "values (?, ?, ?, ?, ?, ?, 'active')",
          [
            newId("sub"),
            userId,
            tier,
            user.name,
            planRow.price,
            addPeriod(new Date(), planRow.period),
          ]
        );
      }
    }

    await run("update users set is_membership_user = ?, membership_plan = ? where user_id = ?", [
      tier !== "free" ? 1 : 0,
      tier === "free" ? null : tier,
      userId,
    ]);

    revalidatePath("/admin/profiles");
    revalidatePath("/admin/memberships");
    return { ok: true, data: await fetchAdminUsers() };
  });
}

/* -- site config ------------------------------------------------------------- */

export async function updateSiteConfigAction(input: {
  bannerText: string;
  bannerEnabled: boolean;
  officeAddress: string;
}): Promise<ActionResult<{ bannerText: string; bannerEnabled: boolean; officeAddress: string }>> {
  return guard(async () => {
    await assertAdmin();
    await run(
      "insert into site_config (id, banner_text, banner_enabled, office_address) values ('main', ?, ?, ?) " +
        "on duplicate key update banner_text = values(banner_text), banner_enabled = values(banner_enabled), " +
        "office_address = values(office_address)",
      [input.bannerText.trim(), input.bannerEnabled ? 1 : 0, input.officeAddress.trim()]
    );

    revalidatePath("/");
    revalidatePath("/admin/config");
    return {
      ok: true,
      data: {
        bannerText: input.bannerText.trim(),
        bannerEnabled: input.bannerEnabled,
        officeAddress: input.officeAddress.trim(),
      },
    };
  });
}

/* -- services -------------------------------------------------------------- */

export async function createServiceAction(
  input: ServiceInput
): Promise<ActionResult<ServiceProvider[]>> {
  return guard(async () => {
    await assertAdmin();
    const name = input.name.trim();
    if (!name) throw new Error("Vendor name is required.");

    await run(
      "insert into service_providers (service_id, type, name, contact, city, address, phone, details, is_approved, active) " +
        "values (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)",
      [
        newId("svc"),
        input.type,
        name,
        input.contact.trim() || null,
        input.city.trim() || null,
        // only a mandapam carries a street address; see the public vendor form
        input.type === "mandapam" ? input.address.trim() || null : null,
        input.phone.trim() || null,
        input.details.trim() || null,
      ]
    );

    revalidatePath("/admin/services");
    return { ok: true, data: await fetchAdminServices() };
  });
}

export async function updateServiceAction(
  serviceId: string,
  input: ServiceInput
): Promise<ActionResult<ServiceProvider[]>> {
  return guard(async () => {
    await assertAdmin();
    await run(
      "update service_providers set type = ?, name = ?, contact = ?, city = ?, address = ?, phone = ?, details = ? " +
        "where service_id = ?",
      [
        input.type,
        input.name.trim(),
        input.contact.trim() || null,
        input.city.trim() || null,
        input.type === "mandapam" ? input.address.trim() || null : null,
        input.phone.trim() || null,
        input.details.trim() || null,
        serviceId,
      ]
    );

    revalidatePath("/admin/services");
    return { ok: true, data: await fetchAdminServices() };
  });
}

export async function setServiceActiveAction(
  serviceId: string,
  active: boolean
): Promise<ActionResult<ServiceProvider[]>> {
  return guard(async () => {
    await assertAdmin();
    await run("update service_providers set active = ? where service_id = ?", [
      active ? 1 : 0,
      serviceId,
    ]);

    revalidatePath("/admin/services");
    return { ok: true, data: await fetchAdminServices() };
  });
}

// the review gate for a listing that came in through /vendor-register. this is
// the only path that sets is_approved from false to true.
export async function approveServiceAction(
  serviceId: string
): Promise<ActionResult<ServiceProvider[]>> {
  return guard(async () => {
    await assertAdmin();
    // both gates open together: approving a listing left switched off would
    // set is_approved without publishing it.
    await run(
      "update service_providers set is_approved = 1, active = 1 where service_id = ?",
      [serviceId]
    );

    revalidatePath("/admin/services");
    revalidatePath("/services");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminServices() };
  });
}

// withdraws approval and takes the listing off the site in one step. keeps the
// row so the details are not lost.
export async function rejectServiceAction(
  serviceId: string
): Promise<ActionResult<ServiceProvider[]>> {
  return guard(async () => {
    await assertAdmin();
    await run(
      "update service_providers set is_approved = 0, active = 0 where service_id = ?",
      [serviceId]
    );

    revalidatePath("/admin/services");
    revalidatePath("/services");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminServices() };
  });
}

export async function deleteServiceAction(
  serviceId: string
): Promise<ActionResult<ServiceProvider[]>> {
  return guard(async () => {
    await assertAdmin();
    await run("delete from service_providers where service_id = ?", [serviceId]);

    revalidatePath("/admin/services");
    return { ok: true, data: await fetchAdminServices() };
  });
}

/* -- temples --------------------------------------------------------------- */

// The cover is either a pasted url or an uploaded file, never both, so the form
// sends a discriminator alongside the value.
export type TempleCoverMode = "url" | "upload";

export interface TempleCover {
  mode: TempleCoverMode;
  /** the pasted url. ignored when mode is "upload". */
  url: string;
  /** the chosen file. ignored when mode is "url". */
  file: File | null;
}

const EMPTY_COVER: TempleCover = { mode: "url", url: "", file: null };

// Spreads the seven day strings onto their columns, keyed off TEMPLE_DAYS so the
// column a day lands in cannot drift from the column it is read back from.
function templeTimingsRow(timings: string[]): Record<string, string | null> {
  const row: Record<string, string | null> = {};
  TEMPLE_DAYS.forEach((day, index) => {
    row[`${day.toLowerCase()}_timings`] = timings[index]?.trim() || null;
  });
  return row;
}

// one builder for both create and update, and the server half of the form
// validation. every rule here has a twin in the admin form's validate(); the
// client copy exists to put a message next to the field, this one is the gate.
function templeRow(input: TempleInput, cover: TempleCover) {
  const name = input.name.trim();
  if (!name) throw new Error("Temple name is required.");
  if (name.length > 120) throw new Error("Keep the temple name under 120 characters.");

  if (!input.address.trim()) throw new Error("Address is required.");
  if (!input.city.trim()) throw new Error("City is required.");
  if (!input.district.trim()) throw new Error("District is required.");
  if (!input.nameTa.trim()) throw new Error("Name in Tamil is required.");
  if (!input.contactPerson.trim()) throw new Error("Contact person is required.");

  const phone = input.contact.trim();
  if (!phone) throw new Error("Phone number is required.");
  if (!/^[0-9+()\s.-]{7,20}$/.test(phone)) throw new Error("That does not look like a phone number.");

  if (!input.mapsUrl.trim()) throw new Error("Google Maps link is required.");
  if (!mapsUrl(input.mapsUrl.trim())) throw new Error("That is not a Google Maps link.");

  const history = input.history.trim();
  if (!history) throw new Error("History is required.");
  if (history.length < 40)
    throw new Error("Write at least a sentence or two about this temple.");

  const whatsapp = input.whatsapp.trim();
  if (whatsapp && !/^[0-9+()\s.-]{7,20}$/.test(whatsapp))
    throw new Error("That does not look like a WhatsApp number.");

  const email = input.email.trim();
  if (email && !email.includes("@")) throw new Error("That email address does not look valid.");

  if (input.website.trim() && !isHttpUrl(input.website.trim()))
    throw new Error("Website must start with http:// or https://");

  return {
    name,
    name_ta: input.nameTa.trim() || null,
    deity: input.deity.trim() || null,
    // an upload is written by storeTempleCover after the row exists, so the row
    // builder always sends null for it and the url is the only path here
    cover_image: cover.mode === "url" ? cover.url.trim() || null : null,
    address: input.address.trim() || null,
    city: input.city.trim() || null,
    district: input.district.trim() || null,
    state: input.state.trim() || null,
    country: input.country.trim() || "India",
    maps_url: mapsUrl(input.mapsUrl.trim()),
    history: input.history.trim() || null,
    ...templeTimingsRow(input.timings),
    contact: input.contact.trim() || null,
    whatsapp: input.whatsapp.trim() || null,
    email: email || null,
    contact_person: input.contactPerson.trim() || null,
    website: input.website.trim() || null,
  };
}

function checkCoverFile(cover: TempleCover) {
  if (cover.mode !== "upload" || !cover.file) return;
  const file = cover.file;
  if (!(TEMPLE_IMAGE_TYPES as readonly string[]).includes(file.type))
    throw new Error(`${file.name} — images must be JPEG, PNG or WebP.`);
  if (file.size > MAX_TEMPLE_IMAGE_BYTES) throw new Error(templeImageSizeError(file.size));
}

// The five-image budget is shared: a cover occupies one of the five, so a temple
// with an uploaded cover has four gallery slots left, not five. The cover is a
// url on the temples row rather than a temple_images row, so it is counted from
// there. A cover typed as a url by hand also counts.
async function templeImageSlots(templeId: string) {
  const [images, temple] = await Promise.all([
    q1<{ n: number }>("select count(*) as n from temple_images where temple_id = ?", [templeId]),
    q1<{ cover_image: string | null }>("select cover_image from temples where temple_id = ?", [
      templeId,
    ]),
  ]);

  const used = (images?.n ?? 0) + (temple?.cover_image ? 1 : 0);
  return { used, left: Math.max(0, MAX_TEMPLE_IMAGES - used) };
}

// Writes an uploaded cover into the temple's own folder under a cover- prefix,
// then points temples.cover_image at it. Both halves or neither.
async function storeTempleCover(
  templeId: string,
  cover: TempleCover,
  previous: string | null
) {
  if (cover.mode !== "upload" || !cover.file) return;

  const { left } = await templeImageSlots(templeId);
  // replacing a cover reuses its own slot, so the budget only bites when the
  // temple had none
  if (!previous && left === 0) {
    throw new Error(
      `All ${MAX_TEMPLE_IMAGES} image slots are used by the gallery. Remove one before adding a cover image.`
    );
  }

  const key = `${templeId}/${TEMPLE_COVER_PREFIX}${randomUUID()}.${photoExtension(cover.file.type)}`;
  let url: string;
  try {
    url = await saveUpload(TEMPLE_IMAGE_BUCKET, key, cover.file, cover.file.type);
  } catch (error) {
    throw new Error(`Could not upload ${cover.file.name}: ${error instanceof Error ? error.message : "failed"}`);
  }

  try {
    await run("update temples set cover_image = ? where temple_id = ?", [url, templeId]);
  } catch (error) {
    await deleteUpload(TEMPLE_IMAGE_BUCKET, key);
    throw new Error(`Could not save the cover image: ${error instanceof Error ? error.message : "failed"}`);
  }

  // only now that the row points elsewhere is the old file unreferenced. a url
  // the operator pasted belongs to them, so this only ever removes our own
  if (previous) await removeTempleImageObjects([previous]);
}

// the cover a saved temple currently has, so a replacement knows what to unlink
async function currentTempleCover(templeId: string) {
  const data = await q1<{ cover_image: string | null }>(
    "select cover_image from temples where temple_id = ?",
    [templeId]
  );
  return data?.cover_image ?? null;
}

export async function createTempleAction(
  input: TempleInput,
  cover: TempleCover = EMPTY_COVER
): Promise<ActionResult<Temple[]>> {
  return guard(async () => {
    await assertAdmin();
    checkCoverFile(cover);

    const templeId = newId("tmpl");
    const row = { temple_id: templeId, ...templeRow(input, cover), is_approved: 1, active: 1 };
    const insert = insertClause(row);
    await run(`insert into temples ${insert.sql}`, insert.values);

    // after the insert, because the upload path is the temple's own folder.
    // on failure the row goes back out: a temple that exists without the cover
    // the operator just chose is worse than one that was never created.
    try {
      await storeTempleCover(templeId, cover, null);
    } catch (coverError) {
      await run("delete from temples where temple_id = ?", [templeId]);
      await removeTempleImageObjects();
      throw coverError;
    }

    revalidatePath("/admin/temples");
    revalidatePath("/temples");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminTemples() };
  });
}

export async function updateTempleAction(
  templeId: string,
  input: TempleInput,
  cover: TempleCover = EMPTY_COVER
): Promise<ActionResult<Temple[]>> {
  return guard(async () => {
    await assertAdmin();
    checkCoverFile(cover);

    // read before the write: the update below nulls cover_image for an upload,
    // so afterwards there is no way to tell what the replaced file was called
    const previous = await currentTempleCover(templeId);

    const patch = templeRow(input, cover);
    const set = setClause(patch);
    await run(`update temples set ${set.sql} where temple_id = ?`, [...set.values, templeId]);

    // a pasted url replaces the previous cover too, but storeTempleCover
    // returns early in url mode, so it is unlinked here. only when the value
    // actually changed — unlinking an unchanged url would delete the file the
    // row still points at.
    if (cover.mode === "url" && previous && previous !== cover.url.trim()) {
      await removeTempleImageObjects([previous]);
    }
    await storeTempleCover(templeId, cover, previous);

    revalidatePath("/admin/temples");
    revalidatePath("/temples");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminTemples() };
  });
}

export async function setTempleActiveAction(
  templeId: string,
  active: boolean
): Promise<ActionResult<Temple[]>> {
  return guard(async () => {
    await assertAdmin();
    await run("update temples set active = ? where temple_id = ?", [active ? 1 : 0, templeId]);

    revalidatePath("/admin/temples");
    revalidatePath("/temples");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminTemples() };
  });
}

export async function approveTempleAction(
  templeId: string
): Promise<ActionResult<Temple[]>> {
  return guard(async () => {
    await assertAdmin();
    await run("update temples set is_approved = 1, active = 1 where temple_id = ?", [templeId]);

    revalidatePath("/admin/temples");
    revalidatePath("/temples");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminTemples() };
  });
}

export async function rejectTempleAction(
  templeId: string
): Promise<ActionResult<Temple[]>> {
  return guard(async () => {
    await assertAdmin();
    await run("update temples set is_approved = 0, active = 0 where temple_id = ?", [templeId]);

    revalidatePath("/admin/temples");
    revalidatePath("/temples");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminTemples() };
  });
}

export async function deleteTempleAction(
  templeId: string
): Promise<ActionResult<Temple[]>> {
  return guard(async () => {
    await assertAdmin();

    // temple_images / temple_services / temple_festivals rows cascade from the
    // delete above, but stored files do not — there is no foreign key to the
    // filesystem. sweep the temple's folder so nothing is left orphaned.
    await run("delete from temples where temple_id = ?", [templeId]);
    await removeTempleImageObjects();

    revalidatePath("/admin/temples");
    revalidatePath("/temples");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminTemples() };
  });
}

// best-effort, same reasoning as the member photo delete: the row is what the
// app reads, so a failed file delete leaves an orphaned file rather than a
// gallery with a broken frame in it.
//
// given urls, it removes exactly those that are ours. given none, it sweeps the
// whole temple folder — which is only correct when the caller just deleted
// every row for the temple.
async function removeTempleImageObjects(urls?: string[]) {
  if (urls && urls.length > 0) {
    for (const url of urls) {
      const parsed = parseUploadUrl(url);
      if (parsed) await deleteUpload(parsed.bucket, parsed.key);
    }
    return;
  }

  const keys = await listUploads(TEMPLE_IMAGE_BUCKET);
  for (const key of keys) {
    await deleteUpload(TEMPLE_IMAGE_BUCKET, key);
  }
}

export async function addTempleImagesAction(
  templeId: string,
  files: File[]
): Promise<ActionResult<Temple[]>> {
  return guard(async () => {
    await assertAdmin();

    if (files.length === 0) throw new Error("Choose at least one image to upload.");

    const { left } = await templeImageSlots(templeId);
    // the schema trigger enforces this too, but it fails as a raw SQL error
    // with no useful text, so the friendly check happens first
    if (files.length > left) {
      throw new Error(
        left > 0
          ? `${files.length > left ? `Only ${left} slot${left === 1 ? "" : "s"} left` : "No slots left"} — a temple can have ${MAX_TEMPLE_IMAGES} images including the cover.`
          : `A temple can have ${MAX_TEMPLE_IMAGES} images including the cover. Remove one before adding another.`
      );
    }
    for (const file of files) {
      if (!(TEMPLE_IMAGE_TYPES as readonly string[]).includes(file.type))
        throw new Error(`${file.name} — images must be JPEG, PNG or WebP.`);
      if (file.size > MAX_TEMPLE_IMAGE_BYTES) throw new Error(templeImageSizeError(file.size));
    }

    // sort_order continues from the gallery rows already present. the cover is
    // not one of them, so it does not consume a number here.
    const last = await q1<{ last: number | null }>(
      "select max(sort_order) as last from temple_images where temple_id = ?",
      [templeId]
    );
    const from = Number(last?.last ?? 0);

    const uploaded: string[] = [];
    const inserted: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        const key = `${templeId}/${randomUUID()}.${photoExtension(file.type)}`;
        const url = await saveUpload(TEMPLE_IMAGE_BUCKET, key, file, file.type);
        uploaded.push(url);

        const id = randomUUID();
        await run(
          "insert into temple_images (id, temple_id, url, alt, sort_order) values (?, ?, ?, '', ?)",
          [id, templeId, url, from + index + 1]
        );
        inserted.push(id);
      }
    } catch (error) {
      // both halves have to go: rows pointing at files that 404 are a worse
      // gallery than none, and files nothing references still count against
      // the five-image cap.
      if (inserted.length > 0) {
        await run(`delete from temple_images where id in (${inserted.map(() => "?").join(", ")})`, inserted);
      }
      for (const url of uploaded) {
        const parsed = parseUploadUrl(url);
        if (parsed) await deleteUpload(parsed.bucket, parsed.key);
      }
      throw error;
    }

    revalidatePath("/admin/temples");
    revalidatePath("/temples");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminTemples() };
  });
}

export async function deleteTempleImageAction(
  templeId: string,
  imageId: string
): Promise<ActionResult<Temple[]>> {
  return guard(async () => {
    await assertAdmin();

    // scoped to both temple and id so a crafted request cannot delete an image
    // belonging to a different temple
    const image = await q1<{ url: string }>(
      "select url from temple_images where id = ? and temple_id = ?",
      [imageId, templeId]
    );
    if (!image) throw new Error("That image is no longer in the gallery.");

    await run("delete from temple_images where id = ? and temple_id = ?", [imageId, templeId]);

    // the url is read before the delete, because once the row is gone there is
    // nothing left to derive the file path from. it must be this one file.
    await removeTempleImageObjects([image.url]);

    revalidatePath("/admin/temples");
    revalidatePath("/temples");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminTemples() };
  });
}

// -- festivals ---------------------------------------------------------------
// one row per upcoming festival. the whole list is saved in one pass rather
// than one action per row: a list where each add or delete is its own request
// means a dropped connection leaves half the list saved.
export async function saveTempleFestivalsAction(
  templeId: string,
  festivals: { name: string; happensOn: string }[]
): Promise<ActionResult<Temple[]>> {
  return guard(async () => {
    await assertAdmin();

    // every row needs a name, and the date is optional but must look like a
    // date if it is there. validated before anything is written.
    const cleaned = festivals.map((festival, index) => {
      const name = festival.name.trim();
      if (!name) throw new Error(`Festival ${index + 1} needs a name.`);
      const happensOn = festival.happensOn.trim();
      if (happensOn && !/^\d{4}-\d{2}-\d{2}$/.test(happensOn))
        throw new Error(`${name} — pick the date from the calendar.`);
      return { name, happensOn: happensOn || null };
    });

    const names = cleaned.map((f) => f.name.toLowerCase());
    if (new Set(names).size !== names.length)
      throw new Error("Two festivals have the same name.");

    // delete-then-insert, scoped by temple_id. a rename needs no separate
    // update, and a row the admin removed has nothing left pointing at it.
    await tx(async (db) => {
      await db.run("delete from temple_festivals where temple_id = ?", [templeId]);
      for (const [index, festival] of cleaned.entries()) {
        await db.run(
          "insert into temple_festivals (temple_id, name, happens_on, sort_order) values (?, ?, ?, ?)",
          // numbered in the order the admin typed them, so the form and the
          // public list agree before the date sort is applied
          [templeId, festival.name, festival.happensOn, index + 1]
        );
      }
    });

    revalidatePath("/admin/temples");
    revalidatePath("/temples");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminTemples() };
  });
}

// -- services -----------------------------------------------------------------
// one row per package or offering, saved in one pass for the same reason the
// festivals are. this one is a diff rather than delete-then-insert, because a
// replace would silently reset every column this form does not edit — terms,
// is_available, is_featured, image. rows are matched on name, the only handle
// the flat form carries.
export async function saveTempleServicesAction(
  templeId: string,
  services: { name: string; details: string; price: string }[]
): Promise<ActionResult<Temple[]>> {
  return guard(async () => {
    await assertAdmin();

    // whole rupees, because the column is an integer. 0 is a real value, not a
    // missing one: it is what renders as "On request".
    const cleaned = services.map((service, index) => {
      const name = service.name.trim();
      if (!name) throw new Error(`Service ${index + 1} needs a name.`);
      const price = service.price.trim();
      if (price && !/^\d+$/.test(price))
        throw new Error(`${name} — price must be a whole number of rupees.`);
      return { name, details: service.details.trim(), price: price ? Number(price) : 0 };
    });

    const wanted = cleaned.map((service) => service.name.toLowerCase());
    if (new Set(wanted).size !== wanted.length)
      throw new Error("Two services have the same name.");

    const existing = await q<{ id: string; name: string }>(
      "select id, name from temple_services where temple_id = ?",
      [templeId]
    );

    // a row the form no longer lists is one the admin deleted, so it goes now
    for (const row of existing) {
      if (wanted.includes(String(row.name).trim().toLowerCase())) continue;
      await run("delete from temple_services where id = ? and temple_id = ?", [row.id, templeId]);
    }

    for (const [index, service] of cleaned.entries()) {
      const match = existing.find(
        (row) => String(row.name).trim().toLowerCase() === service.name.toLowerCase()
      );
      if (match) {
        // temple_id in the filter as well as the id, so a tampered payload
        // cannot write to another temple's package
        await run(
          "update temple_services set details = ?, price = ?, sort_order = ? where id = ? and temple_id = ?",
          [service.details || null, service.price, index + 1, match.id, templeId]
        );
      } else {
        await run(
          "insert into temple_services (temple_id, name, details, price, sort_order) values (?, ?, ?, ?, ?)",
          [templeId, service.name, service.details || null, service.price, index + 1]
        );
      }
    }

    revalidatePath("/admin/temples");
    revalidatePath("/temples");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminTemples() };
  });
}

export async function reorderTempleImagesAction(
  templeId: string,
  orderedIds: string[]
): Promise<ActionResult<Temple[]>> {
  return guard(async () => {
    await assertAdmin();

    const owned = await q<{ id: string }>(
      "select id from temple_images where temple_id = ?",
      [templeId]
    );

    // only renumber the ids this temple actually owns, so a tampered payload
    // cannot reorder or renumber another temple's gallery
    const mine = new Set(owned.map((row) => row.id));
    const wanted = orderedIds.filter((id) => mine.has(id));

    await tx(async (db) => {
      await db.run("update temple_images set sort_order = 0 where temple_id = ?", [templeId]);
      for (const [index, id] of wanted.entries()) {
        await db.run(
          "update temple_images set sort_order = ? where id = ? and temple_id = ?",
          [index + 1, id, templeId]
        );
      }
    });

    revalidatePath("/admin/temples");
    revalidatePath("/temples");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminTemples() };
  });
}
