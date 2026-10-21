"use server";

// self-service profile editing. the member owns exactly one row here, and every
// write below is scoped by users.user_id rather than by a profile id taken from
// the form — a server action is an independently reachable endpoint, so an id in
// the payload proves nothing. mysql has no row level security, so the user_id
// filters are the entire boundary.
//
// account-level fields are deliberately absent: email, mobile and password are
// auth concerns, and changing them behind a plain form is how accounts get
// locked out. the register wizard remains the only writer of those.
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { q1, q, run } from "@/lib/db";
import { assertMember } from "@/lib/data/member-dal";
import { saveUpload, deleteUpload, parseUploadUrl } from "@/lib/uploads";
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
// convenience, and an unchecked payload must not be able to widen a column with
// a value no other member can select
const fromList = (formData: FormData, key: string, allowed: readonly string[]): string[] =>
  list(formData, key).filter((value) => allowed.includes(value));

// gender is a real profile field here, offered as the same bride/groom pick the
// wizard uses. a blank or unrecognised answer keeps whatever the row already
// says rather than blanking the column.
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

  const current = await q1<{ gender: string | null }>(
    "select gender from profiles where user_id = ?",
    [member.userId]
  );

  // the stored gender is the fallback for a blank or unrecognised answer
  const draft = readDraft(formData, current?.gender ?? "male");
  const fieldErrors = checkProfile(draft);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: "Some details are missing or invalid. Please review the highlighted fields.",
      fields: fieldErrors,
    };
  }

  try {
    await run(
      `update profiles set
        full_name = ?, gender = ?, date_of_birth = ?, age = ?, height = ?, marital_status = ?,
        religion = ?, community = ?, caste = ?, mother_tongue = ?, education = ?, college = ?,
        profession = ?, company = ?, income = ?, country = ?, state = ?, district = ?, city = ?,
        about = ?,
        father_occupation = ?, mother_occupation = ?, brother_count = ?, sister_count = ?,
        family_type = ?, family_location = ?, family_values = ?, gotra = ?, horoscope_required = ?,
        diet = ?, smoking = ?, drinking = ?, hobbies = ?, fitness = ?, sports = ?, music = ?,
        food = ?, appearances = ?,
        min_age = ?, max_age = ?, min_height = ?, max_height = ?,
        pref_religion = ?, pref_mother_tongues = ?, pref_communities = ?, pref_education = ?,
        pref_professions = ?, pref_locations = ?, pref_marital_statuses = ?,
        pref_diet = ?, pref_smoking = ?, pref_drinking = ?, pref_income = ?,
        updated_at = now()
      where user_id = ?`,
      [
        draft.fullName.trim(),
        draft.gender,
        draft.dateOfBirth || null,
        ageFromDob(draft.dateOfBirth),
        draft.height,
        draft.maritalStatus,
        resolveChoice(draft.religion, draft.religionOther) || null,
        resolveChoice(draft.community, draft.communityOther) || null,
        draft.caste.trim() || null,
        resolveChoice(draft.motherTongue, draft.motherTongueOther) || null,
        resolveChoice(draft.education, draft.educationOther) || null,
        text(formData, "college").trim() || null,
        resolveChoice(draft.profession, draft.professionOther) || null,
        draft.company.trim() || null,
        draft.income || null,
        draft.country || "India",
        draft.state || null,
        draft.district || null,
        draft.city.trim() || null,
        draft.about.trim() || null,
        draft.fatherOccupation.trim() || null,
        draft.motherOccupation.trim() || null,
        Number(draft.brotherCount) || 0,
        Number(draft.sisterCount) || 0,
        draft.familyType,
        draft.familyLocation.trim() || null,
        draft.familyValues.trim() || null,
        draft.gotra.trim() || null,
        draft.horoscopeRequired === "yes" ? 1 : 0,
        draft.diet,
        draft.smoking,
        draft.drinking,
        JSON.stringify(draft.hobbies),
        draft.fitness.trim() || null,
        draft.sports.trim() || null,
        draft.music.trim() || null,
        draft.food.trim() || null,
        draft.appearances.trim() || null,
        Number(draft.prefMinAge),
        Number(draft.prefMaxAge),
        Number(draft.prefMinHeight),
        Number(draft.prefMaxHeight),
        resolveChoice(draft.prefReligion, draft.prefReligionOther) || null,
        JSON.stringify(draft.prefMotherTongues),
        JSON.stringify(draft.prefCommunities),
        JSON.stringify(draft.prefEducations),
        JSON.stringify(draft.prefProfessions),
        JSON.stringify(draft.prefLocations),
        JSON.stringify(draft.prefMaritalStatuses),
        draft.prefDiet || null,
        draft.prefSmoking || null,
        draft.prefDrinking || null,
        draft.prefIncome || null,
        member.userId,
      ]
    );
  } catch (error) {
    return { ok: false, error: `Could not save your profile: ${error instanceof Error ? error.message : "unknown error"}` };
  }

  // users.name is what the greeting and the auth provider read, so it follows
  // the profile rather than being left pointing at the name given at sign-up
  await run("update users set name = ? where user_id = ?", [draft.fullName.trim(), member.userId]);

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

  // the photos table keys on the row uuid rather than the public profile_id
  const profileUuid = member.profileUuid;
  if (!profileUuid) return { ok: false, error: "Could not load your profile: no profile row" };

  const current = await q<{ id: string; sort_order: number }>(
    "select id, sort_order from profile_photos where profile_id = ?",
    [profileUuid]
  );

  const incoming = (formData.getAll("photos") as (string | File)[]).filter(
    (entry): entry is File => entry instanceof File && entry.size > 0
  );

  if (incoming.length === 0) return { ok: false, error: "Choose at least one photo to add." };
  // the cap is the member's plan quota, not the site-wide constant: free keeps
  // 1, silver 5, premium 10. admins use a different action and are unaffected.
  const { photos: quota } = await resolveMemberLimits(member.userId);
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
  const uploadedKeys: { bucket: string; key: string }[] = [];

  for (const [index, photo] of incoming.entries()) {
    const key = `${member.profileId}/${nextOrder + index + 1}-${randomUUID().slice(0, 8)}.${PHOTO_EXTENSIONS[photo.type] ?? "jpg"}`;
    try {
      const url = await saveUpload(PHOTO_BUCKET, key, photo, photo.type);
      uploadedKeys.push({ bucket: PHOTO_BUCKET, key });
      await run(
        "insert into profile_photos (profile_id, url, is_primary, sort_order) values (?, ?, ?, ?)",
        [profileUuid, url, current.length === 0 && index === 0 ? 1 : 0, nextOrder + index + 1]
      );
    } catch (error) {
      for (const previous of uploadedKeys) await deleteUpload(previous.bucket, previous.key);
      return { ok: false, error: `Could not upload photo ${index + 1}: ${error instanceof Error ? error.message : "failed"}` };
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

  // resolved through the member's own row first, so a photo id belonging to
  // somebody else cannot be reached
  const profileUuid = member.profileUuid;
  if (!profileUuid) return { ok: false, error: "Could not load your profile." };

  const found = await q1<{ id: string; url: string; is_primary: number }>(
    "select id, url, is_primary from profile_photos where id = ? and profile_id = ?",
    [photoId, profileUuid]
  );
  if (!found) return { ok: false, error: "That photo is no longer on your profile." };

  await run("delete from profile_photos where id = ?", [found.id]);

  // the stored file is best-effort: the row is the thing the app reads, so a
  // failed delete leaves an orphan file rather than a broken profile
  const parsed = parseUploadUrl(found.url);
  if (parsed) await deleteUpload(parsed.bucket, parsed.key);

  // the next photo by sort order takes over as primary, otherwise the profile is
  // left holding photos with none of them marked as the one to show
  if (found.is_primary) {
    const next = await q1<{ id: string }>(
      "select id from profile_photos where profile_id = ? order by sort_order limit 1",
      [profileUuid]
    );
    if (next) await run("update profile_photos set is_primary = 1 where id = ?", [next.id]);
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

  const profileUuid = member.profileUuid;
  if (!profileUuid) return { ok: false, error: "Could not load your profile." };

  const owned = await q1(
    "select id from profile_photos where id = ? and profile_id = ?",
    [photoId, profileUuid]
  );
  if (!owned) return { ok: false, error: "That photo is not on your profile." };

  await run("update profile_photos set is_primary = 0 where profile_id = ?", [profileUuid]);
  await run("update profile_photos set is_primary = 1 where id = ?", [photoId]);

  revalidateMemberPaths();
  return { ok: true };
}

/**
 * The member's photo quota for display. The upload action re-resolves it on
 * every call, so this is display-only and a stale answer here can never grant
 * an extra slot.
 */
export async function getPhotoQuota(): Promise<number> {
  try {
    const member = await assertMember();
    return (await resolveMemberLimits(member.userId)).photos;
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
