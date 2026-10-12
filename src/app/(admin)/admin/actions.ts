"use server";

// every admin mutation. each action re-checks the admin claim itself rather
// than trusting the layout guard, because a server action is an independently
// reachable endpoint.
//
// the shape is uniform on purpose: write to postgres, then re-read the whole
// list and hand it back. the client managers replace their state with the
// returned rows, so a partial local edit can never drift from the database.
import { revalidatePath, updateTag } from "next/cache";
import { assertAdmin } from "@/lib/data/admin-dal";
import { getSupabaseServer } from "@/lib/supabase/server";
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
import type { SupabaseClient } from "@supabase/supabase-js";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return { ok: false, error: message };
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
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

function run<T>(work: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  return work().catch(fail);
}

// A plan's duration belongs to the plan, but the members already on it were
// sold a term that has to move with it. Each active subscription is re-dated
// from when it started, then the affected members' entitlements are re-derived
// so a shortened plan that has already lapsed takes effect at once.
async function reschedulePlanSubscriptions(
  supabase: SupabaseClient,
  planId: string,
  period: string
): Promise<void> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("subscription_id, user_id, created_at")
    .eq("plan", planId)
    .eq("status", "active");
  if (error) throw new Error(error.message);

  const affected = new Set<string>();
  for (const row of data ?? []) {
    const start = row.created_at ? new Date(String(row.created_at)) : new Date();
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        renews_on: addPeriod(start, period),
        updated_at: new Date().toISOString(),
      })
      .eq("subscription_id", row.subscription_id);
    if (updateError) throw new Error(updateError.message);
    affected.add(String(row.user_id));
  }

  for (const userId of affected) {
    await syncMemberEntitlement(supabase, userId);
  }
}

// maps a ProfileInput onto the profiles table, sharing one column list between
// create and update so the two can never disagree. the column set mirrors
// app/(public)/register/actions.ts: family, lifestyle and partner preference
// are stored flat on the row, and an admin-created profile has to carry the
// same ones a self-registered one does.
function profileColumns(input: ProfileInput) {
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
    updated_at: new Date().toISOString(),
    // family
    father_occupation: input.fatherOccupation.trim() || null,
    mother_occupation: input.motherOccupation.trim() || null,
    brother_count: input.brotherCount,
    sister_count: input.sisterCount,
    family_type: input.familyType,
    family_location: input.familyLocation.trim() || null,
    family_values: input.familyValues.trim() || null,
    gotra: input.gotra.trim() || null,
    horoscope_required: input.horoscopeRequired,
    // lifestyle
    diet: input.diet,
    smoking: input.smoking,
    drinking: input.drinking,
    hobbies: input.hobbies,
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
    pref_mother_tongues: input.prefMotherTongues,
    pref_communities: input.prefCommunities,
    pref_education: input.prefEducations,
    pref_professions: input.prefProfessions,
    pref_locations: input.prefLocations,
    pref_marital_statuses: input.prefMaritalStatuses,
    pref_income: input.prefIncome || null,
    pref_diet: input.prefDiet || null,
    pref_smoking: input.prefSmoking || null,
    pref_drinking: input.prefDrinking || null,
  };
}

// any change to a profile can change what the public browse pages are allowed to
// show, so every profile mutation invalidates them. without this the next
// visitor is served the pre-approval page from the router cache.
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

// public.users.auth_user_id cascades from auth.users, but the reverse is not
// true: profiles.user_id is NO ACTION, so dependent rows have to be cleared
// before the account row or the delete trips the FK
export async function deleteUserAction(userId: string): Promise<ActionResult<AdminUser[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();

    // cascades to profile_photos and interests
    const { error: profileError } = await supabase
      .from("profiles")
      .delete()
      .eq("user_id", userId);
    if (profileError) throw new Error(profileError.message);

    const { error: subError } = await supabase
      .from("subscriptions")
      .delete()
      .eq("user_id", userId);
    if (subError) throw new Error(subError.message);

    const { error } = await supabase.from("users").delete().eq("user_id", userId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/users");
    return { ok: true, data: await fetchAdminUsers() };
  });
}

export async function updateUserStatusAction(
  userId: string,
  status: UserStatus
): Promise<ActionResult<AdminUser[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const { error } = await supabase.from("users").update({ status }).eq("user_id", userId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/users");
    return { ok: true, data: await fetchAdminUsers() };
  });
}

export async function updateAllUserStatusAction(
  status: UserStatus
): Promise<ActionResult<AdminUser[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    // scoped to members so a bulk action cannot lock every admin out
    const { error } = await supabase.from("users").update({ status }).eq("role", "member");
    if (error) throw new Error(error.message);

    revalidatePath("/admin/users");
    return { ok: true, data: await fetchAdminUsers() };
  });
}

// changes the public.users role. the Supabase app_metadata claim is managed in
// the auth dashboard and is deliberately not touched here: a stale claim would
// still grant access, so promoting someone is a two-step operation.
export async function updateUserRoleAction(
  userId: string,
  role: AdminRole
): Promise<ActionResult<AdminUser[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const { error } = await supabase.from("users").update({ role }).eq("user_id", userId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/users");
    return { ok: true, data: await fetchAdminUsers() };
  });
}

/* -- profiles ------------------------------------------------------------- */

// the same bar the register form applies, so a profile an admin types in is no
// thinner than one a member submitted themselves: at least one photo, at most
// MAX_PHOTOS, and each one a type and size the storage bucket will take. the
// picker in the browser is only a courtesy - a server action is an independently
// reachable endpoint, so the rules are re-checked here.
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

// photos go up in order, the first one becoming the primary, matching the
// is_primary / sort_order convention the photo actions below write. returns the
// storage paths it created so a caller can undo the whole group on failure - a
// half-attached gallery is worse than none.
async function attachPhotos(
  supabase: Awaited<ReturnType<typeof getSupabaseServer>>,
  profileUuid: string,
  profileKey: string,
  photos: File[]
): Promise<string[]> {
  const uploaded: string[] = [];
  try {
    for (const [index, photo] of photos.entries()) {
      const path = `${profileKey}/${index + 1}-${crypto.randomUUID().slice(0, 8)}.${photoExtension(photo.type)}`;

      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, photo, { contentType: photo.type, upsert: false });
      if (uploadError) throw new Error(`Could not upload ${photo.name}: ${uploadError.message}`);
      uploaded.push(path);

      const { data: publicUrl } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
      const { error: photoError } = await supabase.from("profile_photos").insert({
        profile_id: profileUuid,
        url: publicUrl.publicUrl,
        is_primary: index === 0,
        sort_order: index + 1,
      });
      if (photoError) throw new Error(`Could not save ${photo.name}: ${photoError.message}`);
    }
  } catch (error) {
    // the storage objects are this helper's to tidy; the rows and the profile
    // itself are the caller's, since only it knows whether to roll back or retry
    await supabase.storage.from(PHOTO_BUCKET).remove(uploaded);
    throw error;
  }
  return uploaded;
}

