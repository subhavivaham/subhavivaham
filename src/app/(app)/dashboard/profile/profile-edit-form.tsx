"use client";

// the editor for the signed-in member's own profile. it writes through the
// server actions beside this file rather than calling supabase from the browser,
// because the row-level security policies are written against the session cookie
// the action carries and a client write would need the same rules re-implemented
// in javascript.
//
// the field list is deliberately the same set the read view renders, in the same
// cards, so a member never has to hunt for where something lives.
import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Star, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckboxGroup, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/lib/state/toast-provider";
import { useAuth } from "@/features/auth/auth-provider";
import { fetchCommunities } from "@/lib/data/queries";
import { addPhotos, getPhotoQuota, makePrimaryPhoto, removePhoto, updateProfile } from "./actions";
import {
  initialRegistrationDraft,
  type RegistrationDraft,
} from "@/lib/registration";
import {
  DIET_OPTIONS,
  DRINKING_OPTIONS,
  EDUCATION_OPTIONS,
  FAMILY_TYPES,
  HEIGHTS,
  INDIAN_STATES,
  INCOME_RANGES,
  MOTHER_TONGUES,
  OTHER,
  RELIGIONS,
  SMOKING_OPTIONS,
  TAMIL_NADU_DISTRICTS,
  PHOTO_ACCEPT,
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  PROFESSION_OPTIONS,
  formatBytes,
} from "@/lib/constants";
import type { Profile, ProfilePhoto } from "@/types";

// the stored row is nested while the database is flat, so the draft is rebuilt
// from the profile rather than round-tripped through a form shape that would
// have to be kept in step with the table by hand
function draftFromProfile(p: Profile): RegistrationDraft {
  // the account and the unused legacy keys start at their defaults: the wizard
  // owns them and this editor never submits them.
  //
  // every "other" companion is seeded with the stored answer on purpose. the
  // wizard resolves an "Other" pick by storing the typed text in the column
  // itself, so the custom answer and the pick are the same value on the row —
  // there is no second place it was kept. seeding the box from that value is
  // what lets a member switch the pick back to "Other" and find their own words
  // already there instead of an empty field to retype.
  return {
    ...initialRegistrationDraft,
    fullName: p.fullName,
    gender: p.gender,
    dateOfBirth: p.dateOfBirth,
    height: p.height,
    maritalStatus: p.maritalStatus,
    religion: p.religion,
    religionOther: p.religion,
    community: p.community,
    communityOther: p.community,
    caste: p.caste ?? "",
    motherTongue: p.motherTongue,
    motherTongueOther: p.motherTongue,
    education: p.education,
    educationOther: p.education,
    profession: p.profession,
    professionOther: p.profession,
    company: p.company,
    income: p.income,
    fatherOccupation: p.family.fatherOccupation,
    motherOccupation: p.family.motherOccupation,
    brotherCount: String(p.family.brotherCount),
    sisterCount: String(p.family.sisterCount),
    familyType: p.family.familyType,
    familyLocation: p.family.familyLocation,
    familyValues: p.family.familyValues,
    gotra: p.family.gotra ?? "",
    horoscopeRequired: p.family.horoscopeRequired ? "yes" : "no",
    diet: p.lifestyle.diet,
    smoking: p.lifestyle.smoking,
    drinking: p.lifestyle.drinking,
    hobbies: p.lifestyle.hobbies,
    fitness: p.lifestyle.fitness,
    sports: p.lifestyle.sports,
    music: p.lifestyle.music,
    food: p.lifestyle.food,
    appearances: p.lifestyle.appearances,
    country: p.country,
    state: p.state,
    district: p.district ?? "",
    city: p.city,
    about: p.about,
    prefMinAge: String(p.preference.minAge),
    prefMaxAge: String(p.preference.maxAge),
    prefMinHeight: String(p.preference.minHeight),
    prefMaxHeight: String(p.preference.maxHeight),
    prefReligion: p.preference.religion,
    prefReligionOther: p.preference.religion,
    prefMotherTongues: p.preference.motherTongues,
    prefCommunities: p.preference.communities,
    prefEducations: p.preference.education,
    prefProfessions: p.preference.professions,
    prefLocations: p.preference.locations,
    prefMaritalStatuses: p.preference.maritalStatuses,
    prefDiet: p.preference.diet,
    prefSmoking: p.preference.smoking,
    prefDrinking: p.preference.drinking,
    prefIncome: p.preference.income ?? "",
  };
}

