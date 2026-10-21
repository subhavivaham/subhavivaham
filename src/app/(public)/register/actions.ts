"use server";

// self-service registration. one action, called once when the member finishes
// the five step wizard, and it is the only place that writes a new member.
//
// order matters here and follows the foreign keys: the users row first, then
// profiles, then photos. everything except the photo files runs inside one
// transaction so a failure cannot leave a half-registered member.
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { tx } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth/session";
import { saveUpload, deleteUpload } from "@/lib/uploads";
import {
  INDIAN_STATES,
  MAX_PHOTO_BYTES,
  MIN_PHOTOS,
  PHOTO_BUCKET,
  PHOTO_TYPES,
  photoExtension,
  photoSizeError,
  EDUCATION_OPTIONS,
} from "@/lib/constants";
import { resolvePlanLimits } from "@/lib/payments/quotas";
import { sendMemberConfirmationEmail, sendMemberRegistrationEmail } from "@/features/services/notify";
import {
  REGISTRATION_TEXT_FIELDS,
  ageFromDob,
  initialRegistrationDraft,
  resolveChoice,
  validateRegistrationStep,
  type RegistrationDraft,
  type RegistrationErrors,
} from "@/lib/registration";

export type RegisterResult =
  | { ok: true; profileId: string }
  | { ok: false; error: string; fields?: RegistrationErrors };

function newId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function readDraft(formData: FormData): RegistrationDraft {
  const draft: RegistrationDraft = { ...initialRegistrationDraft };
  for (const key of REGISTRATION_TEXT_FIELDS) {
    const value = formData.get(key);
    if (typeof value === "string") draft[key] = value;
  }
  const height = Number(formData.get("height"));
  if (Number.isFinite(height) && height > 0) draft.height = height;

  const prefMinHeight = Number(formData.get("prefMinHeight"));
  if (Number.isFinite(prefMinHeight) && prefMinHeight > 0) draft.prefMinHeight = String(prefMinHeight);

  const prefMaxHeight = Number(formData.get("prefMaxHeight"));
  if (Number.isFinite(prefMaxHeight) && prefMaxHeight > 0) draft.prefMaxHeight = String(prefMaxHeight);

  // pref_locations is stored as json, so the selected states are read with
  // getAll and intersected with the known list.
  draft.prefLocations = (formData
    .getAll("prefLocations") as (string | File)[])
    .filter(
      (value): value is string =>
        typeof value === "string" && (INDIAN_STATES as readonly string[]).includes(value)
    );
  // hobbies is also json, but typed free text, so it is capped and
  // length-limited instead of intersected against a known list.
  draft.hobbies = (formData
    .getAll("hobbies") as (string | File)[])
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .map((value) => value.trim().slice(0, 40))
    .slice(0, 12);

  draft.prefMotherTongues = (formData
    .getAll("prefMotherTongues") as (string | File)[])
    .filter((value): value is string => typeof value === "string" && value.trim() !== "");

  draft.prefCommunities = (formData
    .getAll("prefCommunities") as (string | File)[])
    .filter((value): value is string => typeof value === "string" && value.trim() !== "");

  draft.prefEducations = (formData
    .getAll("prefEducations") as (string | File)[])
    .filter(
      (value): value is string =>
        typeof value === "string" && (EDUCATION_OPTIONS as readonly string[]).includes(value)
    );

  draft.prefProfessions = (formData
    .getAll("prefProfessions") as (string | File)[])
    .filter((value): value is string => typeof value === "string" && value.trim() !== "");

  draft.prefMaritalStatuses = (formData
    .getAll("prefMaritalStatuses") as (string | File)[])
    .filter((value): value is string => typeof value === "string" && ["single", "divorced", "widowed"].includes(value));

  return draft;
}