export async function createProfileAction(
  input: ProfileInput,
  photos: File[] = []
): Promise<ActionResult<Profile[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const name = input.fullName.trim();
    if (!name) throw new Error("Full name is required.");
    const picked = checkPickedPhotos(photos);

    // profiles.user_id references users(user_id), so the account row has to
    // exist before the profile row or the insert trips the FK
    const userId = newId("user");
    const { error: userError } = await supabase.from("users").insert({
      user_id: userId,
      name,
      email: `${userId}@placeholder.invalid`,
      role: "member",
      status: "active",
      joined_at: new Date().toISOString(),
    });
    if (userError) throw new Error(userError.message);

    const profileKey = newId("p");
    const { data: created, error } = await supabase
      .from("profiles")
      .insert({
        ...profileColumns(input),
        profile_id: profileKey,
        user_id: userId,
        // an admin typing the profile in has vouched for it, so it lands verified
        // and live. a self-registered profile is the one that waits in the queue.
        verified: true,
        status: "active",
        online: false,
        last_active: new Date().toISOString(),
        profile_created_on: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Profile not found.");

    // the profile and its gallery are one step as far as the admin is concerned,
    // so a failed upload undoes the create rather than leaving a photo-less
    // profile sitting in the list. deleting the profile cascades its photo rows.
    try {
      await attachPhotos(supabase, created.id as unknown as string, profileKey, picked);
    } catch (uploadFailure) {
      await supabase.from("profiles").delete().eq("profile_id", profileKey);
      await supabase.from("users").delete().eq("user_id", userId);
      throw uploadFailure;
    }

    // the new profile is one more member of its community, so the stored count
    // moves with it
    await syncCommunityVisibleMembers(supabase, [input.community]);

    revalidateProfileSurfaces();
    return { ok: true, data: await fetchAdminProfiles() };
  });
}

export async function updateProfileAction(
  profileKey: string,
  input: ProfileInput
): Promise<ActionResult<Profile[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    // the community the profile is leaving has to be recounted as well, so its
    // name is read before the update overwrites it
    const { data: previous, error: readError } = await supabase
      .from("profiles")
      .select("community")
      .eq("profile_id", profileKey)
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    const { error } = await supabase
      .from("profiles")
      .update(profileColumns(input))
      .eq("profile_id", profileKey);
    if (error) throw new Error(error.message);

    await syncCommunityVisibleMembers(supabase, [previous?.community, input.community]);

    revalidateProfileSurfaces();
    return { ok: true, data: await fetchAdminProfiles() };
  });
}

export async function setProfileStatusAction(
  profileKey: string,
  status: ProfileStatus
): Promise<ActionResult<Profile[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const { error } = await supabase
      .from("profiles")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("profile_id", profileKey);
    if (error) throw new Error(error.message);

    revalidateProfileSurfaces();
    return { ok: true, data: await fetchAdminProfiles() };
  });
}

export async function setProfileVerifiedAction(
  profileKey: string,
  verified: boolean
): Promise<ActionResult<Profile[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    // registration lands the profile as verified=false / status=inactive, and
    // the anon read policy needs both before a profile is publicly visible.
    // approving therefore does both in one step, otherwise the admin has to
    // find a second "activate" control or the profile stays hidden.
    const patch: { verified: boolean; status?: ProfileStatus; updated_at: string } = {
      verified,
      updated_at: new Date().toISOString(),
    };
    if (verified) patch.status = "active";
    const { error } = await supabase.from("profiles").update(patch).eq("profile_id", profileKey);
    if (error) throw new Error(error.message);

    revalidateProfileSurfaces();
    return { ok: true, data: await fetchAdminProfiles() };
  });
}

export async function deleteProfileAction(
  profileKey: string
): Promise<ActionResult<Profile[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    // read before the delete: afterwards there is no row left to ask which
    // community lost a member
    const { data: existing, error: readError } = await supabase
      .from("profiles")
      .select("community")
      .eq("profile_id", profileKey)
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    // profile_photos and interests both cascade from profiles
    const { error } = await supabase.from("profiles").delete().eq("profile_id", profileKey);
    if (error) throw new Error(error.message);

    await syncCommunityVisibleMembers(supabase, [existing?.community]);

    revalidateProfileSurfaces();
    return { ok: true, data: await fetchAdminProfiles() };
  });
}

/* -- profile photos -------------------------------------------------------- */

// profile_photos.profile_id points at the profiles uuid, not the public
// profile_id, so every photo action resolves the key first. both come back
// together because a storage upload is keyed on the public one.
async function photoProfile(profileKey: string): Promise<{ id: string; profileId: string }> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, profile_id")
    .eq("profile_id", profileKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Profile not found.");
  return {
    id: data.id as unknown as string,
    profileId: data.profile_id as unknown as string,
  };
}

export async function addProfilePhotoAction(
  profileKey: string,
  url: string
): Promise<ActionResult<Profile[]>> {
  return run(async () => {
    await assertAdmin();
    const trimmed = url.trim();
    if (!trimmed) throw new Error("Enter a photo URL.");

    const supabase = await getSupabaseServer();
    const { id: profileUuid } = await photoProfile(profileKey);

    const { data: existing } = await supabase
      .from("profile_photos")
      .select("sort_order")
      .eq("profile_id", profileUuid)
      .order("sort_order", { ascending: false })
      .limit(1);

    const next = (existing?.[0]?.sort_order ?? 0) + 1;
    const { error } = await supabase.from("profile_photos").insert({
      profile_id: profileUuid,
      url: trimmed,
      is_primary: next === 1,
      sort_order: next,
    });
    if (error) throw new Error(error.message);

    revalidateProfileSurfaces();
    return { ok: true, data: await fetchAdminProfiles() };
  });
}

