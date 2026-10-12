"use server";

// self-service registration. one action, called once when the member finishes
// the five step wizard, and it is the only place that writes a new member.
//
// order matters here and follows the foreign keys: the auth user comes first
// (that is what makes auth.uid() meaningful to every policy below), then
// public.users, then profiles, then the two rows that hang off the profile.
// photos go up last because the storage policies key on the profile's public
// profile_id, so the profile has to exist before an upload can pass RLS.
import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
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
import { sendMemberRegistrationEmail } from "@/features/services/notify";
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
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
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
  
  // pref_locations is a text[] column, so the selected states are read with
  // getAll. they are also intersected with the known list: the picker is only a
  // convenience, and an unchecked payload should not widen the column.
  draft.prefLocations = (formData
    .getAll("prefLocations") as (string | File)[])
    .filter(
      (value): value is string =>
        typeof value === "string" && (INDIAN_STATES as readonly string[]).includes(value)
    );
  // hobbies is also a text[] column, but unlike the location picker it is typed
  // free text, so there is no known list to intersect against. it is capped and
  // length-limited instead so one long entry cannot fill the column.
  draft.hobbies = (formData
    .getAll("hobbies") as (string | File)[])
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .map((value) => value.trim().slice(0, 40))
    .slice(0, 12);
  
  // preferred mother tongues
  draft.prefMotherTongues = (formData
    .getAll("prefMotherTongues") as (string | File)[])
    .filter((value): value is string => typeof value === "string" && value.trim() !== "");
  
  // preferred communities
  draft.prefCommunities = (formData
    .getAll("prefCommunities") as (string | File)[])
    .filter((value): value is string => typeof value === "string" && value.trim() !== "");
  
  // preferred education
  draft.prefEducations = (formData
    .getAll("prefEducations") as (string | File)[])
    .filter(
      (value): value is string =>
        typeof value === "string" && (EDUCATION_OPTIONS as readonly string[]).includes(value)
    );
  
  // preferred professions
  draft.prefProfessions = (formData
    .getAll("prefProfessions") as (string | File)[])
    .filter((value): value is string => typeof value === "string" && value.trim() !== "");
  
  // preferred marital statuses
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
  // a new account has no plan yet, so it registers under the free quota. more
  // photos come with a paid plan, added later from the dashboard editor.
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

// supabase reports an unconfirmed account as an ordinary sign-in failure, and
// this text is the only thing that separates it from a wrong password
const NOT_CONFIRMED = /not confirmed/i;

// sign in before sign up on purpose: a member who retries after a half-finished
// first attempt would otherwise be turned away by supabase's "email already
// registered" error.
async function authenticate(
  supabase: Awaited<ReturnType<typeof getSupabaseServer>>,
  email: string,
  password: string
) {
  const first = await supabase.auth.signInWithPassword({ email, password });
  if (first.data?.session && first.data.user) return first.data.user;

  const { data: created, error: signUpError } = await supabase.auth.signUp({ email, password });
  if (created?.session && created.user) return created.user;

  if (/already (been )?registered|already exists/i.test(signUpError?.message ?? "")) {
    // the account is there, so the sign-in above was refused for some reason.
    // retry it, because the member may have confirmed their address in between
    // the two calls.
    const retry = await supabase.auth.signInWithPassword({ email, password });
    if (retry.data?.session && retry.data.user) return retry.data.user;

    // an unconfirmed address can never complete a sign-in, so telling the
    // member to "try logging in" would point them at a dead end
    if (NOT_CONFIRMED.test(retry.error?.message ?? first.error?.message ?? "")) {
      throw new Error(
        "This email already has an account that has not been confirmed yet. Open the confirmation link we sent you, or ask us to clear the account so you can register again."
      );
    }
    throw new Error("An account with this email already exists. Try logging in instead.");
  }

  // no error and no session is the one case left: the project has "confirm
  // email" switched on, so supabase created the user but withheld the session
  // that every policy below is scoped to
  throw new Error(
    "Your account was created but could not be activated, because this site still requires email confirmation. Please contact support."
  );
}

