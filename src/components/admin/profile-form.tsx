"use client";

import { CheckboxGroup, Input, PasswordInput, Select, Textarea } from "@/components/ui/field";
import { PhotoPicker, type PendingPhoto } from "@/components/admin/photo-picker";
import Image from "next/image";
import type { ProfilePhoto } from "@/types";
import {
  DIET_OPTIONS,
  DRINKING_OPTIONS,
  EDUCATION_OPTIONS,
  FAMILY_TYPES,
  HEIGHTS,
  INCOME_RANGES,
  MAX_PHOTOS,
  MOTHER_TONGUES,
  PROFESSION_OPTIONS,
  RELIGIONS,
  SMOKING_OPTIONS,
  TAMIL_NADU_DISTRICTS,
  heightCmToText,
} from "@/lib/constants";
import { ABOUT_MAX, ABOUT_MIN, ageFromDob } from "@/lib/registration";
import {
  MAX_AGE_OPTIONS,
  MIN_AGE_OPTIONS,
  type ProfileInput,
} from "@/features/profiles/store";
import { cn } from "@/lib/utils";

// the same sections the registration wizard walks through, minus the account
// step (the admin already has the row's user). the photo step is last, as it is
// in the wizard: an admin types the profile in and attaches its photos before
// saving, so the row never lands without a gallery. each section lists the fields
// it draws, so a rejected save can be sent straight to the tab holding the first
// problem instead of leaving the admin to hunt for it.
export const SECTIONS: readonly {
  key: ProfileSection;
  label: string;
  fields: readonly (keyof ProfileInput | "photos")[];
}[] = [
  {
    key: "basics",
    label: "Basics",
    fields: ["fullName", "gender", "email", "mobile", "password", "dateOfBirth", "height", "maritalStatus"],
  },
  {
    key: "background",
    label: "Background",
    fields: [
      "religion",
      "community",
      "caste",
      "motherTongue",
      "education",
      "college",
      "profession",
      "company",
      "income",
    ],
  },
  {
    key: "family",
    label: "Family",
    fields: [
      "familyType",
      "fatherOccupation",
      "motherOccupation",
      "brotherCount",
      "sisterCount",
      "familyLocation",
      "gotra",
      "familyValues",
      "horoscopeRequired",
    ],
  },
  {
    key: "lifestyle",
    label: "Lifestyle",
    fields: [
      "diet",
      "smoking",
      "drinking",
      "hobbies",
      "fitness",
      "sports",
      "music",
      "food",
      "appearances",
    ],
  },
  {
    key: "location",
    label: "Location & about",
    fields: ["country", "state", "district", "city", "about"],
  },
  {
    key: "preferences",
    label: "Partner preferences",
    fields: [
      "prefMinAge",
      "prefMaxAge",
      "prefMinHeight",
      "prefMaxHeight",
      "prefReligion",
      "prefMotherTongues",
      "prefCommunities",
      "prefEducations",
      "prefProfessions",
      "prefMaritalStatuses",
      "prefLocations",
      "prefIncome",
      "prefDiet",
      "prefSmoking",
      "prefDrinking",
    ],
  },
  {
    key: "photos",
    label: "Photos",
    fields: ["photos"],
  },
];

export type ProfileSection =
  | "basics"
  | "background"
  | "family"
  | "lifestyle"
  | "location"
  | "preferences"
  | "photos";

export function firstSectionWithErrors(
  errors: Record<string, string | undefined>
): ProfileSection | null {
  return SECTIONS.find((s) => s.fields.some((f) => errors[f]))?.key ?? null;
}

const MARITAL_STATUSES = [
  { value: "single", label: "Single" },
  { value: "divorced", label: "Divorced" },
  { value: "widowed", label: "Widowed" },
  { value: "annulled", label: "Annulled" },
] as const;

const MARITAL_LABELS: Record<string, string> = Object.fromEntries(
  MARITAL_STATUSES.map((m) => [m.value, m.label])
);

const MARITAL_STATUS_LABELS = MARITAL_STATUSES.map((m) => m.label);

// a select or a checkbox grid can only display a value that is one of its own
// options, so anything the lists do not carry - a custom religion, a seeded
// legacy qualification - is added back in rather than quietly emptying the
// field the moment the modal opens.
function withCurrent(options: readonly string[], values: string | string[]): string[] {
  const current = Array.isArray(values) ? values : [values];
  return [...options, ...current.filter((v) => v && !options.includes(v))];
}