// the same upload the register form does, so an admin can attach a member's
// photos without going through a member account. the type, size and count rules
// are re-checked here because the picker in the browser is only a convenience -
// a server action is an independently reachable endpoint.
//
// the bucket is keyed on the profile's public profile_id, which is also what
// migrations/0001_registration_photo_uploads.sql scopes its insert policy to, so
// an upload here needs the admin branch of that policy: the admin session is not
// the profile's owner.
export async function addProfilePhotoUploadAction(
  profileKey: string,
  files: File[]
): Promise<ActionResult<Profile[]>> {
  return run(async () => {
    await assertAdmin();
    const photos = files.filter((file) => file instanceof File && file.size > 0);
    if (photos.length === 0) throw new Error("Choose at least one photo.");
    if (photos.length > MAX_PHOTOS) throw new Error(`Upload at most ${MAX_PHOTOS} photos at once.`);
    for (const photo of photos) {
      if (!(PHOTO_TYPES as readonly string[]).includes(photo.type))
        throw new Error(`${photo.name} — photos must be JPEG, PNG or WebP.`);
      if (photo.size > MAX_PHOTO_BYTES) throw new Error(photoSizeError(photo.size));
    }

    const supabase = await getSupabaseServer();
    const { id: profileUuid, profileId } = await photoProfile(profileKey);

    const { data: existing } = await supabase
      .from("profile_photos")
      .select("sort_order")
      .eq("profile_id", profileUuid)
      .order("sort_order", { ascending: false })
      .limit(1);
    let sortOrder = (existing?.[0]?.sort_order ?? 0) + 1;
    const isFirst = sortOrder === 1;

    // one upload at a time, and rolled back as a group: a half-attached gallery
    // is worse than no gallery, and the paths are only knowable as we go
    const uploaded: string[] = [];
    for (const photo of photos) {
      const path = `${profileId}/${sortOrder}-${crypto.randomUUID().slice(0, 8)}.${photoExtension(photo.type)}`;

      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, photo, { contentType: photo.type, upsert: false });
      if (uploadError) {
        await supabase.storage.from(PHOTO_BUCKET).remove(uploaded);
        throw new Error(`Could not upload ${photo.name}: ${uploadError.message}`);
      }
      uploaded.push(path);

      const { data: publicUrl } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
      const { error: photoError } = await supabase.from("profile_photos").insert({
        profile_id: profileUuid,
        url: publicUrl.publicUrl,
        is_primary: isFirst,
        sort_order: sortOrder,
      });
      if (photoError) {
        await supabase.storage.from(PHOTO_BUCKET).remove(uploaded);
        throw new Error(`Could not save ${photo.name}: ${photoError.message}`);
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
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const { error } = await supabase.from("profile_photos").delete().eq("id", photoId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/profiles");
    return { ok: true, data: await fetchAdminProfiles() };
  });
}

// promotes the given photo to slot 0 and shifts the rest down, so "primary" and
// "first in the list" stay the same thing
export async function setPrimaryProfilePhotoAction(
  profileKey: string,
  photoId: string
): Promise<ActionResult<Profile[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const { id: profileUuid } = await photoProfile(profileKey);

    const { data: photos, error } = await supabase
      .from("profile_photos")
      .select("id")
      .eq("profile_id", profileUuid)
      .order("sort_order");
    if (error) throw new Error(error.message);
    if (!photos?.some((p) => p.id === photoId)) throw new Error("Photo not found.");

    const ordered = photos.map((p) => p.id);
    const target = photoId as unknown as string;
    const next = [target, ...ordered.filter((id) => id !== target)];

    for (const [index, id] of next.entries()) {
      const { error: updateError } = await supabase
        .from("profile_photos")
        .update({ sort_order: index + 1, is_primary: index === 0 })
        .eq("id", id);
      if (updateError) throw new Error(updateError.message);
    }

    revalidateProfileSurfaces();
    return { ok: true, data: await fetchAdminProfiles() };
  });
}

export async function moveProfilePhotoAction(
  profileKey: string,
  photoId: string,
  delta: number
): Promise<ActionResult<Profile[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const { id: profileUuid } = await photoProfile(profileKey);

    const { data: photos, error } = await supabase
      .from("profile_photos")
      .select("id, sort_order, is_primary")
      .eq("profile_id", profileUuid)
      .order("sort_order");
    if (error) throw new Error(error.message);

    const index = photos?.findIndex((p) => p.id === photoId) ?? -1;
    if (index < 0) throw new Error("Photo not found.");

    const swapWith = index + delta;
    if (!photos || swapWith < 0 || swapWith >= photos.length) {
      return { ok: true, data: await fetchAdminProfiles() };
    }

    const a = photos[index];
    const b = photos[swapWith];
    const { error: first } = await supabase
      .from("profile_photos")
      .update({ sort_order: b.sort_order, is_primary: b.is_primary })
      .eq("id", a.id);
    if (first) throw new Error(first.message);
    const { error: second } = await supabase
      .from("profile_photos")
      .update({ sort_order: a.sort_order, is_primary: a.is_primary })
      .eq("id", b.id);
    if (second) throw new Error(second.message);

    revalidateProfileSurfaces();
    return { ok: true, data: await fetchAdminProfiles() };
  });
}

/* -- communities ----------------------------------------------------------- */

export async function createCommunityAction(
  input: CommunityInput
): Promise<ActionResult<Community[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const name = input.name.trim();
    if (!name) throw new Error("Community name is required.");

    const { error } = await supabase.from("communities").insert({
      id: slug(name) || newId("c"),
      name,
      tamil_name: input.tamilName.trim() || name,
      description: input.description.trim() || null,
      tamil_description: input.tamilDescription.trim() || null,
      visible_members: input.visibleMembers ?? 0,
      active: true,
    });
    if (error) throw new Error(error.message);

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
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const { error } = await supabase
      .from("communities")
      .update({
        name: input.name.trim(),
        tamil_name: input.tamilName.trim(),
        description: input.description.trim() || null,
        tamil_description: input.tamilDescription.trim() || null,
        visible_members: input.visibleMembers ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

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
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const { error } = await supabase
      .from("communities")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/communities");
    revalidatePath("/communities");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminCommunities() };
  });
}

export async function deleteCommunityAction(id: string): Promise<ActionResult<Community[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const { error } = await supabase.from("communities").delete().eq("id", id);
    if (error) throw new Error(error.message);

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

export async function upsertPlanAction(
  input: PlanInput
): Promise<ActionResult<MembershipPlan[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const id = (input.id ?? input.name) as string;
    if (!id) throw new Error("Choose a tier.");

    // the compare table keeps its own per-tier cells. the photo and interest
    // rows mirror the plan's limits, so they are regenerated from them here
    // while every other row is carried through untouched.
    const { data: existing } = await supabase
      .from("membership_plans")
      .select("compare_features, period")
      .eq("id", id)
      .maybeSingle<{
        compare_features: { label: string; value: boolean | string }[] | null;
        period: string | null;
      }>();
    const compareFeatures = (existing?.compare_features ?? []).map((row) => {
      if (/photo/i.test(row.label)) return { ...row, value: planPhotoValue(input.photoLimit) };
      if (/interest/i.test(row.label)) return { ...row, value: planInterestValue(input.interestLimit) };
      return row;
    });

    const { error } = await supabase.from("membership_plans").upsert(
      {
        id,
        label: input.label.trim() || id,
        price: input.price,
        period: input.period,
        popular: Boolean(input.popular),
        features: input.features,
        photo_limit: input.photoLimit,
        interest_limit: input.interestLimit,
        compare_features: compareFeatures,
      },
      { onConflict: "id" }
    );
    if (error) throw new Error(error.message);

    // only a changed duration moves the members already on the plan. a save that
    // leaves the period alone must not reset a subscription an admin extended by
    // hand.
    if (existing && existing.period !== input.period) {
      await reschedulePlanSubscriptions(supabase, id, input.period);
    }

    revalidatePath("/admin/memberships");
    revalidatePath("/membership");
    return { ok: true, data: await fetchAdminPlans() };
  });
}

