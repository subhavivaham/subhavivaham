"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Camera,
  Check,
  CheckCircle2,
  Home,
  KeyRound,
  MapPin,
  Upload,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckboxGroup, Input, Select, Textarea } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { useAuth } from "@/features/auth/auth-provider";
import { useToast } from "@/lib/state/toast-provider";
import {
  RELIGIONS,
  MOTHER_TONGUES,
  DRINKING_OPTIONS,
  EDUCATION_OPTIONS,
  FAMILY_TYPES,
  DIET_OPTIONS,
  SMOKING_OPTIONS,
  OTHER,
  PROFESSION_OPTIONS,
  INCOME_RANGES,
  INDIAN_STATES,
  TAMIL_NADU_DISTRICTS,
  HEIGHTS,
  heightCmToText,
  MAX_PHOTO_BYTES,
  MIN_PHOTOS,
  PHOTO_ACCEPT,
  PHOTO_TYPES,
  formatBytes,
  photoSizeError,
} from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/data/mode";
import {
  ABOUT_MIN,
  ABOUT_MAX,
  REGISTRATION_TEXT_FIELDS,
  ageFromDob,
  initialRegistrationDraft,
  validateRegistrationStep,
  type RegistrationDraft,
  type RegistrationErrors,
} from "@/lib/registration";
import { registerMember } from "@/app/(public)/register/actions";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    key: "account",
    label: "Account",
    title: "Create your login",
    blurb: "Your email and mobile number stay private and are never shown to other members.",
    icon: KeyRound,
  },
  {
    key: "basic",
    label: "Basics",
    title: "Tell us about yourself",
    blurb: "The essentials other members see first on your profile.",
    icon: User,
  },
  {
    key: "background",
    label: "Background",
    title: "Religion, education and career",
    blurb: "Helps us find matches that are a genuine fit for your family.",
    icon: Briefcase,
  },
  {
    key: "family",
    label: "Family",
    title: "Your family background",
    blurb: "Tell us about your family structure and values.",
    icon: Home,
  },
  {
    key: "lifestyle",
    label: "Lifestyle",
    title: "Your everyday habits and interests",
    blurb: "Help members understand your lifestyle and personality better.",
    icon: Briefcase,
  },
  {
    key: "location",
    label: "Location & about",
    title: "Where you are and what you value",
    blurb: "A short introduction makes it far easier for the right match to reach out.",
    icon: MapPin,
  },
  {
    key: "preferences",
    label: "Partner Preferences",
    title: "Tell us what you're looking for",
    blurb: "These preferences help us find better matches for you.",
    icon: Briefcase,
  },
  {
    key: "photo",
    label: "Photos",
    title: "Add your photos",
    blurb: "Profiles with a clear photo get far more responses. You can change all of this later.",
    icon: Camera,
  },
] as const;

const TOTAL = STEPS.length;

// the server validates every step in one pass, so a rejected submit can report
// a field the wizard is no longer showing. each error key is mapped onto the
// step that owns it so the wizard can navigate back to the one with the error.
const ERROR_FIELD_STEPS: Record<string, number> = {
  email: 1,
  mobile: 1,
  password: 1,
  fullName: 2,
  gender: 2,
  dateOfBirth: 2,
  religion: 3,
  religionOther: 3,
  motherTongue: 3,
  motherTongueOther: 3,
  communityOther: 3,
  education: 3,
  educationOther: 3,
  profession: 3,
  professionOther: 3,
  familyType: 4,
  brotherCount: 4,
  sisterCount: 4,
  diet: 5,
  smoking: 5,
  drinking: 5,
  district: 6,
  city: 6,
  about: 6,
  prefMinAge: 7,
  prefMaxAge: 7,
  prefReligionOther: 7,
  prefProfessionOther: 7,
  photos: 8,
};

function earliestStepWithErrors(fields: RegistrationErrors): number | null {
  let earliest: number | null = null;
  for (const key of Object.keys(fields)) {
    const step = ERROR_FIELD_STEPS[key];
    if (step !== undefined && (earliest === null || step < earliest)) earliest = step;
  }
  return earliest;
}

// one entry per picked image. the object url is only for the on-screen preview,
// so it is revoked as soon as the photo is removed or the step is left behind.
interface PhotoItem {
  id: string;
  file: File;
  preview: string;
}