export async function registerMember(formData: FormData): Promise<RegisterResult> {
  const draft = readDraft(formData);
  const photos = readPhotos(formData);
  const supabase = await getSupabaseServer();

  // the registration photo cap is the free plan's limit, read live from the
  // plan row so an admin edit applies to new sign-ups too
  const { photos: freePhotoLimit } = await resolvePlanLimits(supabase, "free");
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

  // checked before authenticating, because creating the auth user is the step
  // that cannot be undone from here: a duplicate discovered afterwards would
  // leave an orphan auth user and a half-registered member. users_read only
  // exposes a member's own row, so the lookup goes through the two
  // security-definer functions, which hand back a boolean and nothing else.
  const [emailTaken, phoneTaken] = await Promise.all([
    supabase.rpc("registration_email_taken", { candidate_email: email }),
    supabase.rpc("registration_phone_taken", { candidate_phone: phone }),
  ]);
  // a null result means the function is not installed yet, which is not a reason
  // to block someone. the unique indexes still reject the insert below.
  if (emailTaken.data) fieldErrors.email = "An account with this email already exists. Try logging in instead.";
  if (phoneTaken.data)
    fieldErrors.mobile = "This mobile number is already registered with another profile.";
  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: "Some details are missing or invalid. Please review the highlighted fields.",
      fields: fieldErrors,
    };
  }

  let authUserId: string;
  try {
    const user = await authenticate(supabase, email, draft.password);
    authUserId = user.id;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not create the account." };
  }

  const now = new Date().toISOString();
  const userId = newId("user");
  const profileId = newId("p");

  const { error: userError } = await supabase.from("users").insert({
    user_id: userId,
    auth_user_id: authUserId,
    name: draft.fullName.trim(),
    email,
    role: "member",
    status: "active",
    phone_number: phone,
    joined_at: now,
  });
  if (userError) {
    // the pre-check above is a courtesy; the unique index is what actually
    // holds, so its violation is translated back onto the right field instead of
    // surfacing a raw postgres message
    if (/idx_users_email/.test(userError.message)) {
      return {
        ok: false,
        error: "Some details are missing or invalid. Please review the highlighted fields.",
        fields: { email: "An account with this email already exists. Try logging in instead." },
      };
    }
    if (/idx_users_phone/.test(userError.message)) {
      return {
        ok: false,
        error: "Some details are missing or invalid. Please review the highlighted fields.",
        fields: { mobile: "This mobile number is already registered with another profile." },
      };
    }
    return { ok: false, error: `Could not save your account: ${userError.message}` };
  }

  // the community the member picked, resolved once: it lands on the profile row
  // and it is the name communities.visible_members is counted against
  const community = resolveChoice(draft.community, draft.communityOther) || null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      profile_id: profileId,
      user_id: userId,
      full_name: draft.fullName.trim(),
      gender: draft.gender,
      date_of_birth: draft.dateOfBirth || null,
      age: ageFromDob(draft.dateOfBirth),
      height: draft.height,
      marital_status: draft.maritalStatus,
      religion: resolveChoice(draft.religion, draft.religionOther) || null,
      community,
      caste: draft.caste.trim() || null,
      mother_tongue: resolveChoice(draft.motherTongue, draft.motherTongueOther) || null,
      education: resolveChoice(draft.education, draft.educationOther) || null,
      profession: resolveChoice(draft.profession, draft.professionOther) || null,
      company: draft.company || null,
      income: draft.income || null,
      country: draft.country,
      state: draft.state || null,
      district: draft.district || null,
      // the city is free text while the district is the value the public search
      // filters on, so they are stored in separate columns.
      city: draft.city.trim() || null,
      about: draft.about.trim() || null,
      // a new profile stays invisible on the public browse pages until an
      // admin verifies it, which is the same state the admin screens create
      verified: false,
      status: "inactive",
      online: false,
      last_active: now,
      profile_created_on: now.slice(0, 10),
      updated_at: now,
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
    })
    .select("id")
    .single();
  if (profileError || !profile) {
    return { ok: false, error: `Could not save your profile: ${profileError?.message ?? "unknown error"}` };
  }
  // the row is committed at this point. communities.visible_members is NOT
  // touched here on purpose: table_policies.sql gates writes to communities on
  // app_metadata.role = 'admin', and this session is the new member, so the
  // update would report success while changing nothing. the trigger in
  // sync_community_member_counts.sql is what keeps that count right for
  // self-service registrations.
  const profileUuid = profile.id as unknown as string;

  // first photo is the one the app treats as primary, matching the
  // is_primary / sort_order convention the admin photo actions write
  const uploaded: string[] = [];
  for (const [index, photo] of photos.entries()) {
    const path = `${profileId}/${index + 1}-${crypto.randomUUID().slice(0, 8)}.${
      photoExtension(photo.type)
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
      is_primary: index === 0,
      sort_order: index + 1,
    });
    if (photoError) {
      await supabase.storage.from(PHOTO_BUCKET).remove(uploaded);
      return { ok: false, error: `Could not save photo ${index + 1}: ${photoError.message}` };
    }
  }

  // the new row is verified=false / status=inactive, so the public pages are
  // revalidated too: nothing should change for visitors yet, and invalidating
  // here is what makes the profile appear in the admin queue straight away.
  revalidatePath("/admin/profiles");
  revalidatePath("/dashboard");
  revalidatePath("/brides");
  revalidatePath("/grooms");
  revalidatePath("/search");

  // best effort, like the vendor alert: the member is fully committed, so a mail
  // outage must not turn a successful registration into an error for them.
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

  return { ok: true, profileId };
}