export async function deletePlanAction(id: string): Promise<ActionResult<MembershipPlan[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();

    // subscriptions.plan references membership_plans.id, so a plan still in use
    // has to be reported rather than left to fail as a raw FK error
    const { count } = await supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("plan", id);
    if (count && count > 0) {
      throw new Error(`${count} subscription(s) still use this plan.`);
    }

    const { error } = await supabase.from("membership_plans").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/memberships");
    return { ok: true, data: await fetchAdminPlans() };
  });
}

export async function createSubscriptionAction(
  userId: string,
  plan: MembershipTier
): Promise<ActionResult<Subscription[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("name")
      .eq("user_id", userId)
      .maybeSingle();
    if (userError) throw new Error(userError.message);
    if (!user) throw new Error("Member not found.");

    const { data: planRow, error: planError } = await supabase
      .from("membership_plans")
      .select("price, period")
      .eq("id", plan)
      .maybeSingle();
    if (planError) throw new Error(planError.message);
    if (!planRow) throw new Error("Membership plan not found.");

    // the term is the plan's own duration, so a 30-day Silver and a 90-day
    // Premium expire when their labels say they do
    const { error } = await supabase.from("subscriptions").insert({
      subscription_id: newId("sub"),
      user_id: userId,
      plan,
      member_name: user.name,
      amount: planRow.price,
      renews_on: addPeriod(new Date(), planRow.period),
      status: "active",
    });
    if (error) throw new Error(error.message);

    await syncMemberEntitlement(supabase, userId);

    revalidatePath("/admin/memberships");
    revalidatePath("/admin/profiles");
    return { ok: true, data: await fetchAdminSubscriptions() };
  });
}

export async function setSubscriptionStatusAction(
  subscriptionId: string,
  status: SubscriptionStatus
): Promise<ActionResult<Subscription[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();

    const { data: row, error: readError } = await supabase
      .from("subscriptions")
      .select("user_id, renews_on, plan")
      .eq("subscription_id", subscriptionId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!row) throw new Error("Subscription not found.");

    const patch: {
      status: SubscriptionStatus;
      updated_at: string;
      renews_on?: string | null;
    } = { status, updated_at: new Date().toISOString() };

    // reactivating a subscription whose term has already lapsed has to open a
    // new term, otherwise the date-aware reconcile expires it again on the very
    // next read. a cancellation still inside its term keeps its original date.
    if (status === "active" && hasExpired(row.renews_on)) {
      const { data: planRow } = await supabase
        .from("membership_plans")
        .select("period")
        .eq("id", row.plan)
        .maybeSingle();
      patch.renews_on = addPeriod(new Date(), planRow?.period);
    }

    const { error } = await supabase
      .from("subscriptions")
      .update(patch)
      .eq("subscription_id", subscriptionId);
    if (error) throw new Error(error.message);

    await syncMemberEntitlement(supabase, row.user_id);

    revalidatePath("/admin/memberships");
    revalidatePath("/admin/profiles");
    return { ok: true, data: await fetchAdminSubscriptions() };
  });
}

// moving a tier re-reads the plan price, otherwise the amount and the tier
// would disagree and the revenue figure would quietly drift. the new plan's
// duration also restarts the term, so the expiry matches the tier the member is
// now on rather than carrying the old plan's length.
export async function changeSubscriptionPlanAction(
  subscriptionId: string,
  plan: MembershipTier
): Promise<ActionResult<Subscription[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();

    const { data: row, error: readError } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("subscription_id", subscriptionId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!row) throw new Error("Subscription not found.");

    const { data: planRow, error: planError } = await supabase
      .from("membership_plans")
      .select("price, period")
      .eq("id", plan)
      .maybeSingle();
    if (planError) throw new Error(planError.message);
    if (!planRow) throw new Error("Membership plan not found.");

    const { error } = await supabase
      .from("subscriptions")
      .update({
        plan,
        amount: planRow.price,
        renews_on: addPeriod(new Date(), planRow.period),
        updated_at: new Date().toISOString(),
      })
      .eq("subscription_id", subscriptionId);
    if (error) throw new Error(error.message);

    await syncMemberEntitlement(supabase, row.user_id);

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
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();

    const { data, error } = await supabase
      .from("subscriptions")
      .select("user_id, renews_on, plan")
      .eq("subscription_id", subscriptionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Subscription not found.");

    const { data: planRow, error: planError } = await supabase
      .from("membership_plans")
      .select("period")
      .eq("id", data.plan)
      .maybeSingle();
    if (planError) throw new Error(planError.message);

    // extend from the existing date, or from today if it already lapsed
    const base =
      data.renews_on && !hasExpired(data.renews_on) ? new Date(data.renews_on) : new Date();

    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        renews_on: addPeriod(base, planRow?.period),
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("subscription_id", subscriptionId);
    if (updateError) throw new Error(updateError.message);

    await syncMemberEntitlement(supabase, data.user_id);

    revalidatePath("/admin/memberships");
    revalidatePath("/admin/profiles");
    return { ok: true, data: await fetchAdminSubscriptions() };
  });
}

/* -- membership payments -------------------------------------------------- */

// approving a payment is what actually grants the plan: it writes the same
// active subscription an admin would create by hand, marks the request approved
// and re-derives the member's entitlement from their live subscriptions.
export async function approvePaymentAction(
  paymentId: string
): Promise<ActionResult<{ payments: MembershipPayment[]; subscriptions: Subscription[] }>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();

    const { data: payment, error: readError } = await supabase
      .from("membership_payments")
      .select("payment_id, user_id, plan, member_name, amount, status")
      .eq("payment_id", paymentId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!payment) throw new Error("Payment request not found.");
    if (payment.status === "approved") throw new Error("This payment is already approved.");

    const { data: planRow, error: planError } = await supabase
      .from("membership_plans")
      .select("price, period")
      .eq("id", payment.plan)
      .maybeSingle();
    if (planError) throw new Error(planError.message);

    const { error: subError } = await supabase.from("subscriptions").insert({
      subscription_id: newId("sub"),
      user_id: payment.user_id,
      plan: payment.plan,
      member_name: payment.member_name,
      amount: Number(payment.amount ?? planRow?.price ?? 0),
      renews_on: addPeriod(new Date(), planRow?.period),
      status: "active",
    });
    if (subError) throw new Error(subError.message);

    const { error: statusError } = await supabase
      .from("membership_payments")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("payment_id", paymentId);
    if (statusError) throw new Error(statusError.message);

    await syncMemberEntitlement(supabase, payment.user_id);

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
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();

    const { error } = await supabase
      .from("membership_payments")
      .update({
        status: "rejected",
        note: note.trim() || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("payment_id", paymentId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/memberships");
    return { ok: true, data: await fetchAdminPayments() };
  });
}