// a stored value that is no longer in the option list would silently drop the
// member's own answer, so it is prepended to the choices rather than replaced.
// this is the "Other" case in practice: the wizard stores the typed text in the
// column, so a custom religion or community is a value the list does not hold,
// and rendering the select without it would show a blank "Select" over an
// answer the member can plainly see on their profile.
function withCurrent(options: readonly string[], value: string): readonly string[] {
  if (!value || options.includes(value)) return options;
  return [value, ...options];
}

// family and lifestyle are stored as slugs, so those lists carry a value/label
// pair rather than plain strings
type SlugOption = { readonly value: string; readonly label: string };

function withCurrentSlug(
  options: readonly SlugOption[],
  value: string
): readonly SlugOption[] {
  if (!value || options.some((o) => o.value === value)) return options;
  return [{ value, label: value }, ...options];
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-charcoal-100 bg-white p-6 shadow-card sm:p-7">
      <h2 className="mb-5 font-display text-xl font-semibold text-charcoal-900">{title}</h2>
      {children}
    </section>
  );
}

// every draft key the shared step validation can report on, with the name the
// member sees. the footer lists these, so a rule that fires on a field the
// editor happens not to render still names the answer it is asking for instead
// of only saying that something, somewhere, is wrong.
const FIELD_LABELS: Partial<Record<string, string>> = {
  fullName: "Full name",
  gender: "Gender",
  dateOfBirth: "Date of birth",
  religion: "Religion",
  religionOther: "Religion",
  communityOther: "Community",
  motherTongue: "Mother tongue",
  motherTongueOther: "Mother tongue",
  education: "Education",
  educationOther: "Education",
  profession: "Profession",
  professionOther: "Profession",
  familyType: "Family type",
  brotherCount: "Brothers",
  sisterCount: "Sisters",
  diet: "Diet",
  smoking: "Smoking",
  drinking: "Drinking",
  district: "District",
  city: "City",
  about: "About you",
  prefMinAge: "Minimum age",
  prefMaxAge: "Maximum age",
  prefReligionOther: "Preferred religion",
  prefProfessionOther: "Preferred profession",
  photos: "Photos",
};

