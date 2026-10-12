"use server";

// self-service profile editing. the member owns exactly one row here, and every
// write below is scoped by users.user_id rather than by a profile id taken from
// the form — a server action is an independently reachable endpoint, so an id in
// the payload proves nothing. rls scopes the same rows, so a forged id would be
// refused by the database as well as ignored here.
//
// account-level fields are deliberately absent: email, mobile and password are
// auth concerns, and changing them behind a plain form is how accounts get
// locked out. the register wizard remains the only writer of those.
import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { assertMember } from "@/lib/data/member-dal";
import {
  EDUCATION_OPTIONS,
  INDIAN_STATES,
  MAX_PHOTO_BYTES,
  PHOTO_BUCKET,
  PHOTO_TYPES,
  photoSizeError,
} from "@/lib/constants";
import { PHOTO_QUOTA, resolveMemberLimits } from "@/lib/payments/quotas";
import {
  REGISTRATION_TEXT_FIELDS,
  ageFromDob,
  initialRegistrationDraft,
  resolveChoice,
  validateRegistrationStep,
  type RegistrationDraft,
  type RegistrationErrors,
} from "@/lib/registration";

export type EditProfileResult =
  | { ok: true }
  | { ok: false; error: string; fields?: RegistrationErrors };

export type PhotoResult = { ok: true } | { ok: false; error: string };

const PHOTO_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MARITAL_STATUSES = ["single", "divorced", "widowed"];
const GENDERS = ["female", "male"];

// the account fields the wizard owns are not part of an edit, so they are
// dropped from the shared list rather than special-cased at every read
const PROFILE_TEXT_FIELDS = REGISTRATION_TEXT_FIELDS.filter(
  (field) => field !== "email" && field !== "mobile" && field !== "password"
);

const text = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const list = (formData: FormData, key: string): string[] =>
  (formData.getAll(key) as (string | File)[])
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .map((value) => value.trim().slice(0, 60));

// the same intersection the register action applies: the pickers are a
// convenience, and an unchecked payload must not be able to widen a text[]
// column with a value no other member can select
const fromList = (formData: FormData, key: string, allowed: readonly string[]): string[] =>
  list(formData, key).filter((value) => allowed.includes(value));

// gender is a real profile field here, offered as the same bride/groom pick the
// wizard uses. a blank or unrecognised answer keeps whatever the row already
// says rather than blanking the column, so a payload that simply omits the
// select cannot erase it.
function readDraft(formData: FormData, storedGender: string): RegistrationDraft {
  const draft: RegistrationDraft = { ...initialRegistrationDraft };

  for (const key of PROFILE_TEXT_FIELDS) draft[key] = text(formData, key);

  const gender = text(formData, "gender");
  draft.gender = GENDERS.includes(gender) ? gender : storedGender;

  const height = Number(text(formData, "height"));
  if (Number.isFinite(height) && height > 0) draft.height = height;

  for (const key of ["prefMinAge", "prefMaxAge", "prefMinHeight", "prefMaxHeight"] as const) {
    const value = Number(text(formData, key));
    if (Number.isFinite(value) && value > 0) draft[key] = String(value);
  }

  draft.hobbies = list(formData, "hobbies").slice(0, 12);
  draft.prefLocations = fromList(formData, "prefLocations", INDIAN_STATES);
  draft.prefMotherTongues = list(formData, "prefMotherTongues");
  draft.prefCommunities = list(formData, "prefCommunities");
  draft.prefEducations = fromList(formData, "prefEducations", EDUCATION_OPTIONS);
  draft.prefProfessions = list(formData, "prefProfessions");
  draft.prefMaritalStatuses = list(formData, "prefMaritalStatuses").filter((value) =>
    MARITAL_STATUSES.includes(value)
  );

  return draft;
}

// steps 2 to 7 are the ones that describe the profile; 1 is the account step and
// 8 is the photo step, which is handled by the separate photo actions so an
// already-full gallery is not reported as a form error
function checkProfile(draft: RegistrationDraft): RegistrationErrors {
  return [2, 3, 4, 5, 6, 7].reduce<RegistrationErrors>(
    (all, step) => ({ ...all, ...validateRegistrationStep(step, draft, draft.hobbies.length) }),
    {}
  );
}