// lets an admin attach or replace the proof on a request, for a member who sent
// the screenshot over WhatsApp or paid at the office. it only changes the file,
// not the status, so the approve/reject decision stays a separate, explicit step.
export async function uploadPaymentScreenshotAction(
  paymentId: string,
  formData: FormData
): Promise<ActionResult<MembershipPayment[]>> {
  return run(async () => {
    await assertAdmin();

    const file = formData.get("screenshot");
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a screenshot to upload.");
    if (!(PAYMENT_SCREENSHOT_TYPES as readonly string[]).includes(file.type)) {
      throw new Error("The screenshot must be JPEG, PNG or WebP.");
    }
    if (file.size > MAX_PAYMENT_SCREENSHOT_BYTES) throw new Error(paymentScreenshotSizeError(file.size));

    const supabase = await getSupabaseServer();
    const { data: payment, error: readError } = await supabase
      .from("membership_payments")
      .select("user_id")
      .eq("payment_id", paymentId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!payment) throw new Error("Payment request not found.");

    const path = `${payment.user_id}/admin-${crypto.randomUUID()}.${photoExtension(file.type)}`;
    const { error: uploadError } = await supabase.storage
      .from(PAYMENT_SCREENSHOT_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(`Could not upload the screenshot: ${uploadError.message}`);

    const { error: updateError } = await supabase
      .from("membership_payments")
      .update({ screenshot_path: path, updated_at: new Date().toISOString() })
      .eq("payment_id", paymentId);
    if (updateError) throw new Error(updateError.message);

    revalidatePath("/admin/memberships");
    return { ok: true, data: await fetchAdminPayments() };
  });
}

// sets a member's tier from the admin profiles list. the tier is derived from
// an active subscription, so moving to free cancels it and moving to a paid tier
// reuses the active row (or creates one) with the plan's current price. the
// denormalised users flags the rest of the app enforces against are written in
// the same step, so the admin list and the member's own quotas cannot disagree.
export async function setUserMembershipAction(
  userId: string,
  tier: MembershipTier
): Promise<ActionResult<AdminUser[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();

    if (tier === "free") {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("status", "active");
      if (error) throw new Error(error.message);
    } else {
      const { data: planRow, error: planError } = await supabase
        .from("membership_plans")
        .select("price, period")
        .eq("id", tier)
        .maybeSingle();
      if (planError) throw new Error(planError.message);
      if (!planRow) throw new Error("Membership plan not found.");

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("name")
        .eq("user_id", userId)
        .maybeSingle();
      if (userError) throw new Error(userError.message);
      if (!user) throw new Error("Member not found.");

      const { data: existing, error: existingError } = await supabase
        .from("subscriptions")
        .select("subscription_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);

      if (existing) {
        // the term restarts with the new plan's duration, so a stale lapsed
        // renews_on cannot immediately cancel the tier just granted
        const { error } = await supabase
          .from("subscriptions")
          .update({
            plan: tier,
            amount: planRow.price,
            renews_on: addPeriod(new Date(), planRow.period),
            updated_at: new Date().toISOString(),
          })
          .eq("subscription_id", existing.subscription_id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("subscriptions").insert({
          subscription_id: newId("sub"),
          user_id: userId,
          plan: tier,
          member_name: user.name,
          amount: planRow.price,
          renews_on: addPeriod(new Date(), planRow.period),
          status: "active",
        });
        if (error) throw new Error(error.message);
      }
    }

    const { error: flagError } = await supabase
      .from("users")
      .update({
        is_membership_user: tier !== "free",
        membership_plan: tier === "free" ? null : tier,
      })
      .eq("user_id", userId);
    if (flagError) throw new Error(flagError.message);

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
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const { error } = await supabase
      .from("site_config")
      .upsert({
        id: "main",
        banner_text: input.bannerText.trim(),
        banner_enabled: input.bannerEnabled,
        office_address: input.officeAddress.trim(),
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);

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
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const name = input.name.trim();
    if (!name) throw new Error("Vendor name is required.");

    const { error } = await supabase.from("service_providers").insert({
      service_id: newId("svc"),
      type: input.type,
      name,
contact: input.contact.trim() || null,
      city: input.city.trim() || null,
      // only a mandapam carries a street address; see the public vendor form
      address: input.type === "mandapam" ? input.address.trim() || null : null,
      phone: input.phone.trim() || null,
      details: input.details.trim() || null,
      // an admin adding a vendor has vouched for it, so it is published on the
      // spot. only rows from the public vendor register form start unapproved.
      is_approved: true,
      active: true,
    });
    if (error) throw new Error(error.message);

    revalidatePath("/admin/services");
    return { ok: true, data: await fetchAdminServices() };
  });
}

export async function updateServiceAction(
  serviceId: string,
  input: ServiceInput
): Promise<ActionResult<ServiceProvider[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const { error } = await supabase
      .from("service_providers")
      .update({
        type: input.type,
        name: input.name.trim(),
contact: input.contact.trim() || null,
        city: input.city.trim() || null,
        address: input.type === "mandapam" ? input.address.trim() || null : null,
        phone: input.phone.trim() || null,
        details: input.details.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("service_id", serviceId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/services");
    return { ok: true, data: await fetchAdminServices() };
  });
}

export async function setServiceActiveAction(
  serviceId: string,
  active: boolean
): Promise<ActionResult<ServiceProvider[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const { error } = await supabase
      .from("service_providers")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("service_id", serviceId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/services");
    return { ok: true, data: await fetchAdminServices() };
  });
}

// the review gate for a listing that came in through /vendor-register. this is
// the only path that sets is_approved from false to true, and assertAdmin keeps
// it away from the anon role the register form runs as.
export async function approveServiceAction(
  serviceId: string
): Promise<ActionResult<ServiceProvider[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    // both gates open together: approving a listing that was left switched off
    // would set is_approved without publishing, and the row would look approved in
    // the admin table while never appearing on the services page.
    const { error } = await supabase
      .from("service_providers")
      .update({ is_approved: true, active: true, updated_at: new Date().toISOString() })
      .eq("service_id", serviceId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/services");
    revalidatePath("/services");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminServices() };
  });
}

// withdraws approval and takes the listing off the site in one step, for a
// submission that should not go live. keeps the row so the details are not lost.
export async function rejectServiceAction(
  serviceId: string
): Promise<ActionResult<ServiceProvider[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const { error } = await supabase
      .from("service_providers")
      .update({ is_approved: false, active: false, updated_at: new Date().toISOString() })
      .eq("service_id", serviceId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/services");
    revalidatePath("/services");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminServices() };
  });
}