const toggle = (list: readonly string[], value: string): string[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

export function ProfileEditForm({
  profile,
  reload,
  onCancel,
}: {
  profile: Profile;
  // the page refetches through this after every write. router.refresh alone
  // would not help here: the profile this form renders from was fetched on the
  // client, so the server re-render leaves it untouched and the editor would
  // keep showing the values it was just asked to change.
  reload: () => Promise<Profile | undefined>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<RegistrationDraft>(() => draftFromProfile(profile));
  // college is a column the admin screens write but the register wizard never
  // asked for, so it has no draft key to travel in
  const [college, setCollege] = useState(profile.college);
  const [photos, setPhotos] = useState<ProfilePhoto[]>(profile.photos);
  // the same database list the register wizard offers, read the same way. the
  // register page is a server component and awaits it before rendering; this one
  // is client side, so it is fetched here — only once the editor is open, since
  // the read view has no dropdown to fill.
  const [communityNames, setCommunityNames] = useState<readonly string[]>([]);
  // the member's photo quota, read once with the same action family that
  // enforces it. null until it arrives, and the display falls back to the
  // site-wide constant meanwhile so nothing flashes a wrong number.
  const [photoQuota, setPhotoQuota] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getPhotoQuota().then((quota) => {
      if (!cancelled) setPhotoQuota(quota);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  // the account columns, shown so the wizard's first step is represented here too.
  // they are not editable: email, mobile and password are auth concerns, and a
  // change submitted through a plain form is how an account gets locked out.
  const { user } = useAuth();
  useEffect(() => {
    let cancelled = false;

    void fetchCommunities().then((rows) => {
      if (cancelled) return;
      setCommunityNames(
        rows
          .filter((community) => community.active)
          .map((community) => community.name)
          .sort((a, b) => a.localeCompare(b))
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [banner, setBanner] = useState("");
  const [busy, startTransition] = useTransition();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [failed, setFailed] = useState<readonly string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();

  const set = <K extends keyof RegistrationDraft>(key: K, value: RegistrationDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBanner("");
    setErrors({});
    setFailed([]);

    const formData = new FormData(event.currentTarget);
    // the multi-value fields are not inputs, so they are appended by hand
    for (const value of draft.hobbies) formData.append("hobbies", value);
    for (const value of draft.prefLocations) formData.append("prefLocations", value);
    for (const value of draft.prefMotherTongues) formData.append("prefMotherTongues", value);
    for (const value of draft.prefCommunities) formData.append("prefCommunities", value);
    for (const value of draft.prefEducations) formData.append("prefEducations", value);
    for (const value of draft.prefProfessions) formData.append("prefProfessions", value);
    for (const value of draft.prefMaritalStatuses) formData.append("prefMaritalStatuses", value);

    startTransition(async () => {
      try {
        const result = await updateProfile(formData);
        if (result.ok) {
          toast("Profile saved.");
          // pull the saved row back before leaving the editor, so the read view
          // behind it renders the new values and not the ones it was opened with
          await reload();
          onCancel();
          return;
        }
        setBanner(result.error);
        setErrors((result.fields ?? {}) as Record<string, string | undefined>);
        setFailed(Object.keys(result.fields ?? {}));
        // the footer is always on screen, so the first thing named there is
        // scrolled to — the member is looking at the bottom of a long form when
        // they hit save, not at the top of it
        const first = Object.keys(result.fields ?? {})[0];
        if (first) focusField(first);
      } catch {
        setBanner("Could not reach the server. Please try again.");
        setFailed([]);
      }
    });
  };

  // the form mirrors the wizard's field set one for one now, so every key the
  // validation can report on has a control to jump to
  const focusField = (name: string) => {
    const target = formRef.current?.querySelector<HTMLElement>(`[name="${name}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.focus({ preventScroll: true });
  };

  const uploadPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (const file of Array.from(files)) formData.append("photos", file);
    // the input is cleared so picking the same file again still fires a change
    event.target.value = "";

    setPhotoBusy(true);
    try {
      const result = await addPhotos(formData);
      if (result.ok) {
        toast("Photos added.");
        await syncPhotos();
      } else {
        toast(result.error, "error");
      }
    } catch {
      toast("Could not reach the server. Please try again.", "error");
    } finally {
      setPhotoBusy(false);
    }
  };

  // the photo grid is client state, so it is refetched rather than refreshed
  const syncPhotos = async () => {
    const fresh = await reload();
    if (fresh) setPhotos(fresh.photos);
    router.refresh();
  };

  const runPhotoAction = async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setPhotoBusy(true);
    try {
      const result = await action();
      if (result.ok) await syncPhotos();
      else toast(result.error ?? "Could not update that photo.", "error");
    } catch {
      toast("Could not reach the server. Please try again.", "error");
    } finally {
      setPhotoBusy(false);
    }
  };

  const room = (photoQuota ?? MAX_PHOTOS) - photos.length;

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-6">
      <Card title="Account">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Email"
            value={user?.email ?? ""}
            readOnly
            disabled
            hint="Your login id. Contact support to change it."
          />
          <Input
            label="Mobile number"
            value={user?.mobile ?? ""}
            readOnly
            disabled
            hint="Used for match alerts only, never shown publicly."
          />
          <Input
            label="Password"
            value="••••••••"
            readOnly
            disabled
            hint="Stored as a hash and never displayed. Use the sign-in page to reset it."
          />
        </div>
      </Card>

      <Card title="Photos">
        <div className="flex flex-wrap gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative">
              <div className="relative h-32 w-24 overflow-hidden rounded-2xl bg-charcoal-100">
                <Image src={photo.url} alt="" fill sizes="96px" className="object-cover" />
              </div>
              {photo.isPrimary ? (
                <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-charcoal-950/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                  <Star className="h-3 w-3" /> Main
                </span>
              ) : (
                <button
                  type="button"
                  disabled={photoBusy}
                  onClick={() => runPhotoAction(() => makePrimaryPhoto(photo.id))}
                  className="absolute bottom-1.5 left-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-charcoal-700 hover:bg-white"
                >
                  Make main
                </button>
              )}
              <button
                type="button"
                aria-label="Remove photo"
                disabled={photoBusy}
                onClick={() => runPhotoAction(() => removePhoto(photo.id))}
                className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-charcoal-700 hover:bg-white hover:text-wine-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {room > 0 && (
            <button
              type="button"
              disabled={photoBusy}
              onClick={() => fileRef.current?.click()}
              className="flex h-32 w-24 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-charcoal-300 text-charcoal-500 transition-colors hover:border-wine-400 hover:text-wine-700"
            >
              <Upload className="h-5 w-5" />
              <span className="text-xs font-medium">Add photo</span>
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={PHOTO_ACCEPT}
          multiple
          onChange={uploadPhotos}
          className="hidden"
        />
        <p className="mt-3 text-xs text-charcoal-400">
          {room > 0
            ? `You can add ${room} more photo${room === 1 ? "" : "s"}. JPEG, PNG or WebP, up to ${formatBytes(MAX_PHOTO_BYTES)} each.`
            : "You have the maximum number of photos."}
        </p>
      </Card>

      <Card title="Basic Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Full name"
            name="fullName"
            defaultValue={draft.fullName}
            error={errors.fullName}
            onChange={(e) => set("fullName", e.target.value)}
          />
          <Select
            label="I am a"
            name="gender"
            defaultValue={draft.gender}
            error={errors.gender}
            onChange={(e) => set("gender", e.target.value)}
          >
            <option value="">Select</option>
            <option value="female">Bride</option>
            <option value="male">Groom</option>
          </Select>
          <Input
            label="Date of birth"
            name="dateOfBirth"
            type="date"
            defaultValue={draft.dateOfBirth}
            error={errors.dateOfBirth}
            onChange={(e) => set("dateOfBirth", e.target.value)}
          />
          <Select
            label="Height"
            name="height"
            defaultValue={String(draft.height)}
            onChange={(e) => set("height", Number(e.target.value))}
          >
            {HEIGHTS.map((h) => (
              <option key={h} value={h}>
                {h} cm
              </option>
            ))}
          </Select>
          <Select
            label="Marital status"
            name="maritalStatus"
            defaultValue={draft.maritalStatus}
            onChange={(e) => set("maritalStatus", e.target.value)}
          >
            <option value="">Select</option>
            {["single", "divorced", "widowed"].map((v) => (
              <option key={v} value={v}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </option>
            ))}
          </Select>
          <Select
            label="Religion"
            name="religion"
            defaultValue={draft.religion}
            error={errors.religion}
            onChange={(e) => set("religion", e.target.value)}
          >
            <option value="">Select</option>
            {withCurrent(RELIGIONS, draft.religion).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
          {draft.religion === OTHER && (
            <Input
              label="Your religion"
              name="religionOther"
              defaultValue={draft.religionOther}
              error={errors.religionOther}
              onChange={(e) => set("religionOther", e.target.value)}
            />
          )}
          <Select
            label="Community"
            name="community"
            defaultValue={draft.community}
            error={errors.community}
            onChange={(e) => set("community", e.target.value)}
          >
            <option value="">Select</option>
            {withCurrent(communityNames, draft.community).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
            <option value={OTHER}>{OTHER}</option>
          </Select>
          {draft.community === OTHER && (
            <Input
              label="Your community"
              name="communityOther"
              defaultValue={draft.communityOther}
              error={errors.communityOther}
              onChange={(e) => set("communityOther", e.target.value)}
            />
          )}
          <Input
            label="Caste"
            name="caste"
            defaultValue={draft.caste}
            onChange={(e) => set("caste", e.target.value)}
          />
          <Select
            label="Mother tongue"
            name="motherTongue"
            defaultValue={draft.motherTongue}
            error={errors.motherTongue}
            onChange={(e) => set("motherTongue", e.target.value)}
          >
            <option value="">Select</option>
            {withCurrent(MOTHER_TONGUES, draft.motherTongue).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
          {draft.motherTongue === OTHER && (
            <Input
              label="Your mother tongue"
              name="motherTongueOther"
              defaultValue={draft.motherTongueOther}
              error={errors.motherTongueOther}
              onChange={(e) => set("motherTongueOther", e.target.value)}
            />
          )}
        </div>
      </Card>

      <Card title="Education & Career">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Education"
            name="education"
            defaultValue={draft.education}
            error={errors.education}
            onChange={(e) => set("education", e.target.value)}
          >
            <option value="">Select</option>
            {withCurrent(EDUCATION_OPTIONS, draft.education).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
          {draft.education === OTHER && (
            <Input
              label="Your qualification"
              name="educationOther"
              defaultValue={draft.educationOther}
              error={errors.educationOther}
              onChange={(e) => set("educationOther", e.target.value)}
            />
          )}
          <Input
            label="College / University"
            name="college"
            value={college}
            onChange={(e) => setCollege(e.target.value)}
          />
          <Select
            label="Profession"
            name="profession"
            defaultValue={draft.profession}
            error={errors.profession}
            onChange={(e) => set("profession", e.target.value)}
          >
            <option value="">Select</option>
            {withCurrent(PROFESSION_OPTIONS, draft.profession).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
          {draft.profession === OTHER && (
            <Input
              label="Your profession"
              name="professionOther"
              placeholder="e.g. Marine Biologist"
              defaultValue={draft.professionOther}
              error={errors.professionOther}
              onChange={(e) => set("professionOther", e.target.value)}
            />
          )}
          <Input
            label="Company"
            name="company"
            defaultValue={draft.company}
            onChange={(e) => set("company", e.target.value)}
          />
          <Select
            label="Annual income"
            name="income"
            defaultValue={draft.income}
            onChange={(e) => set("income", e.target.value)}
          >
            <option value="">Select</option>
            {withCurrent(INCOME_RANGES, draft.income).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card title="Location & About">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Country"
            name="country"
            defaultValue={draft.country}
            onChange={(e) => set("country", e.target.value)}
          />
          <Select
            label="State"
            name="state"
            defaultValue={draft.state}
            onChange={(e) => set("state", e.target.value)}
          >
            <option value="">Select</option>
            {withCurrent(INDIAN_STATES, draft.state).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
          <Select
            label="District"
            name="district"
            defaultValue={draft.district}
            error={errors.district}
            onChange={(e) => set("district", e.target.value)}
          >
            <option value="">Select</option>
            {withCurrent(TAMIL_NADU_DISTRICTS, draft.district).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
          <Input
            label="City"
            name="city"
            defaultValue={draft.city}
            error={errors.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </div>
        <div className="mt-4">
          <Textarea
            label="About"
            name="about"
            defaultValue={draft.about}
            error={errors.about}
            hint={`${draft.about.trim().length} characters. 300 or more gets your profile seen.`}
            onChange={(e) => set("about", e.target.value)}
            className="min-h-[180px]"
          />
        </div>
      </Card>

      <Card title="Family Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Father's occupation"
            name="fatherOccupation"
            defaultValue={draft.fatherOccupation}
            onChange={(e) => set("fatherOccupation", e.target.value)}
          />
          <Input
            label="Mother's occupation"
            name="motherOccupation"
            defaultValue={draft.motherOccupation}
            onChange={(e) => set("motherOccupation", e.target.value)}
          />
          <Input
            label="Brothers"
            name="brotherCount"
            type="number"
            min={0}
            defaultValue={draft.brotherCount}
            error={errors.brotherCount}
            onChange={(e) => set("brotherCount", e.target.value)}
          />
          <Input
            label="Sisters"
            name="sisterCount"
            type="number"
            min={0}
            defaultValue={draft.sisterCount}
            error={errors.sisterCount}
            onChange={(e) => set("sisterCount", e.target.value)}
          />
          <Select
            label="Family type"
            name="familyType"
            defaultValue={draft.familyType}
            error={errors.familyType}
            onChange={(e) => set("familyType", e.target.value)}
          >
            <option value="">Select</option>
            {withCurrentSlug(FAMILY_TYPES, draft.familyType).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input
            label="Family location"
            name="familyLocation"
            defaultValue={draft.familyLocation}
            onChange={(e) => set("familyLocation", e.target.value)}
          />
          <Input
            label="Family values"
            name="familyValues"
            defaultValue={draft.familyValues}
            onChange={(e) => set("familyValues", e.target.value)}
          />
          <Input
            label="Gotra"
            name="gotra"
            defaultValue={draft.gotra}
            onChange={(e) => set("gotra", e.target.value)}
          />
          <Select
            label="Horoscope required"
            name="horoscopeRequired"
            defaultValue={draft.horoscopeRequired}
            onChange={(e) => set("horoscopeRequired", e.target.value)}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </Select>
        </div>
      </Card>

      <Card title="Lifestyle">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Diet"
            name="diet"
            defaultValue={draft.diet}
            error={errors.diet}
            onChange={(e) => set("diet", e.target.value)}
          >
            <option value="">Select</option>
            {withCurrentSlug(DIET_OPTIONS, draft.diet).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            label="Drinking"
            name="drinking"
            defaultValue={draft.drinking}
            error={errors.drinking}
            onChange={(e) => set("drinking", e.target.value)}
          >
            <option value="">Select</option>
            {withCurrentSlug(DRINKING_OPTIONS, draft.drinking).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            label="Smoking"
            name="smoking"
            defaultValue={draft.smoking}
            error={errors.smoking}
            onChange={(e) => set("smoking", e.target.value)}
          >
            <option value="">Select</option>
            {withCurrentSlug(SMOKING_OPTIONS, draft.smoking).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input
            label="Fitness"
            name="fitness"
            defaultValue={draft.fitness}
            onChange={(e) => set("fitness", e.target.value)}
          />
          <Input
            label="Sports"
            name="sports"
            defaultValue={draft.sports}
            onChange={(e) => set("sports", e.target.value)}
          />
          <Input
            label="Music"
            name="music"
            defaultValue={draft.music}
            onChange={(e) => set("music", e.target.value)}
          />
          <Input
            label="Food"
            name="food"
            defaultValue={draft.food}
            onChange={(e) => set("food", e.target.value)}
          />
          <Input
            label="Appearances"
            name="appearances"
            defaultValue={draft.appearances}
            onChange={(e) => set("appearances", e.target.value)}
          />
        </div>
        <div className="mt-4">
          <TagPicker
            label="Hobbies"
            placeholder="Reading, classical dance, trekking…"
            values={draft.hobbies}
            onChange={(next) => set("hobbies", next)}
          />
        </div>
      </Card>

      <Card title="Partner Preference">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Minimum age"
            name="prefMinAge"
            type="number"
            min={18}
            defaultValue={draft.prefMinAge}
            error={errors.prefMinAge}
            onChange={(e) => set("prefMinAge", e.target.value)}
          />
          <Input
            label="Maximum age"
            name="prefMaxAge"
            type="number"
            min={18}
            defaultValue={draft.prefMaxAge}
            error={errors.prefMaxAge}
            onChange={(e) => set("prefMaxAge", e.target.value)}
          />
          <Input
            label="Minimum height (cm)"
            name="prefMinHeight"
            type="number"
            defaultValue={draft.prefMinHeight}
            onChange={(e) => set("prefMinHeight", e.target.value)}
          />
          <Input
            label="Maximum height (cm)"
            name="prefMaxHeight"
            type="number"
            defaultValue={draft.prefMaxHeight}
            onChange={(e) => set("prefMaxHeight", e.target.value)}
          />
          <Select
            label="Preferred religion"
            name="prefReligion"
            defaultValue={draft.prefReligion}
            onChange={(e) => set("prefReligion", e.target.value)}
          >
            <option value="">Any</option>
            {withCurrent(RELIGIONS, draft.prefReligion).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
          {draft.prefReligion === OTHER && (
            <Input
              label="Your preferred religion"
              name="prefReligionOther"
              placeholder="e.g. Swayamprabha"
              defaultValue={draft.prefReligionOther}
              error={errors.prefReligionOther}
              onChange={(e) => set("prefReligionOther", e.target.value)}
            />
          )}
          <Select
            label="Preferred income"
            name="prefIncome"
            defaultValue={draft.prefIncome}
            onChange={(e) => set("prefIncome", e.target.value)}
          >
            <option value="">No preference</option>
            {INCOME_RANGES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
          <Select
            label="Preferred diet"
            name="prefDiet"
            defaultValue={draft.prefDiet}
            onChange={(e) => set("prefDiet", e.target.value)}
          >
            <option value="">No preference</option>
            {DIET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            label="Preferred drinking"
            name="prefDrinking"
            defaultValue={draft.prefDrinking}
            onChange={(e) => set("prefDrinking", e.target.value)}
          >
            <option value="">No preference</option>
            {DRINKING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            label="Preferred smoking"
            name="prefSmoking"
            defaultValue={draft.prefSmoking}
            onChange={(e) => set("prefSmoking", e.target.value)}
          >
            <option value="">No preference</option>
            {SMOKING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-5 space-y-5">
          <CheckboxGroup
            label="Preferred marital status"
            options={["single", "divorced", "widowed"]}
            values={draft.prefMaritalStatuses}
            onToggle={(v) => set("prefMaritalStatuses", toggle(draft.prefMaritalStatuses, v))}
          />
          <CheckboxGroup
            label="Preferred locations"
            options={INDIAN_STATES}
            values={draft.prefLocations}
            onToggle={(v) => set("prefLocations", toggle(draft.prefLocations, v))}
            gridClassName="sm:grid-cols-3 lg:grid-cols-4"
          />
          <CheckboxGroup
            label="Preferred community(ies)"
            hint="Pick as many as you like. Leave empty to match any community."
            options={communityNames}
            values={draft.prefCommunities}
            onToggle={(v) => set("prefCommunities", toggle(draft.prefCommunities, v))}
          />
          <CheckboxGroup
            label="Preferred education"
            options={EDUCATION_OPTIONS}
            values={draft.prefEducations}
            onToggle={(v) => set("prefEducations", toggle(draft.prefEducations, v))}
          />
          <CheckboxGroup
            label="Preferred professions"
            options={PROFESSION_OPTIONS}
            values={draft.prefProfessions}
            onToggle={(v) => set("prefProfessions", toggle(draft.prefProfessions, v))}
          />
          <CheckboxGroup
            label="Preferred mother tongues"
            options={MOTHER_TONGUES}
            values={draft.prefMotherTongues}
            onToggle={(v) => set("prefMotherTongues", toggle(draft.prefMotherTongues, v))}
          />
        </div>
      </Card>

      <div className="sticky bottom-4 z-30 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-charcoal-100 bg-white/95 px-5 py-4 shadow-card backdrop-blur">
        {(failed.length > 0 || banner) && (
          <div className="min-w-0 max-w-md">
            {failed.length > 0 ? (
              <>
                <p className="text-sm font-medium text-wine-700">
                  Some details are missing or invalid.
                </p>
                <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  {failed.map((field) => (
                    <li key={field}>
                      <button
                        type="button"
                        onClick={() => focusField(field)}
                        className="text-xs font-medium text-wine-600 underline underline-offset-2 hover:text-wine-700"
                      >
                        {FIELD_LABELS[field] ?? field}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm font-medium text-wine-700">{banner}</p>
            )}
          </div>
        )}
        {/* ml-auto, not mr-auto on the message: the buttons have to stay flush
            right whether or not there is an error summary to push them there */}
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            <X className="h-4 w-4" /> Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save changes
          </Button>
        </div>
      </div>
    </form>
  );
}

// these two columns are text[] with no fixed option list — the wizard leaves
// them typed free text — so they are entered as tags here and appended to the
// form on submit rather than bound to an input
function TagPicker({
  label,
  hint,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  hint?: string;
  placeholder?: string;
  values: readonly string[];
  onChange: (next: string[]) => void;
}) {
  const [entry, setEntry] = useState("");

  const add = () => {
    const value = entry.trim().slice(0, 40);
    if (!value || values.includes(value)) return;
    onChange([...values, value]);
    setEntry("");
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-charcoal-800">{label}</label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1.5 rounded-full bg-ivory-100 px-3 py-1 text-sm text-charcoal-700"
            >
              {value}
              <button
                type="button"
                aria-label={`Remove ${value}`}
                onClick={() => onChange(values.filter((v) => v !== value))}
                className="text-charcoal-400 hover:text-wine-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="h-11 w-full rounded-xl border border-charcoal-200 bg-white px-3.5 text-sm text-charcoal-900 placeholder:text-charcoal-400 shadow-sm transition-colors focus:border-wine-400 focus:outline-none focus:ring-2 focus:ring-wine-100"
        />
        <Button type="button" variant="outline" onClick={add}>
          Add
        </Button>
      </div>
      {hint && <p className="text-xs text-charcoal-400">{hint}</p>}
    </div>
  );
}