export function RegisterForm({
  communities = [],
  freePhotoLimit,
}: {
  communities?: string[];
  freePhotoLimit: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const { registerWithProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [furthest, setFurthest] = useState(1);
  const [draft, setDraft] = useState<RegistrationDraft>(initialRegistrationDraft);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photoNotice, setPhotoNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // object urls outlive the component unless they are released. removals revoke
  // their own url, so this only has to cover the ones still held at unmount -
  // hence the ref, since an effect keyed on photos would revoke live previews
  // on every change.
  const photosRef = useRef<PhotoItem[]>([]);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(
    () => () => {
      for (const photo of photosRef.current) URL.revokeObjectURL(photo.preview);
    },
    []
  );

  // counted on the trimmed value so the number matches what the server checks,
  // and shared with the hint so the two can never disagree
  const aboutLength = draft.about.trim().length;

  const set = (patch: Partial<RegistrationDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch) as (keyof RegistrationDraft)[]) delete next[key];
      return next;
    });
  };

  const age = draft.dateOfBirth ? ageFromDob(draft.dateOfBirth) : NaN;
  const current = STEPS[step - 1];
  const CurrentIcon = current.icon;
  const hasErrors = Object.keys(errors).length > 0;
  const slotsLeft = freePhotoLimit - photos.length;

  const onPhotosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    // let the same file be picked again after it was removed
    e.target.value = "";
    if (picked.length === 0) return;

    const accepted: PhotoItem[] = [];
    const rejected: string[] = [];

    for (const file of picked) {
      if (!slotsLeft) {
        rejected.push(`${file.name} — only ${freePhotoLimit} photo to start with`);
        continue;
      }
      if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
        rejected.push(`${file.name} — must be JPEG, PNG or WebP`);
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        rejected.push(`${file.name} — ${photoSizeError(file.size).split("— ")[1]}`);
        continue;
      }
      accepted.push({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) });
    }

    setPhotos((prev) => [...prev, ...accepted]);
    setPhotoNotice(rejected.join("; "));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.photos;
      return next;
    });
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((photo) => photo.id !== id);
    });
    setPhotoNotice("");
  };

  const goTo = (next: number) => {
    setStep(next);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onNext = () => {
    const found = validateRegistrationStep(step, draft, photos.length, freePhotoLimit);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const next = Math.min(TOTAL, step + 1);
    setFurthest((f) => Math.max(f, next));
    goTo(next);
  };

  const onFinish = async () => {
    const found = validateRegistrationStep(TOTAL, draft, photos.length, freePhotoLimit);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      // the wizard holds its state in react, not in real form fields, so the
      // payload is assembled here and handed to the action as FormData
      const formData = new FormData();
      for (const key of REGISTRATION_TEXT_FIELDS) formData.set(key, draft[key]);
      formData.set("height", String(draft.height));
      formData.set("prefMinHeight", String(draft.prefMinHeight));
      formData.set("prefMaxHeight", String(draft.prefMaxHeight));
      for (const location of draft.prefLocations) formData.append("prefLocations", location);
      for (const hobby of draft.hobbies) formData.append("hobbies", hobby);
      for (const motherTongue of draft.prefMotherTongues) formData.append("prefMotherTongues", motherTongue);
      for (const community of draft.prefCommunities) formData.append("prefCommunities", community);
      for (const education of draft.prefEducations) formData.append("prefEducations", education);
      for (const profession of draft.prefProfessions) formData.append("prefProfessions", profession);
      for (const status of draft.prefMaritalStatuses) formData.append("prefMaritalStatuses", status);
      for (const photo of photos) formData.append("photos", photo.file, photo.file.name);

      const result = await registerMember(formData);
      if (!result.ok) {
        const fields = result.fields ?? {};
        setErrors(fields);
        toast(result.error);
        // the action rejects the whole profile at once, so bring the member back
        // to the step that actually owns the first bad field - otherwise the
        // "fix the highlighted fields" notice shows fields that are not on screen.
        const target = earliestStepWithErrors(fields);
        if (target !== null && target !== step) {
          setStep(target);
          setFurthest((f) => Math.max(f, target));
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        return;
      }

      // the members area is still gated on the local demo session, so seed it
      // from the profile the action actually created
      registerWithProfile(draft.fullName.trim(), draft.email.trim(), result.profileId);

      if (isSupabaseConfigured) {
        // registration already established a real session, but sending the new
        // member through the login form makes the password they just chose the
        // thing that actually opens the account. mock mode has no real
        // credential to check, so it goes straight to the dashboard instead.
        toast("Profile created successfully. Please log in to continue.");
        router.push("/login?registered=1");
        return;
      }

      toast("Profile created successfully. Welcome to Subha Vivaham!");
      router.push("/dashboard");
    } catch {
      toast("Something went wrong while creating your profile. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-charcoal-900 sm:text-4xl">
          Create your profile
        </h1>
        <p className="mt-2 text-charcoal-500">
          {TOTAL} short steps, around 5 minutes. You can change anything later.
        </p>
      </div>

      <ol className="mt-8 flex items-start gap-1.5 sm:gap-2">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          const reachable = n <= furthest;
          const Icon = s.icon;
          return (
            <li key={s.key} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && goTo(n)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "group flex w-full flex-col items-center gap-2 rounded-xl px-1 py-2 text-center transition-colors",
                  reachable && !active && "hover:bg-charcoal-100/60",
                  !reachable && "cursor-not-allowed"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-full max-w-[52px] items-center justify-center rounded-full border-2 transition-colors",
                    done && "border-wine-700 bg-wine-700 text-white",
                    active && "border-wine-700 bg-white text-wine-700",
                    !done && !active && "border-charcoal-200 bg-white text-charcoal-300"
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span
                  className={cn(
                    "hidden w-full truncate text-[11px] font-medium leading-tight sm:block",
                    active ? "text-wine-700" : done ? "text-charcoal-600" : "text-charcoal-400"
                  )}
                >
                  {s.label}
                </span>
                <span
                  className={cn(
                    "text-[11px] font-semibold sm:hidden",
                    active ? "text-wine-700" : "text-charcoal-400"
                  )}
                >
                  {n}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-charcoal-100">
        <div
          className="h-full rounded-full bg-wine-700 transition-all duration-300"
          style={{ width: `${(step / TOTAL) * 100}%` }}
        />
      </div>

      <div className="mt-6 rounded-3xl border border-charcoal-100 bg-white p-6 shadow-card sm:p-8">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wine-50 text-wine-700">
            <CurrentIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold text-charcoal-900">
              {current.title}
            </h2>
            <p className="mt-0.5 text-sm text-charcoal-500">{current.blurb}</p>
          </div>
        </div>

        {hasErrors && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-wine-100 bg-wine-50 px-4 py-3 text-sm font-medium text-wine-700"
          >
            Please fix the highlighted {Object.keys(errors).length === 1 ? "field" : "fields"} to
            continue.
          </p>
        )}

        <div className="mt-6 space-y-5">
          {step === 1 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                label="Email"
                type="email"
                placeholder="you@gmail.com"
                autoComplete="email"
                value={draft.email}
                error={errors.email}
                onChange={(e) => set({ email: e.target.value })}
              />
              <Input
                label="Mobile number"
                type="tel"
                placeholder="98765 43210"
                autoComplete="tel"
                value={draft.mobile}
                error={errors.mobile}
                onChange={(e) => set({ mobile: e.target.value })}
              />
              <PasswordInput
                label="Password"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                value={draft.password}
                error={errors.password}
                onChange={(e) => set({ password: e.target.value })}
              />
            </div>
          )}

          {step === 2 && (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Input
                  label="Full name"
                  placeholder="e.g. Vineeth"
                  autoComplete="name"
                  value={draft.fullName}
                  error={errors.fullName}
                  onChange={(e) => set({ fullName: e.target.value })}
                />
                <Select
                  label="I am a"
                  value={draft.gender}
                  error={errors.gender}
                  onChange={(e) => set({ gender: e.target.value })}
                >
                  <option value="">Select</option>
                  <option value="female">Bride</option>
                  <option value="male">Groom</option>
                </Select>
                <Input
                  label="Date of birth"
                  type="date"
                  hint={Number.isNaN(age) ? undefined : `Age ${age}`}
                  value={draft.dateOfBirth}
                  error={errors.dateOfBirth}
                  onChange={(e) => set({ dateOfBirth: e.target.value })}
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Select
                  label="Height"
                  value={String(draft.height)}
                  onChange={(e) => set({ height: Number(e.target.value) })}
                >
                  {HEIGHTS.map((hcm) => (
                    <option key={hcm} value={hcm}>
                      {heightCmToText(hcm)} ({hcm} cm)
                    </option>
                  ))}
                </Select>
                <Select
                  label="Marital status"
                  value={draft.maritalStatus}
                  onChange={(e) => set({ maritalStatus: e.target.value })}
                >
                  <option value="single">Single</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                </Select>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Select
                  label="Religion"
                  value={draft.religion}
                  error={errors.religion}
                  onChange={(e) => set({ religion: e.target.value })}
                >
                  <option value="">Select</option>
                  {RELIGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
                {draft.religion === OTHER && (
                  <Input
                    label="Your religion"
                    placeholder="e.g. Swayamprabha"
                    value={draft.religionOther}
                    error={errors.religionOther}
                    onChange={(e) => set({ religionOther: e.target.value })}
                  />
                )}
                <Select
                  label="Community"
                  value={draft.community}
                  onChange={(e) => set({ community: e.target.value })}
                >
                  <option value="">Select</option>
                  {communities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value={OTHER}>{OTHER}</option>
                </Select>
                {draft.community === OTHER && (
                  <Input
                    label="Your community"
                    placeholder="e.g. Kongu Vellalar"
                    value={draft.communityOther}
                    error={errors.communityOther}
                    onChange={(e) => set({ communityOther: e.target.value })}
                  />
                )}
                <Input
                  label="Caste"
                  hint="Your sub-caste or gotra group, e.g. Thanjavur Vanniar."
                  placeholder="e.g. Iyer"
                  value={draft.caste}
                  onChange={(e) => set({ caste: e.target.value })}
                />
                <Select
                  label="Mother tongue"
                  value={draft.motherTongue}
                  error={errors.motherTongue}
                  onChange={(e) => set({ motherTongue: e.target.value })}
                >
                  <option value="">Select</option>
                  {MOTHER_TONGUES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
                {draft.motherTongue === OTHER && (
                  <Input
                    label="Your mother tongue"
                    placeholder="e.g. Tulu"
                    value={draft.motherTongueOther}
                    error={errors.motherTongueOther}
                    onChange={(e) => set({ motherTongueOther: e.target.value })}
                  />
                )}
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Select
                  label="Education"
                  value={draft.education}
                  error={errors.education}
                  onChange={(e) => set({ education: e.target.value })}
                >
                  <option value="">Select</option>
                  {EDUCATION_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
                {draft.education === OTHER && (
                  <Input
                    label="Your qualification"
                    placeholder="e.g. B.Des in Textile"
                    value={draft.educationOther}
                    error={errors.educationOther}
                    onChange={(e) => set({ educationOther: e.target.value })}
                  />
                )}
                <Select
                  label="Profession"
                  value={draft.profession}
                  error={errors.profession}
                  onChange={(e) => set({ profession: e.target.value })}
                >
                  <option value="">Select</option>
                  {PROFESSION_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
                {draft.profession === OTHER && (
                  <Input
                    label="Your profession"
                    placeholder="e.g. Marine Biologist"
                    value={draft.professionOther}
                    error={errors.professionOther}
                    onChange={(e) => set({ professionOther: e.target.value })}
                  />
                )}
                <Select
                  label="Annual income"
                  value={draft.income}
                  onChange={(e) => set({ income: e.target.value })}
                >
                  <option value="">Prefer not to say</option>
                  {INCOME_RANGES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </div>
              <Input
                label="Company / Organisation"
                placeholder="e.g. Accenture"
                value={draft.company}
                onChange={(e) => set({ company: e.target.value })}
              />
            </>
          )}

          {step === 4 && (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Select
                  label="Family type"
                  value={draft.familyType}
                  error={errors.familyType}
                  onChange={(e) => set({ familyType: e.target.value })}
                >
                  <option value="">Select</option>
                  {FAMILY_TYPES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Father's occupation"
                  placeholder="e.g. Retired government officer"
                  value={draft.fatherOccupation}
                  onChange={(e) => set({ fatherOccupation: e.target.value })}
                />
                <Input
                  label="Mother's occupation"
                  placeholder="e.g. Homemaker"
                  value={draft.motherOccupation}
                  onChange={(e) => set({ motherOccupation: e.target.value })}
                />
                <Input
                  label="Brothers"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={draft.brotherCount}
                  error={errors.brotherCount}
                  onChange={(e) => set({ brotherCount: e.target.value })}
                />
                <Input
                  label="Sisters"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={draft.sisterCount}
                  error={errors.sisterCount}
                  onChange={(e) => set({ sisterCount: e.target.value })}
                />
                <Input
                  label="Family location"
                  placeholder="e.g. Tirunelveli"
                  value={draft.familyLocation}
                  onChange={(e) => set({ familyLocation: e.target.value })}
                />
                <Input
                  label="Gotra"
                  placeholder="e.g. Bharadwaja"
                  value={draft.gotra}
                  onChange={(e) => set({ gotra: e.target.value })}
                />
                <Input
                  label="Family values"
                  placeholder="e.g. Liberal, well-settled"
                  value={draft.familyValues}
                  onChange={(e) => set({ familyValues: e.target.value })}
                />
                <Select
                  label="Horoscope match required"
                  value={draft.horoscopeRequired}
                  onChange={(e) => set({ horoscopeRequired: e.target.value })}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </Select>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Select
                  label="Diet"
                  value={draft.diet}
                  error={errors.diet}
                  onChange={(e) => set({ diet: e.target.value })}
                >
                  <option value="">Select</option>
                  {DIET_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Smoking"
                  value={draft.smoking}
                  error={errors.smoking}
                  onChange={(e) => set({ smoking: e.target.value })}
                >
                  <option value="">Select</option>
                  {SMOKING_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Drinking"
                  value={draft.drinking}
                  error={errors.drinking}
                  onChange={(e) => set({ drinking: e.target.value })}
                >
                  <option value="">Select</option>
                  {DRINKING_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Fitness"
                  placeholder="e.g. Gym three times a week"
                  value={draft.fitness}
                  onChange={(e) => set({ fitness: e.target.value })}
                />
                <Input
                  label="Sports"
                  placeholder="e.g. Cricket, badminton"
                  value={draft.sports}
                  onChange={(e) => set({ sports: e.target.value })}
                />
                <Input
                  label="Music"
                  placeholder="e.g. Carnatic, Ilaiyaraaja"
                  value={draft.music}
                  onChange={(e) => set({ music: e.target.value })}
                />
                <Input
                  label="Food"
                  placeholder="e.g. South Indian, dosa lover"
                  value={draft.food}
                  onChange={(e) => set({ food: e.target.value })}
                />
                <Input
                  label="Appearances"
                  placeholder="e.g. Simple and neat"
                  value={draft.appearances}
                  onChange={(e) => set({ appearances: e.target.value })}
                />
              </div>
              <Input
                label="Hobbies"
                placeholder="e.g. Reading, classical dance"
                hint="Separate each one with a comma."
                value={draft.hobbies.join(", ")}
                onChange={(e) =>
                  set({
                    hobbies: e.target.value
                      .split(",")
                      .map((h) => h.trim())
                      .filter(Boolean),
                  })
                }
              />
            </>
          )}

          {step === 6 && (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Input
                  label="Country"
                  value={draft.country}
                  onChange={(e) => set({ country: e.target.value })}
                />
                <Select
                  label="State"
                  value={draft.state}
                  disabled
                  onChange={() => {}}
                >
                  <option value="Tamil Nadu">Tamil Nadu</option>
                </Select>
                <Select
                  label="District"
                  value={draft.district}
                  error={errors.district}
                  onChange={(e) => set({ district: e.target.value })}
                >
                  <option value="">Select</option>
                  {TAMIL_NADU_DISTRICTS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
                <Input
                  label="City"
                  placeholder="e.g. Chennai"
                  value={draft.city}
                  error={errors.city}
                  onChange={(e) => set({ city: e.target.value })}
                />
              </div>
              <Textarea
                label="Write a short introduction"
                hint={`${aboutLength}/${ABOUT_MIN} characters minimum · ${ABOUT_MAX} maximum`}
                placeholder="I am a kind, family-oriented person who enjoys..."
                rows={8}
                maxLength={ABOUT_MAX}
                value={draft.about}
                error={errors.about}
                onChange={(e) => set({ about: e.target.value })}
              />
            </>
          )}

          {step === 7 && (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Select
                  label="Preferred age from"
                  value={draft.prefMinAge}
                  error={errors.prefMinAge}
                  onChange={(e) => set({ prefMinAge: e.target.value })}
                >
                  {Array.from({ length: 25 }, (_, i) => 21 + i).map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Preferred age to"
                  value={draft.prefMaxAge}
                  error={errors.prefMaxAge}
                  onChange={(e) => set({ prefMaxAge: e.target.value })}
                >
                  {Array.from({ length: 30 }, (_, i) => 23 + i).map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Preferred height from"
                  value={draft.prefMinHeight}
                  onChange={(e) => set({ prefMinHeight: e.target.value })}
                >
                  {HEIGHTS.map((hcm) => (
                    <option key={hcm} value={hcm}>
                      {heightCmToText(hcm)} ({hcm} cm)
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Select
                  label="Preferred height to"
                  value={draft.prefMaxHeight}
                  onChange={(e) => set({ prefMaxHeight: e.target.value })}
                >
                  {HEIGHTS.map((hcm) => (
                    <option key={hcm} value={hcm}>
                      {heightCmToText(hcm)} ({hcm} cm)
                    </option>
                  ))}
                </Select>
                <Select
                  label="Preferred religion"
                  value={draft.prefReligion}
                  onChange={(e) => set({ prefReligion: e.target.value })}
                >
                  <option value="">Any</option>
                  {RELIGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
                {draft.prefReligion === OTHER && (
                  <Input
                    label="Preferred religion"
                    placeholder="e.g. Swayamprabha"
                    value={draft.prefReligionOther}
                    error={errors.prefReligionOther}
                    onChange={(e) => set({ prefReligionOther: e.target.value })}
                  />
                )}
              </div>
              <CheckboxGroup
                label="Preferred mother tongue(s)"
                hint="Pick as many as you like. Leave empty to match any mother tongue."
                options={MOTHER_TONGUES}
                values={draft.prefMotherTongues}
                onToggle={(value) =>
                  set({
                    prefMotherTongues: draft.prefMotherTongues.includes(value)
                      ? draft.prefMotherTongues.filter((mt) => mt !== value)
                      : [...draft.prefMotherTongues, value],
                  })
                }
              />
              <CheckboxGroup
                label="Preferred community(ies)"
                hint="Pick as many as you like. Leave empty to match any community."
                options={communities}
                values={draft.prefCommunities}
                onToggle={(value) =>
                  set({
                    prefCommunities: draft.prefCommunities.includes(value)
                      ? draft.prefCommunities.filter((c) => c !== value)
                      : [...draft.prefCommunities, value],
                  })
                }
              />
              <CheckboxGroup
                label="Preferred education level(s)"
                hint="Pick as many as you like. Leave empty to match any education level."
                options={EDUCATION_OPTIONS}
                values={draft.prefEducations}
                onToggle={(value) =>
                  set({
                    prefEducations: draft.prefEducations.includes(value)
                      ? draft.prefEducations.filter((e) => e !== value)
                      : [...draft.prefEducations, value],
                  })
                }
              />
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Select
                  label="Preferred profession"
                  value={draft.prefProfession}
                  onChange={(e) => set({ prefProfession: e.target.value })}
                >
                  <option value="">Any</option>
                  {PROFESSION_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
                {draft.prefProfession === OTHER && (
                  <Input
                    label="Preferred profession"
                    placeholder="e.g. Marine Biologist"
                    value={draft.prefProfessionOther}
                    error={errors.prefProfessionOther}
                    onChange={(e) => set({ prefProfessionOther: e.target.value })}
                  />
                )}
                <Select
                  label="Preferred income"
                  value={draft.prefIncome}
                  onChange={(e) => set({ prefIncome: e.target.value })}
                >
                  <option value="">Any</option>
                  {INCOME_RANGES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Select
                  label="Preferred diet"
                  value={draft.prefDiet}
                  onChange={(e) => set({ prefDiet: e.target.value })}
                >
                  <option value="">Any</option>
                  {DIET_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Preferred smoking habit"
                  value={draft.prefSmoking}
                  onChange={(e) => set({ prefSmoking: e.target.value })}
                >
                  <option value="">Any</option>
                  {SMOKING_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Preferred drinking habit"
                  value={draft.prefDrinking}
                  onChange={(e) => set({ prefDrinking: e.target.value })}
                >
                  <option value="">Any</option>
                  {DRINKING_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <CheckboxGroup
                label="Preferred marital status"
                hint="Select partner preferences"
                options={["Single", "Divorced", "Widowed"]}
                values={draft.prefMaritalStatuses.map((s) => (s === "single" ? "Single" : s === "divorced" ? "Divorced" : "Widowed"))}
                onToggle={(value) => {
                  const mapped = value === "Single" ? "single" : value === "Divorced" ? "divorced" : "widowed";
                  set({
                    prefMaritalStatuses: draft.prefMaritalStatuses.includes(mapped)
                      ? draft.prefMaritalStatuses.filter((s) => s !== mapped)
                      : [...draft.prefMaritalStatuses, mapped],
                  });
                }}
              />
              <CheckboxGroup
                label="Preferred location(s)"
                hint="Pick the states you are open to. Leave empty to match any location."
                options={INDIAN_STATES}
                values={draft.prefLocations}
                onToggle={(value) =>
                  set({
                    prefLocations: draft.prefLocations.includes(value)
                      ? draft.prefLocations.filter((l) => l !== value)
                      : [...draft.prefLocations, value],
                  })
                }
              />
            </>
          )}

          {step === 8 && (
            <>
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-charcoal-800">
                    Photos <span className="text-wine-700">*</span>
                  </p>
                  <p className="text-xs text-charcoal-400">
                    {photos.length} of {freePhotoLimit} added
                  </p>
                </div>

                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.map((photo, index) => (
                    <li
                      key={photo.id}
                      className="group relative overflow-hidden rounded-2xl border border-charcoal-100 bg-ivory-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- local object-url preview, not optimizable */}
                      <img
                        src={photo.preview}
                        alt={`Photo ${index + 1} preview`}
                        className="aspect-square w-full object-cover"
                      />
                      {index === 0 && (
                        <span className="absolute left-2 top-2 rounded-full bg-wine-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Main
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(photo.id)}
                        aria-label={`Remove photo ${index + 1}`}
                        className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-charcoal-600 shadow-sm transition-colors hover:bg-white hover:text-wine-700"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <p className="truncate px-3 py-2 text-[11px] text-charcoal-500">
                        {photo.file.name} · {formatBytes(photo.file.size)}
                      </p>
                    </li>
                  ))}

                  {slotsLeft > 0 && (
                    <li>
                      <label
                        className={cn(
                          "flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-charcoal-200 bg-ivory-50 px-4 text-center transition-colors hover:border-wine-300 hover:bg-wine-50/40",
                          errors.photos && "border-wine-500 bg-wine-50/40"
                        )}
                      >
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-50 text-gold-600">
                          <Upload className="h-6 w-6" />
                        </span>
                        <span className="text-xs font-semibold text-charcoal-700">
                          {photos.length === 0 ? "Add your first photo" : "Add another"}
                        </span>
                        <span className="text-[11px] text-charcoal-400">
                          {slotsLeft} {slotsLeft === 1 ? "slot" : "slots"} left
                        </span>
                        <input
                          type="file"
                          accept={PHOTO_ACCEPT}
                          multiple
                          className="hidden"
                          onChange={onPhotosChange}
                        />
                      </label>
                    </li>
                  )}
                </ul>

                {errors.photos ? (
                  <p role="alert" className="mt-2 text-xs font-medium text-wine-700">
                    {errors.photos}
                  </p>
                ) : photoNotice ? (
                  <p role="alert" className="mt-2 text-xs font-medium text-wine-700">
                    {photoNotice}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-charcoal-400">
                    At least {MIN_PHOTOS} photo is required. JPEG, PNG or WebP, up to{" "}
                    {formatBytes(MAX_PHOTO_BYTES)} each.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => goTo(Math.max(1, step - 1))}
            disabled={step === 1 || submitting}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < TOTAL ? (
            <Button type="button" onClick={onNext}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={onFinish} disabled={submitting}>
              {submitting ? (
                <>
                  <Upload className="h-4 w-4" /> Uploading photos…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Complete Profile
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-2 text-sm text-charcoal-600">
        <p>
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-wine-700 hover:text-wine-800">
            Login
          </Link>
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-charcoal-500 transition-colors hover:text-wine-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </div>
    </div>
  );
}