export async function deleteServiceAction(
  serviceId: string
): Promise<ActionResult<ServiceProvider[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const { error } = await supabase
      .from("service_providers")
      .delete()
      .eq("service_id", serviceId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/services");
    return { ok: true, data: await fetchAdminServices() };
  });
}

/* -- temples --------------------------------------------------------------- */

// The cover is either a pasted url or an uploaded file, never both, so the form
// sends a discriminator alongside the value. A separate field rather than
// "whichever is non-empty", because switching the dropdown to Upload and then
// back to URL must not silently resurrect the old url the operator replaced.
export type TempleCoverMode = "url" | "upload";

export interface TempleCover {
  mode: TempleCoverMode;
  /** the pasted url. ignored when mode is "upload". */
  url: string;
  /** the chosen file. ignored when mode is "url". */
  file: File | null;
}

const EMPTY_COVER: TempleCover = { mode: "url", url: "", file: null };

// Spreads the seven day strings onto their columns.
//
// The keys come from TEMPLE_DAYS rather than being written out by hand, so the
// column a day lands in cannot drift from the column it is read back from — that
// mismatch would be silent, because both sides would still typecheck against
// string.
//
// A shorter or longer array is tolerated rather than throwing: a day the client
// did not send becomes null, which is the same as the admin leaving it blank.
// Throwing here would mean a stale client could not save a temple at all.
function templeTimingsRow(timings: string[]): Record<string, string | null> {
  const row: Record<string, string | null> = {};
  TEMPLE_DAYS.forEach((day, index) => {
    row[`${day.toLowerCase()}_timings`] = timings[index]?.trim() || null;
  });
  return row;
}

// one builder for both create and update: the two used to repeat the same eight
// columns, which is how new fields ended up saved by one path and not the other
// The server half of the form validation. Every rule here has a twin in the
// admin form's validate(), and they are kept in step deliberately: the client one
// exists to put a message next to the field, this one is the actual gate. A
// crafted request skips the client entirely, so anything not checked here is
// simply not checked.
function templeRow(input: TempleInput, cover: TempleCover) {
  const name = input.name.trim();
  if (!name) throw new Error("Temple name is required.");
  if (name.length > 120) throw new Error("Keep the temple name under 120 characters.");

  // The required major fields. Kept in step with validate() in temples-manager,
  // where each one gets a message next to the box; enforced here so a crafted
  // request cannot write a temple without them.
  //
  // messages are bare for the same reason. the reason a field is required belongs
  // in the label and the hint, not in the text an operator reads repeatedly.
  if (!input.address.trim()) throw new Error("Address is required.");
  if (!input.city.trim()) throw new Error("City is required.");
  if (!input.district.trim()) throw new Error("District is required.");
  if (!input.nameTa.trim()) throw new Error("Name in Tamil is required.");
  if (!input.contactPerson.trim()) throw new Error("Contact person is required.");

  // contact is how a visitor reaches the temple, so it is required rather than
  // optional. digits, spaces and the punctuation operators actually use; anything
  // else gives a tel: link that does not dial.
  const phone = input.contact.trim();
  if (!phone) throw new Error("Phone number is required.");
  if (!/^[0-9+()\s.-]{7,20}$/.test(phone)) throw new Error("That does not look like a phone number.");

  // the maps link is what Get Directions uses. mapsUrl() below drops a bad one
  // silently, so requiring it turns that into a message instead
  if (!input.mapsUrl.trim()) throw new Error("Google Maps link is required.");
  if (!mapsUrl(input.mapsUrl.trim())) throw new Error("That is not a Google Maps link.");

  // history is the entire "About this temple" panel, so blank is not a thin page
  // but the page's main content missing
  const history = input.history.trim();
  if (!history) throw new Error("History is required.");
  if (history.length < 40)
    throw new Error("Write at least a sentence or two about this temple.");

  // ---- optional, validated only when filled ----------------------------
  const whatsapp = input.whatsapp.trim();
  if (whatsapp && !/^[0-9+()\s.-]{7,20}$/.test(whatsapp))
    throw new Error("That does not look like a WhatsApp number.");

  const email = input.email.trim();
  if (email && !email.includes("@")) throw new Error("That email address does not look valid.");

  // both of these become an href, so a value that is not a url is worse than none
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
    // validated by the same helper the read side uses, so a bad url is dropped on
    // the way in rather than rendered later. an empty box clears the link, which
    // is how an operator removes it.
    maps_url: mapsUrl(input.mapsUrl.trim()),
    history: input.history.trim() || null,
    // spread, not a `timings` key: this has to become seven separate columns. written
    // as a key it sent a column named "timings", which postgrest rejects by name
    // once the column is gone from the schema.
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

// Writes an uploaded cover into the temple's own folder under a cover- prefix,
// then points temples.cover_image at it. Both halves or neither: a stored object
// nothing references is billed forever, and a cover_image url pointing at a
// deleted object is a broken frame on the public page.
//
// The folder is the temple's own, which is why this runs after the row is
// created rather than as the admin picks the file — temple_id does not exist
// until then. That is also why the file is validated in the browser first, so
// an oversized pick is refused before a round trip rather than after.
async function storeTempleCover(
  supabase: Awaited<ReturnType<typeof getSupabaseServer>>,
  templeId: string,
  cover: TempleCover,
  previous: string | null
) {
  if (cover.mode !== "upload" || !cover.file) return;

  const { left } = await templeImageSlots(supabase, templeId);
  // replacing a cover reuses its own slot, so the budget only bites when the
  // temple had none
  if (!previous && left === 0) {
    throw new Error(
      `All ${MAX_TEMPLE_IMAGES} image slots are used by the gallery. Remove one before adding a cover image.`
    );
  }

  const path = `${templeId}/${TEMPLE_COVER_PREFIX}${crypto.randomUUID()}.${photoExtension(cover.file.type)}`;
  const { error: uploadError } = await supabase.storage
    .from(TEMPLE_IMAGE_BUCKET)
    .upload(path, cover.file, { contentType: cover.file.type, upsert: false });
  if (uploadError) throw new Error(`Could not upload ${cover.file.name}: ${uploadError.message}`);

  const url = supabase.storage.from(TEMPLE_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;

  const { error: updateError } = await supabase
    .from("temples")
    .update({ cover_image: url, updated_at: new Date().toISOString() })
    .eq("temple_id", templeId);
  if (updateError) {
    await supabase.storage.from(TEMPLE_IMAGE_BUCKET).remove([path]);
    throw new Error(`Could not save the cover image: ${updateError.message}`);
  }

  // only now that the row points elsewhere is the old file unreferenced. a url
  // the operator pasted belongs to them, so this only ever removes our own
  if (previous) await removeTempleImageObjects(templeId, [previous]);
}

// the cover a saved temple currently has, so a replacement knows what to unlink
async function currentTempleCover(
  supabase: Awaited<ReturnType<typeof getSupabaseServer>>,
  templeId: string
) {
  const { data, error } = await supabase
    .from("temples")
    .select("cover_image")
    .eq("temple_id", templeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.cover_image ?? null;
}

export async function createTempleAction(
  input: TempleInput,
  cover: TempleCover = EMPTY_COVER
): Promise<ActionResult<Temple[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    checkCoverFile(cover);

    const templeId = newId("tmpl");
    const { error } = await supabase.from("temples").insert({
      temple_id: templeId,
      ...templeRow(input, cover),
      is_approved: true,
      active: true,
    });
    if (error) throw new Error(error.message);

    // after the insert, because the upload path is the temple's own folder and
    // temple_id only exists once the row does.
    //
    // on failure the row goes back out. a temple that exists without the cover
    // the operator just chose is worse than one that was never created: the
    // form still shows the error, so they press save again, and without this
    // that second press inserts a second temple. an orphaned object is swept by
    // the same delete below.
    try {
      await storeTempleCover(supabase, templeId, cover, null);
    } catch (coverError) {
      await supabase.from("temples").delete().eq("temple_id", templeId);
      await removeTempleImageObjects(templeId);
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
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    checkCoverFile(cover);

    // read before the write: the update below nulls cover_image for an upload,
    // so afterwards there is no way to tell what the replaced file was called
    const previous = await currentTempleCover(supabase, templeId);

    const { error } = await supabase
      .from("temples")
      .update({
        ...templeRow(input, cover),
        updated_at: new Date().toISOString(),
      })
      .eq("temple_id", templeId);
    if (error) throw new Error(error.message);

    // Three ways the previous cover stops being referenced. An upload replaces
    // it, and storeTempleCover unlinks the old file once the row points at the
    // new one. A pasted url replaces it too, but storeTempleCover returns early
    // in url mode, so it is unlinked here.
    //
    // only when the value actually changed. An edit that never touched the cover
    // re-sends the same url, and unlinking that would delete the file the row
    // still points at — a stored url resolving to nothing. Best-effort: the row
    // is already correct, and an orphan costs storage rather than correctness.
    if (cover.mode === "url" && previous && previous !== cover.url.trim()) {
      await removeTempleImageObjects(templeId, [previous]);
    }
    await storeTempleCover(supabase, templeId, cover, previous);

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
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const { error } = await supabase
      .from("temples")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("temple_id", templeId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/temples");
    revalidatePath("/temples");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminTemples() };
  });
}

export async function approveTempleAction(
  templeId: string
): Promise<ActionResult<Temple[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const { error } = await supabase
      .from("temples")
      .update({ is_approved: true, active: true, updated_at: new Date().toISOString() })
      .eq("temple_id", templeId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/temples");
    revalidatePath("/temples");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminTemples() };
  });
}