export async function updateProfile(formData: FormData): Promise<EditProfileResult> {
  let member;
  try {
    member = await assertMember();
  } catch {
    return { ok: false, error: "Your session has expired. Please sign in again." };
  }

  const supabase = await getSupabaseServer();
  const { data: current, error: readError } = await supabase
    .from("profiles")
    .select("gender")
    .eq("user_id", member.userId)
    .maybeSingle();
  if (readError) return { ok: false, error: `Could not load your profile: ${readError.message}` };

  // the stored gender is the fallback for a blank or unrecognised answer. an
  // account with no profile row yet still has to pass the step-2 check, and the
  // column is not nullable, so the wizard's first option stands in.
  const draft = readDraft(
    formData,
    (current?.gender as string | undefined) ?? "male"
  );
  const fieldErrors = checkProfile(draft);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: "Some details are missing or invalid. Please review the highlighted fields.",
      fields: fieldErrors,
    };
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: draft.fullName.trim(),
      gender: draft.gender,
      date_of_birth: draft.dateOfBirth || null,
      age: ageFromDob(draft.dateOfBirth),
      height: draft.height,
      marital_status: draft.maritalStatus,
      religion: resolveChoice(draft.religion, draft.religionOther) || null,
      community: resolveChoice(draft.community, draft.communityOther) || null,
      caste: draft.caste.trim() || null,
      mother_tongue: resolveChoice(draft.motherTongue, draft.motherTongueOther) || null,
      education: resolveChoice(draft.education, draft.educationOther) || null,
      // the column exists and the admin screens write it, but the register
      // wizard never asked for it, so there is no draft key to carry it
      college: text(formData, "college").trim() || null,
      profession: resolveChoice(draft.profession, draft.professionOther) || null,
      company: draft.company.trim() || null,
      income: draft.income || null,
      country: draft.country || "India",
      state: draft.state || null,
      district: draft.district || null,
      city: draft.city.trim() || null,
      about: draft.about.trim() || null,
      // family
      father_occupation: draft.fatherOccupation.trim() || null,
      mother_occupation: draft.motherOccupation.trim() || null,
      brother_count: Number(draft.brotherCount) || 0,
      sister_count: Number(draft.sisterCount) || 0,
      family_type: draft.familyType,
      family_location: draft.familyLocation.trim() || null,
      family_values: draft.familyValues.trim() || null,
      gotra: draft.gotra.trim() || null,
      horoscope_required: draft.horoscopeRequired === "yes",
      // lifestyle
      diet: draft.diet,
      smoking: draft.smoking,
      drinking: draft.drinking,
      hobbies: draft.hobbies,
      fitness: draft.fitness.trim() || null,
      sports: draft.sports.trim() || null,
      music: draft.music.trim() || null,
      food: draft.food.trim() || null,
      appearances: draft.appearances.trim() || null,
      // partner preferences
      min_age: Number(draft.prefMinAge),
      max_age: Number(draft.prefMaxAge),
      min_height: Number(draft.prefMinHeight),
      max_height: Number(draft.prefMaxHeight),
      pref_religion: resolveChoice(draft.prefReligion, draft.prefReligionOther) || null,
      pref_mother_tongues: draft.prefMotherTongues,
      pref_communities: draft.prefCommunities,
      pref_education: draft.prefEducations,
      pref_professions: draft.prefProfessions,
      pref_locations: draft.prefLocations,
      pref_marital_statuses: draft.prefMaritalStatuses,
      pref_diet: draft.prefDiet || null,
      pref_smoking: draft.prefSmoking || null,
      pref_drinking: draft.prefDrinking || null,
      pref_income: draft.prefIncome || null,
      updated_at: now,
    })
    .eq("user_id", member.userId);

  if (error) return { ok: false, error: `Could not save your profile: ${error.message}` };

  // users.name is what the greeting and the auth provider read, so it follows
  // the profile rather than being left pointing at the name given at sign-up
  await supabase.from("users").update({ name: draft.fullName.trim() }).eq("user_id", member.userId);

  revalidateMemberPaths();
  return { ok: true };
}

export async function addPhotos(formData: FormData): Promise<PhotoResult> {
  let member;
  try {
    member = await assertMember();
  } catch {
    return { ok: false, error: "Your session has expired. Please sign in again." };
  }

  const supabase = await getSupabaseServer();

  // the photos table keys on the row uuid rather than the public profile_id
  const { data: row, error: readError } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", member.userId)
    .maybeSingle();
  if (readError || !row) {
    return { ok: false, error: `Could not load your profile: ${readError?.message ?? "no profile row"}` };
  }
  const profileUuid = row.id as unknown as string;

  const { data: existing, error: countError } = await supabase
    .from("profile_photos")
    .select("id, sort_order")
    .eq("profile_id", profileUuid);
  if (countError) return { ok: false, error: `Could not read your photos: ${countError.message}` };

  const current = (existing ?? []) as unknown as { id: string; sort_order: number }[];
  const incoming = (formData.getAll("photos") as (string | File)[]).filter(
    (entry): entry is File => entry instanceof File && entry.size > 0
  );

  if (incoming.length === 0) return { ok: false, error: "Choose at least one photo to add." };
  // the cap is the member's plan quota, not the site-wide constant: free keeps
  // 1, silver 5, premium 10. admins use a different action and are unaffected.
  const { photos: quota } = await resolveMemberLimits(supabase, member.userId);
  if (current.length + incoming.length > quota) {
    return { ok: false, error: `Your plan allows at most ${quota} photo${quota === 1 ? "" : "s"}. Remove one first or upgrade.` };
  }
  for (const photo of incoming) {
    if (!(PHOTO_TYPES as readonly string[]).includes(photo.type)) {
      return { ok: false, error: "Photos must be JPEG, PNG or WebP." };
    }
    if (photo.size > MAX_PHOTO_BYTES) return { ok: false, error: photoSizeError(photo.size) };
  }

  const nextOrder = current.reduce((max, p) => Math.max(max, p.sort_order), 0);
  const uploaded: string[] = [];

  for (const [index, photo] of incoming.entries()) {
    const path = `${member.profileId}/${nextOrder + index + 1}-${crypto.randomUUID().slice(0, 8)}.${
      PHOTO_EXTENSIONS[photo.type] ?? "jpg"
    }`;

    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, photo, { contentType: photo.type, upsert: false });
    if (uploadError) {
      await supabase.storage.from(PHOTO_BUCKET).remove(uploaded);
      return { ok: false, error: `Could not upload photo ${index + 1}: ${uploadError.message}` };
    }
    uploaded.push(path);

    const { data: publicUrl } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
    const { error: photoError } = await supabase.from("profile_photos").insert({
      profile_id: profileUuid,
      url: publicUrl.publicUrl,
      // the first photo on the row is the primary one, so a member who has none
      // yet gets a primary as soon as their first upload lands
      is_primary: current.length === 0 && index === 0,
      sort_order: nextOrder + index + 1,
    });
    if (photoError) {
      await supabase.storage.from(PHOTO_BUCKET).remove(uploaded);
      return { ok: false, error: `Could not save photo ${index + 1}: ${photoError.message}` };
    }
  }

  revalidateMemberPaths();
  return { ok: true };
}