function toggleValue(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

export function ProfileForm({
  form,
  errors,
  section,
  onSectionChange,
  onSet,
  communityNames,
  photos,
  photoSlotsLeft,
  photoNotice,
  existingPhotos,
  onPhotosPicked,
  onPhotoDropped,
  disableGender = false,
  mode = "create",
}: {
  form: ProfileInput;
  errors: Record<string, string | undefined>;
  section: ProfileSection;
  onSectionChange: (section: ProfileSection) => void;
  onSet: <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => void;
  communityNames: string[];
  photos: PendingPhoto[];
  photoSlotsLeft: number;
  photoNotice: string;
  existingPhotos: ProfilePhoto[];
  onPhotosPicked: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPhotoDropped: (id: string) => void;
  disableGender?: boolean;
  // create requires a login password; edit treats a blank one as "leave the
  // current password alone"
  mode?: "create" | "edit";
}) {
  const age = form.dateOfBirth ? ageFromDob(form.dateOfBirth) : NaN;
  const aboutLength = form.about.trim().length;
  const communities = withCurrent(communityNames, form.community);

  return (
    <div className="space-y-5">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onSectionChange(s.key)}
            aria-current={section === s.key ? "true" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              section === s.key
                ? "bg-wine-700 text-white"
                : "bg-charcoal-100 text-charcoal-600 hover:bg-charcoal-200"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "basics" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Full name"
              placeholder="e.g. Vineeth"
              value={form.fullName}
              error={errors.fullName}
              onChange={(e) => onSet("fullName", e.target.value)}
            />
            <Select
              label="I am a"
              value={form.gender}
              error={errors.gender}
              disabled={disableGender}
              onChange={(e) => onSet("gender", e.target.value as ProfileInput["gender"])}
            >
              <option value="female">Bride</option>
              <option value="male">Groom</option>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Email"
              type="email"
              placeholder="name@example.com"
              value={form.email}
              error={errors.email}
              onChange={(e) => onSet("email", e.target.value)}
            />
            <Input
              label="Mobile number"
              type="tel"
              placeholder="98765 43210"
              value={form.mobile}
              error={errors.mobile}
              onChange={(e) => onSet("mobile", e.target.value)}
            />
          </div>

          <PasswordInput
            label="Login password"
            placeholder={mode === "edit" ? "Leave blank to keep current password" : "At least 8 characters"}
            hint={
              mode === "edit"
                ? "The member signs in with this. Blank keeps the existing password."
                : "The member signs in to their account with this."
            }
            autoComplete="new-password"
            value={form.password}
            error={errors.password}
            onChange={(e) => onSet("password", e.target.value)}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Date of birth"
              type="date"
              hint={Number.isNaN(age) ? undefined : `Age ${age}`}
              value={form.dateOfBirth}
              error={errors.dateOfBirth}
              onChange={(e) => onSet("dateOfBirth", e.target.value)}
            />
            <Select
              label="Height"
              value={String(form.height)}
              error={errors.height}
              onChange={(e) => onSet("height", Number(e.target.value))}
            >
              {HEIGHTS.map((cm) => (
                <option key={cm} value={cm}>
                  {heightCmToText(cm)} ({cm} cm)
                </option>
              ))}
            </Select>
            <Select
              label="Marital status"
              value={form.maritalStatus}
              onChange={(e) =>
                onSet("maritalStatus", e.target.value as ProfileInput["maritalStatus"])
              }
            >
              {MARITAL_STATUSES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {section === "background" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Religion"
              value={form.religion}
              error={errors.religion}
              onChange={(e) => onSet("religion", e.target.value)}
            >
              <option value="">Select</option>
              {withCurrent(RELIGIONS, form.religion).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            <Select
              label="Community"
              value={form.community}
              error={errors.community}
              onChange={(e) => onSet("community", e.target.value)}
            >
              <option value="">Select</option>
              {communities.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
            <Input
              label="Caste"
              hint="Sub-caste or gotra group, e.g. Thanjavur Vanniar."
              placeholder="e.g. Iyer"
              value={form.caste}
              onChange={(e) => onSet("caste", e.target.value)}
            />
            <Select
              label="Mother tongue"
              value={form.motherTongue}
              error={errors.motherTongue}
              onChange={(e) => onSet("motherTongue", e.target.value)}
            >
              <option value="">Select</option>
              {withCurrent(MOTHER_TONGUES, form.motherTongue).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Education"
              value={form.education}
              error={errors.education}
              onChange={(e) => onSet("education", e.target.value)}
            >
              <option value="">Select</option>
              {withCurrent(EDUCATION_OPTIONS, form.education).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
            <Select
              label="Profession"
              value={form.profession}
              error={errors.profession}
              onChange={(e) => onSet("profession", e.target.value)}
            >
              <option value="">Select</option>
              {withCurrent(PROFESSION_OPTIONS, form.profession).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Select
              label="Annual income"
              value={form.income}
              onChange={(e) => onSet("income", e.target.value)}
            >
              <option value="">Prefer not to say</option>
              {withCurrent(INCOME_RANGES, form.income).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Company / Organisation"
              placeholder="e.g. Accenture"
              value={form.company}
              onChange={(e) => onSet("company", e.target.value)}
            />
            <Input
              label="College"
              placeholder="e.g. IIT Madras"
              value={form.college}
              onChange={(e) => onSet("college", e.target.value)}
            />
          </div>
        </div>
      )}

      {section === "family" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Family type"
            value={form.familyType}
            error={errors.familyType}
            onChange={(e) => onSet("familyType", e.target.value as ProfileInput["familyType"])}
          >
            {FAMILY_TYPES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
          <Input
            label="Father's occupation"
            placeholder="e.g. Retired government officer"
            value={form.fatherOccupation}
            onChange={(e) => onSet("fatherOccupation", e.target.value)}
          />
          <Input
            label="Mother's occupation"
            placeholder="e.g. Homemaker"
            value={form.motherOccupation}
            onChange={(e) => onSet("motherOccupation", e.target.value)}
          />
          <Input
            label="Brothers"
            type="number"
            min={0}
            placeholder="0"
            value={String(form.brotherCount)}
            error={errors.brotherCount}
            onChange={(e) => onSet("brotherCount", Number(e.target.value) || 0)}
          />
          <Input
            label="Sisters"
            type="number"
            min={0}
            placeholder="0"
            value={String(form.sisterCount)}
            error={errors.sisterCount}
            onChange={(e) => onSet("sisterCount", Number(e.target.value) || 0)}
          />
          <Input
            label="Family location"
            placeholder="e.g. Tirunelveli"
            value={form.familyLocation}
            onChange={(e) => onSet("familyLocation", e.target.value)}
          />
          <Input
            label="Gotra"
            placeholder="e.g. Bharadwaja"
            value={form.gotra}
            onChange={(e) => onSet("gotra", e.target.value)}
          />
          <Input
            label="Family values"
            placeholder="e.g. Liberal, well-settled"
            value={form.familyValues}
            onChange={(e) => onSet("familyValues", e.target.value)}
          />
          <Select
            label="Horoscope match required"
            value={form.horoscopeRequired ? "yes" : "no"}
            onChange={(e) => onSet("horoscopeRequired", e.target.value === "yes")}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </Select>
        </div>
      )}

      {section === "lifestyle" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Diet"
              value={form.diet}
              error={errors.diet}
              onChange={(e) => onSet("diet", e.target.value)}
            >
              <option value="">Select</option>
              {withCurrent(
                DIET_OPTIONS.map((d) => d.value),
                form.diet
              ).map((value) => (
                <option key={value} value={value}>
                  {DIET_OPTIONS.find((d) => d.value === value)?.label ?? value}
                </option>
              ))}
            </Select>
            <Select
              label="Smoking"
              value={form.smoking}
              error={errors.smoking}
              onChange={(e) => onSet("smoking", e.target.value)}
            >
              <option value="">Select</option>
              {withCurrent(
                SMOKING_OPTIONS.map((o) => o.value),
                form.smoking
              ).map((value) => (
                <option key={value} value={value}>
                  {SMOKING_OPTIONS.find((o) => o.value === value)?.label ?? value}
                </option>
              ))}
            </Select>
            <Select
              label="Drinking"
              value={form.drinking}
              error={errors.drinking}
              onChange={(e) => onSet("drinking", e.target.value)}
            >
              <option value="">Select</option>
              {withCurrent(
                DRINKING_OPTIONS.map((o) => o.value),
                form.drinking
              ).map((value) => (
                <option key={value} value={value}>
                  {DRINKING_OPTIONS.find((o) => o.value === value)?.label ?? value}
                </option>
              ))}
            </Select>
            <Input
              label="Fitness"
              placeholder="e.g. Gym three times a week"
              value={form.fitness}
              onChange={(e) => onSet("fitness", e.target.value)}
            />
            <Input
              label="Sports"
              placeholder="e.g. Cricket, badminton"
              value={form.sports}
              onChange={(e) => onSet("sports", e.target.value)}
            />
            <Input
              label="Music"
              placeholder="e.g. Carnatic, Ilaiyaraaja"
              value={form.music}
              onChange={(e) => onSet("music", e.target.value)}
            />
            <Input
              label="Food"
              placeholder="e.g. South Indian, dosa lover"
              value={form.food}
              onChange={(e) => onSet("food", e.target.value)}
            />
            <Input
              label="Appearances"
              placeholder="e.g. Simple and neat"
              value={form.appearances}
              onChange={(e) => onSet("appearances", e.target.value)}
            />
          </div>
          <Input
            label="Hobbies"
            placeholder="e.g. Reading, classical dance"
            hint="Separate each one with a comma."
            value={form.hobbies}
            onChange={(e) => onSet("hobbies", e.target.value)}
          />
        </>
      )}

      {section === "location" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Country"
              value={form.country}
              onChange={(e) => onSet("country", e.target.value)}
            />
            <Input
              label="State"
              value={form.state}
              onChange={(e) => onSet("state", e.target.value)}
            />
            <Select
              label="District"
              value={form.district}
              error={errors.district}
              onChange={(e) => onSet("district", e.target.value)}
            >
              <option value="">Select</option>
              {withCurrent(TAMIL_NADU_DISTRICTS, form.district).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
            <Input
              label="City"
              placeholder="e.g. Chennai"
              value={form.city}
              error={errors.city}
              onChange={(e) => onSet("city", e.target.value)}
            />
          </div>
          <Textarea
            label="Write a short introduction"
            hint={`${aboutLength}/${ABOUT_MIN} characters minimum · ${ABOUT_MAX} maximum`}
            placeholder="I am a kind, family-oriented person who enjoys..."
            rows={6}
            maxLength={ABOUT_MAX}
            value={form.about}
            error={errors.about}
            onChange={(e) => onSet("about", e.target.value)}
          />
        </>
      )}

      {section === "preferences" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Preferred age from"
              value={String(form.prefMinAge)}
              error={errors.prefMinAge}
              onChange={(e) => onSet("prefMinAge", Number(e.target.value))}
            >
              {MIN_AGE_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
            <Select
              label="Preferred age to"
              value={String(form.prefMaxAge)}
              error={errors.prefMaxAge}
              onChange={(e) => onSet("prefMaxAge", Number(e.target.value))}
            >
              {MAX_AGE_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
            <Select
              label="Preferred height from"
              value={String(form.prefMinHeight)}
              onChange={(e) => onSet("prefMinHeight", Number(e.target.value))}
            >
              {HEIGHTS.map((cm) => (
                <option key={cm} value={cm}>
                  {heightCmToText(cm)} ({cm} cm)
                </option>
              ))}
            </Select>
            <Select
              label="Preferred height to"
              value={String(form.prefMaxHeight)}
              onChange={(e) => onSet("prefMaxHeight", Number(e.target.value))}
            >
              {HEIGHTS.map((cm) => (
                <option key={cm} value={cm}>
                  {heightCmToText(cm)} ({cm} cm)
                </option>
              ))}
            </Select>
            <Select
              label="Preferred religion"
              value={form.prefReligion}
              onChange={(e) => onSet("prefReligion", e.target.value)}
            >
              <option value="">Any</option>
              {withCurrent(RELIGIONS, form.prefReligion).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            <Select
              label="Preferred income"
              value={form.prefIncome}
              onChange={(e) => onSet("prefIncome", e.target.value)}
            >
              <option value="">Any</option>
              {withCurrent(INCOME_RANGES, form.prefIncome).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Preferred diet"
              value={form.prefDiet}
              onChange={(e) => onSet("prefDiet", e.target.value)}
            >
              <option value="">Any</option>
              {withCurrent(
                DIET_OPTIONS.map((d) => d.value),
                form.prefDiet
              ).map((value) => (
                <option key={value} value={value}>
                  {DIET_OPTIONS.find((d) => d.value === value)?.label ?? value}
                </option>
              ))}
            </Select>
            <Select
              label="Preferred smoking habit"
              value={form.prefSmoking}
              onChange={(e) => onSet("prefSmoking", e.target.value)}
            >
              <option value="">Any</option>
              {withCurrent(
                SMOKING_OPTIONS.map((o) => o.value),
                form.prefSmoking
              ).map((value) => (
                <option key={value} value={value}>
                  {SMOKING_OPTIONS.find((o) => o.value === value)?.label ?? value}
                </option>
              ))}
            </Select>
            <Select
              label="Preferred drinking habit"
              value={form.prefDrinking}
              onChange={(e) => onSet("prefDrinking", e.target.value)}
            >
              <option value="">Any</option>
              {withCurrent(
                DRINKING_OPTIONS.map((o) => o.value),
                form.prefDrinking
              ).map((value) => (
                <option key={value} value={value}>
                  {DRINKING_OPTIONS.find((o) => o.value === value)?.label ?? value}
                </option>
              ))}
            </Select>
          </div>

          <CheckboxGroup
            label="Preferred mother tongue(s)"
            hint="Pick as many as you like. Leave empty to match any mother tongue."
            options={withCurrent(MOTHER_TONGUES, form.prefMotherTongues)}
            values={form.prefMotherTongues}
            onToggle={(value) => onSet("prefMotherTongues", toggleValue(form.prefMotherTongues, value))}
          />
          <CheckboxGroup
            label="Preferred community(ies)"
            hint="Pick as many as you like. Leave empty to match any community."
            options={withCurrent(communityNames, form.prefCommunities)}
            values={form.prefCommunities}
            onToggle={(value) => onSet("prefCommunities", toggleValue(form.prefCommunities, value))}
          />
          <CheckboxGroup
            label="Preferred education level(s)"
            hint="Pick as many as you like. Leave empty to match any education level."
            options={withCurrent(EDUCATION_OPTIONS, form.prefEducations)}
            values={form.prefEducations}
            onToggle={(value) => onSet("prefEducations", toggleValue(form.prefEducations, value))}
          />
          <CheckboxGroup
            label="Preferred profession(s)"
            hint="Pick as many as you like. Leave empty to match any profession."
            options={withCurrent(PROFESSION_OPTIONS, form.prefProfessions)}
            values={form.prefProfessions}
            onToggle={(value) => onSet("prefProfessions", toggleValue(form.prefProfessions, value))}
          />
          <CheckboxGroup
            label="Preferred marital status"
            hint="Select partner preferences"
            options={MARITAL_STATUS_LABELS}
            values={form.prefMaritalStatuses.map((s) => MARITAL_LABELS[s] ?? s)}
            onToggle={(label) => {
              const slug = MARITAL_STATUSES.find((m) => m.label === label)?.value;
              if (!slug) return;
              onSet("prefMaritalStatuses", toggleValue(form.prefMaritalStatuses, slug));
            }}
          />
          <CheckboxGroup
            label="Preferred location(s)"
            hint="Pick the districts you are open to. Leave empty to match any location."
            options={withCurrent(TAMIL_NADU_DISTRICTS, form.prefLocations)}
            values={form.prefLocations}
            onToggle={(value) => onSet("prefLocations", toggleValue(form.prefLocations, value))}
            gridClassName="sm:grid-cols-2 lg:grid-cols-4"
          />
        </>
      )}

      {section === "photos" && (
        <div className="space-y-4">
          {/* the photos the row already carries, shown while editing so the
              remaining slots make sense. they are reordered and removed from
              the row's photo manager, not from here. */}
          {existingPhotos.length > 0 && (
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-charcoal-800">Already attached</p>
                <p className="text-xs text-charcoal-400">
                  {existingPhotos.length} of {MAX_PHOTOS} used
                </p>
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {existingPhotos.map((photo, index) => (
                  <li
                    key={photo.id}
                    className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-charcoal-100 bg-ivory-50"
                  >
                    <Image
                      src={photo.url}
                      alt={`Photo ${index + 1}`}
                      fill
                      sizes="200px"
                      className="object-cover"
                    />
                    {index === 0 && (
                      <span className="absolute left-2 top-2 rounded-full bg-gold-500 px-2 py-0.5 text-[10px] font-bold text-white">
                        Primary
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <PhotoPicker
            photos={photos}
            slotsLeft={photoSlotsLeft}
            notice={photoNotice}
            error={errors.photos}
            heading="Picked photos"
            onPick={onPhotosPicked}
            onDrop={onPhotoDropped}
          />

          <p className="text-xs text-charcoal-400">
            Up to {MAX_PHOTOS} photos. The first one becomes the primary photo and drives the
            profile card.{" "}
            {photoSlotsLeft === 0
              ? "This profile already has the maximum."
              : "They are uploaded when you save."}
          </p>
        </div>
      )}
    </div>
  );
}