export async function rejectTempleAction(
  templeId: string
): Promise<ActionResult<Temple[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const { error } = await supabase
      .from("temples")
      .update({ is_approved: false, active: false, updated_at: new Date().toISOString() })
      .eq("temple_id", templeId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/temples");
    revalidatePath("/temples");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminTemples() };
  });
}

export async function deleteTempleAction(
  templeId: string
): Promise<ActionResult<Temple[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();
    const { error } = await supabase
      .from("temples")
      .delete()
      .eq("temple_id", templeId);
    if (error) throw new Error(error.message);

    // temple_images rows cascade from the delete above, but storage objects do
    // not — there is no foreign key to a bucket. left behind, they are billed
    // forever and never rendered, so sweep the bucket for this temple's prefix.
    await removeTempleImageObjects(templeId);

    revalidatePath("/admin/temples");
    revalidatePath("/temples");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminTemples() };
  });
}

// best-effort, same reasoning as the member profile photo delete: the row is
// what the app reads, so a failed object delete leaves an orphaned file rather
// than a gallery with a broken frame in it.
//
// given urls, it removes exactly those. given none, it sweeps the whole folder —
// which is only correct when the caller just deleted every row for the temple.
async function removeTempleImageObjects(templeId: string, urls?: string[]) {
  const supabase = await getSupabaseServer();
  let paths: string[];

  if (urls && urls.length > 0) {
    const prefix = `${TEMPLE_IMAGE_BUCKET}/`;
    paths = urls
      .map((url) => {
        const at = url.indexOf(prefix);
        if (at === -1) return null;
        return decodeURIComponent(url.slice(at + prefix.length).split("?")[0]);
      })
      .filter((path): path is string => Boolean(path));
  } else {
    const { data } = await supabase.storage.from(TEMPLE_IMAGE_BUCKET).list(templeId);
    paths = (data ?? []).map((entry) => `${templeId}/${entry.name}`);
  }

  if (paths.length === 0) return;
  await supabase.storage.from(TEMPLE_IMAGE_BUCKET).remove(paths);
}

// The five-image budget is shared: a cover occupies one of the five, so a temple
// with an uploaded cover has four gallery slots left, not five. The cover is a
// url on the temples row rather than a temple_images row, so it is counted from
// there. A cover typed as a url by hand also counts — the budget is about how
// many images the page shows, not about how many files are in storage.
async function templeImageSlots(supabase: Awaited<ReturnType<typeof getSupabaseServer>>, templeId: string) {
  const [{ data: images }, { data: temple }] = await Promise.all([
    supabase.from("temple_images").select("id").eq("temple_id", templeId),
    supabase.from("temples").select("cover_image").eq("temple_id", templeId).maybeSingle(),
  ]);

  const used = (images?.length ?? 0) + (temple?.cover_image ? 1 : 0);
  return { used, left: Math.max(0, MAX_TEMPLE_IMAGES - used) };
}