function readPhotos(formData: FormData): File[] {
  return formData
    .getAll("photos")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

// the type and size rules, enforced again here because the client copy of them
// is only a courtesy
function validatePhotos(photos: File[], freePhotoLimit: number): string | null {
  if (photos.length < MIN_PHOTOS)
    return `Add at least ${MIN_PHOTOS} photo so members can see you.`;
  if (photos.length > freePhotoLimit) return `You can add at most ${freePhotoLimit} photo to start with.`;
  for (const photo of photos) {
    if (!(PHOTO_TYPES as readonly string[]).includes(photo.type))
      return "Photos must be JPEG, PNG or WebP.";
    if (photo.size > MAX_PHOTO_BYTES) return photoSizeError(photo.size);
  }
  return null;
}

function checkAllSteps(
  draft: RegistrationDraft,
  photoCount: number,
  freePhotoLimit: number
): RegistrationErrors {
  return [1, 2, 3, 4, 5, 6, 7, 8].reduce<RegistrationErrors>(
    (all, step) => ({ ...all, ...validateRegistrationStep(step, draft, photoCount, freePhotoLimit) }),
    {}
  );
}

export async function registerMember(formData: FormData): Promise<RegisterResult> {
  const draft = readDraft(formData);
  const photos = readPhotos(formData);

  // the registration photo cap is the free plan's limit, read live from the
  // plan row so an admin edit applies to new sign-ups too
  const { photos: freePhotoLimit } = await resolvePlanLimits("free");
  const fieldErrors = checkAllSteps(draft, photos.length, freePhotoLimit);
  const photoError = validatePhotos(photos, freePhotoLimit);
  if (photoError) fieldErrors.photos = photoError;

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: "Some details are missing or invalid. Please review the highlighted fields.",
      fields: fieldErrors,
    };
  }

  const email = draft.email.trim().toLowerCase();
  const phone = draft.mobile.replace(/[\s+-]/g, "");
  const passwordHash = hashPassword(draft.password);

  const now = new Date();
  const nowSql = now.toISOString().slice(0, 19).replace("T", " ");
  const userId = newId("user");
  const profileId = newId("p");
  const profileUuid = randomUUID();

  // the community the member picked, resolved once
  const community = resolveChoice(draft.community, draft.communityOther) || null;

  try {
    await tx(async (db) => {
      // checked before the insert, and the unique indexes still hold on top
      const [emailTaken, phoneTaken] = await Promise.all([
        db.q1("select 1 from users where email = ? limit 1", [email]),
        phone ? db.q1("select 1 from users where phone_number = ? limit 1", [phone]) : Promise.resolve(null),
      ]);
      if (emailTaken) throw new RegistrationFieldError("email", "An account with this email already exists. Try logging in instead.");
      if (phoneTaken) throw new RegistrationFieldError("mobile", "This mobile number is already registered with another profile.");

      try {
        await db.run(
          "insert into users (user_id, auth_user_id, name, email, role, status, phone_number, password_hash, joined_at) " +
            "values (?, ?, ?, ?, 'member', 'active', ?, ?, ?)",
          [userId, userId, draft.fullName.trim(), email, phone, passwordHash, nowSql]
        );
      } catch (error) {
        // translate the unique index instead of surfacing a raw mysql message
        const message = error instanceof Error ? error.message : "";
        if (/idx_users_email|email/i.test(message)) {
          throw new RegistrationFieldError("email", "An account with this email already exists. Try logging in instead.");
        }
        if (/idx_users_phone|phone/i.test(message)) {
          throw new RegistrationFieldError("mobile", "This mobile number is already registered with another profile.");
        }
        throw error;
      }

      await db.run(
        `insert into profiles (
          id, profile_id, user_id, full_name, gender, date_of_birth, age, height, marital_status,
          religion, community, caste, mother_tongue, education, profession, company, income,
          country, state, district, city, about, verified, status, online, last_active,
          profile_created_on, updated_at,
          father_occupation, mother_occupation, brother_count, sister_count, family_type,
          family_location, family_values, gotra, horoscope_required,
          diet, smoking, drinking, hobbies, fitness, sports, music, food, appearances,
          min_age, max_age, min_height, max_height,
          pref_religion, pref_mother_tongues, pref_communities, pref_education, pref_professions,
          pref_locations, pref_marital_statuses, pref_diet, pref_smoking, pref_drinking, pref_income
        ) values (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, 0, 'inactive', 0, ?,
          ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        )`,
        [
          profileUuid,
          profileId,
          userId,
          draft.fullName.trim(),
          draft.gender,
          draft.dateOfBirth || null,
          ageFromDob(draft.dateOfBirth),
          draft.height,
          draft.maritalStatus,
          resolveChoice(draft.religion, draft.religionOther) || null,
          community,
          draft.caste.trim() || null,
          resolveChoice(draft.motherTongue, draft.motherTongueOther) || null,
          resolveChoice(draft.education, draft.educationOther) || null,
          resolveChoice(draft.profession, draft.professionOther) || null,
          draft.company || null,
          draft.income || null,
          draft.country,
          draft.state || null,
          draft.district || null,
          draft.city.trim() || null,
          draft.about.trim() || null,
          nowSql,
          nowSql.slice(0, 10),
          nowSql,
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
        ]
      );
      return profileUuid;
    });
  } catch (error) {
    if (error instanceof RegistrationFieldError) {
      return {
        ok: false,
        error: "Some details are missing or invalid. Please review the highlighted fields.",
        fields: { [error.field]: error.message },
      };
    }
    return { ok: false, error: `Could not save your profile: ${error instanceof Error ? error.message : "unknown error"}` };
  }

  // first photo is the one the app treats as primary
  const uploaded: string[] = [];
  for (const [index, photo] of photos.entries()) {
    const key = `${profileId}/${index + 1}-${randomUUID().slice(0, 8)}.${photoExtension(photo.type)}`;
    try {
      const url = await saveUpload(PHOTO_BUCKET, key, photo, photo.type);
      uploaded.push(url);
      await tx(async (db) => {
        await db.run(
          "insert into profile_photos (profile_id, url, is_primary, sort_order) values (?, ?, ?, ?)",
          [profileUuid, url, index === 0 ? 1 : 0, index + 1]
        );
      });
    } catch (error) {
      for (const previous of uploaded) {
        const parsed = previous.match(/^\/uploads\/([^/]+)\/(.+)$/);
        if (parsed) await deleteUpload(parsed[1], parsed[2]);
      }
      return { ok: false, error: `Could not upload photo ${index + 1}: ${error instanceof Error ? error.message : "failed"}` };
    }
  }

  // the new row is verified=false / status=inactive, so nothing changes for
  // visitors yet, and invalidating here is what makes the profile appear in the
  // admin queue straight away.
  revalidatePath("/admin/profiles");
  revalidatePath("/dashboard");
  revalidatePath("/brides");
  revalidatePath("/grooms");
  revalidatePath("/search");

  // sign the new member in: the account exists now, so the session cookie can be set
  await createSession(userId);

  // best effort: the member is fully committed, so a mail outage must not turn a
  // successful registration into an error for them.
  const mail = await sendMemberRegistrationEmail({
    fullName: draft.fullName.trim(),
    email,
    mobile: phone,
    gender: draft.gender,
    age: ageFromDob(draft.dateOfBirth),
    dateOfBirth: draft.dateOfBirth || undefined,
    maritalStatus: draft.maritalStatus,
    city: draft.city.trim() || undefined,
    district: draft.district || undefined,
    state: draft.state || undefined,
    community: community ?? undefined,
    religion: resolveChoice(draft.religion, draft.religionOther) || undefined,
    motherTongue: resolveChoice(draft.motherTongue, draft.motherTongueOther) || undefined,
    education: resolveChoice(draft.education, draft.educationOther) || undefined,
    profession: resolveChoice(draft.profession, draft.professionOther) || undefined,
  });
  if (!mail.ok) console.error("Member registration mail failed:", mail.error);

  // separate send so an admin-alert failure cannot swallow the member's own
  // confirmation
  const confirmation = await sendMemberConfirmationEmail(email, draft.fullName.trim());
  if (!confirmation.ok)
    console.error("Member confirmation mail failed:", confirmation.error);

  return { ok: true, profileId };
}

// carries a field-level failure out of the transaction without looking like an
// infrastructure error
class RegistrationFieldError extends Error {
  constructor(
    readonly field: string,
    message: string
  ) {
    super(message);
  }
}