export async function removePhoto(photoId: string): Promise<PhotoResult> {
  let member;
  try {
    member = await assertMember();
  } catch {
    return { ok: false, error: "Your session has expired. Please sign in again." };
  }

  const supabase = await getSupabaseServer();

  // resolved through the member's own row first, so a photo id belonging to
  // somebody else cannot be reached even if the policies were ever loosened
  const { data: row } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", member.userId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Could not load your profile." };
  const profileUuid = row.id as unknown as string;

  const { data: found, error: readError } = await supabase
    .from("profile_photos")
    .select("id, url, is_primary")
    .eq("id", photoId)
    .eq("profile_id", profileUuid)
    .maybeSingle();
  if (readError || !found) {
    return { ok: false, error: "That photo is no longer on your profile." };
  }

  const photo = found as unknown as { id: string; url: string; is_primary: boolean };
  const { error } = await supabase.from("profile_photos").delete().eq("id", photo.id);
  if (error) return { ok: false, error: `Could not remove the photo: ${error.message}` };

  await removeStoredObject(supabase, photo.url);

  // the next photo by sort order takes over as primary, otherwise the profile is
  // left holding photos with none of them marked as the one to show
  if (photo.is_primary) {
    const { data: rest } = await supabase
      .from("profile_photos")
      .select("id")
      .eq("profile_id", profileUuid)
      .order("sort_order")
      .limit(1);
    const next = (rest ?? [])[0] as unknown as { id: string } | undefined;
    if (next) await supabase.from("profile_photos").update({ is_primary: true }).eq("id", next.id);
  }

  revalidateMemberPaths();
  return { ok: true };
}

export async function makePrimaryPhoto(photoId: string): Promise<PhotoResult> {
  let member;
  try {
    member = await assertMember();
  } catch {
    return { ok: false, error: "Your session has expired. Please sign in again." };
  }

  const supabase = await getSupabaseServer();

  const { data: row } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", member.userId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Could not load your profile." };
  const profileUuid = row.id as unknown as string;

  const { data: owned, error: readError } = await supabase
    .from("profile_photos")
    .select("id")
    .eq("id", photoId)
    .eq("profile_id", profileUuid)
    .maybeSingle();
  if (readError || !owned) return { ok: false, error: "That photo is not on your profile." };

  const { error: clearError } = await supabase
    .from("profile_photos")
    .update({ is_primary: false })
    .eq("profile_id", profileUuid);
  if (clearError) return { ok: false, error: clearError.message };

  const { error } = await supabase
    .from("profile_photos")
    .update({ is_primary: true })
    .eq("id", photoId);
  if (error) return { ok: false, error: error.message };

  revalidateMemberPaths();
  return { ok: true };
}

// the storage object is best-effort: the row is the thing the app reads, so a
// failed delete leaves an orphan file rather than a broken profile
async function removeStoredObject(
  supabase: Awaited<ReturnType<typeof getSupabaseServer>>,
  url: string
) {
  const prefix = `${PHOTO_BUCKET}/`;
  const at = url.indexOf(prefix);
  if (at === -1) return;
  const path = decodeURIComponent(url.slice(at + prefix.length).split("?")[0]);
  if (!path) return;
  await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}

/**
 * The member's photo quota for display. The upload action re-resolves it on
 * every call, so this is display-only and a stale answer here can never grant
 * an extra slot.
 */
export async function getPhotoQuota(): Promise<number> {
  try {
    const member = await assertMember();
    const supabase = await getSupabaseServer();
    return (await resolveMemberLimits(supabase, member.userId)).photos;
  } catch {
    return PHOTO_QUOTA.free;
  }
}

function revalidateMemberPaths() {
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  revalidatePath("/brides");
  revalidatePath("/grooms");
  revalidatePath("/search");
}