export async function addTempleImagesAction(
  templeId: string,
  files: File[]
): Promise<ActionResult<Temple[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();

    if (files.length === 0) throw new Error("Choose at least one image to upload.");

    const { left } = await templeImageSlots(supabase, templeId);
    // the trigger in table_creation.md enforces this too, but it fails as a raw
    // check_violation from postgrest with no useful text, so the friendly check
    // happens first and the trigger is only the backstop against a race
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
    const { data: last } = await supabase
      .from("temple_images")
      .select("sort_order")
      .eq("temple_id", templeId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const from = Number(last?.sort_order ?? 0);

    // a uuid rather than a slot number in the filename: reordering changes
    // sort_order on the row, and a path carrying "1-" would then be a lie about
    // where the image sits
    const uploaded: string[] = [];
    const inserted: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        const path = `${templeId}/${crypto.randomUUID()}.${photoExtension(file.type)}`;

        const { error: uploadError } = await supabase.storage
          .from(TEMPLE_IMAGE_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw new Error(`Could not upload ${file.name}: ${uploadError.message}`);
        uploaded.push(path);

        const { data, error: insertError } = await supabase
          .from("temple_images")
          .insert({
            temple_id: templeId,
            url: supabase.storage.from(TEMPLE_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl,
            alt: "",
            sort_order: from + index + 1,
          })
          .select("id")
          .single();
        if (insertError) throw new Error(`Could not save ${file.name}: ${insertError.message}`);
        inserted.push(String(data.id));
      }
    } catch (error) {
      // both halves have to go. removing only the files would leave rows pointing
      // at urls that 404, which is a worse gallery than none at all; removing only
      // the rows would leave files nothing references, still counting against the
      // five-image cap. a partial upload is undone completely or not at all.
      if (inserted.length > 0) {
        await supabase.from("temple_images").delete().in("id", inserted);
      }
      await supabase.storage.from(TEMPLE_IMAGE_BUCKET).remove(uploaded);
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
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();

    // scoped to both temple and id so a crafted request cannot delete an image
    // belonging to a different temple
    const { data: image, error: readError } = await supabase
      .from("temple_images")
      .select("url")
      .eq("id", imageId)
      .eq("temple_id", templeId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!image) throw new Error("That image is no longer in the gallery.");

    const { error } = await supabase
      .from("temple_images")
      .delete()
      .eq("id", imageId)
      .eq("temple_id", templeId);
    if (error) throw new Error(error.message);

    // the url is read before the delete, because once the row is gone there is
    // nothing left to derive the storage path from. it must be this one file:
    // removing the folder instead would leave every remaining row pointing at a
    // file that no longer exists.
    await removeTempleImageObjects(templeId, [String(image.url)]);

    revalidatePath("/admin/temples");
    revalidatePath("/temples");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminTemples() };
  });
}

// -- festivals ---------------------------------------------------------------
// one row per upcoming festival. the whole list is saved in one pass rather than
// one action per row: the admin form edits an array, and a list where each add
// or delete is its own request means a dropped connection leaves half the list
// saved. the trade is that a failed save leaves the previous list intact, which
// is the better outcome.
export async function saveTempleFestivalsAction(
  templeId: string,
  festivals: { name: string; happensOn: string }[]
): Promise<ActionResult<Temple[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();

    // every row needs a name, and the date is optional but must look like a date
    // if it is there. validated before anything is written so a bad row does not
    // arrive as a postgrest 400 with no useful text.
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

    // delete-then-insert, scoped by temple_id rather than by id. swapping the
    // whole list means a row the admin removed has nothing left pointing at it,
    // and a rename needs no separate update.
    const { error: deleteError } = await supabase
      .from("temple_festivals")
      .delete()
      .eq("temple_id", templeId);
    if (deleteError) throw new Error(deleteError.message);

    if (cleaned.length > 0) {
      const { error: insertError } = await supabase.from("temple_festivals").insert(
        cleaned.map((festival, index) => ({
          temple_id: templeId,
          name: festival.name,
          happens_on: festival.happensOn,
          // numbered in the order the admin typed them, so the form and the
          // public list agree before the date sort is applied
          sort_order: index + 1,
        }))
      );
      if (insertError) {
        // the delete already committed, so the temple now has no festivals at
        // all. that is recoverable from the form, unlike a half-written list.
        throw new Error(insertError.message);
      }
    }
    // if the insert failed the temple is left with no festivals rather than a
    // half-written list. an operator reopens the form and retries; a page mixing
    // the old and new names would be worse than either.

    revalidatePath("/admin/temples");
    revalidatePath("/temples");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminTemples() };
  });
}

// -- services -----------------------------------------------------------------
// one row per package or offering, saved in one pass for the same reason the
// festivals are: the form edits an array, and a request per row would leave half
// the list written when a connection drops.
//
// this one is a diff rather than the festivals' delete-then-insert, because a
// replace would silently reset every column this form does not edit — terms,
// is_available, is_featured, image — and an admin who had switched a package off
// would find it back on the public page with its terms gone. rows are matched on
// name, the only handle the flat form carries, so an untouched package keeps its
// row and only details and price are written back.
export async function saveTempleServicesAction(
  templeId: string,
  services: { name: string; details: string; price: string }[]
): Promise<ActionResult<Temple[]>> {
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();

    // whole rupees, because the column is an integer and 250.5 would arrive as a
    // postgrest 400 with no useful text. 0 is a real value, not a missing one: it
    // is what renders as "On request", so it is kept rather than nulled.
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

    const { data: existing, error: readError } = await supabase
      .from("temple_services")
      .select("id, name")
      .eq("temple_id", templeId);
    if (readError) throw new Error(readError.message);

    // a row the form no longer lists is one the admin deleted, so it goes now
    for (const row of existing ?? []) {
      if (wanted.includes(String(row.name).trim().toLowerCase())) continue;
      const { error } = await supabase.from("temple_services").delete().eq("id", row.id);
      if (error) throw new Error(error.message);
    }

    for (const [index, service] of cleaned.entries()) {
      const match = (existing ?? []).find(
        (row) => String(row.name).trim().toLowerCase() === service.name.toLowerCase()
      );
      if (match) {
        const { error } = await supabase
          .from("temple_services")
          .update({
            details: service.details || null,
            price: service.price,
            // renumbered so the form's order is the order the public page lists
            sort_order: index + 1,
          })
          .eq("id", match.id)
          // the temple_id in the filter as well as the id, so a tampered payload
          // cannot write to another temple's package
          .eq("temple_id", templeId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("temple_services").insert({
          temple_id: templeId,
          name: service.name,
          details: service.details || null,
          price: service.price,
          sort_order: index + 1,
        });
        if (error) throw new Error(error.message);
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
  return run(async () => {
    await assertAdmin();
    const supabase = await getSupabaseServer();

    const { data: owned, error: readError } = await supabase
      .from("temple_images")
      .select("id")
      .eq("temple_id", templeId);
    if (readError) throw new Error(readError.message);

    // only renumber the ids this temple actually owns, so a tampered payload
    // cannot reorder or renumber another temple's gallery
    const mine = new Set((owned ?? []).map((row) => String(row.id)));
    const wanted = orderedIds.filter((id) => mine.has(id));

    const { error } = await supabase
      .from("temple_images")
      .update({ sort_order: 0 })
      .eq("temple_id", templeId);
    if (error) throw new Error(error.message);

    for (const [index, id] of wanted.entries()) {
      const { error: updateError } = await supabase
        .from("temple_images")
        .update({ sort_order: index + 1 })
        .eq("id", id)
        .eq("temple_id", templeId);
      if (updateError) throw new Error(updateError.message);
    }

    revalidatePath("/admin/temples");
    revalidatePath("/temples");
    updateTag("public-data");
    return { ok: true, data: await fetchAdminTemples() };
  });
}
