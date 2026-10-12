import Image from "next/image";
import type { ReactNode } from "react";
import { BadgeCheck, MapPin, ShieldCheck, GraduationCap } from "lucide-react";
import type { Profile } from "@/types";

// the read view both /dashboard/profile and /profile/[id] render. extracted so
// the two cannot drift: My Profile and a profile viewed by someone else answer
// the same questions, so they should look the same.
//
// these are presentational only - no data fetching and no "use client", so the
// server page can render them directly and the client detail view can wrap them
// in its own action bar.

export function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof MapPin;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-charcoal-100 bg-white p-6 shadow-card sm:p-7">
      <h2 className="mb-5 flex items-center gap-2 font-display text-xl font-semibold text-charcoal-900">
        {Icon && <Icon className="h-5 w-5 text-wine-600" />}
        {title}
      </h2>
      {children}
    </section>
  );
}

// a row that has never been filled in reads as an em dash rather than a blank
// line, so a missing value is visibly missing and not mistaken for a layout gap.
// the mappers turn a null column into "", so an empty string has to count as
// absent too - testing only for null leaves the gap invisible, which is exactly
// what an unfilled profile looks like.
function shown(value: ReactNode): ReactNode {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value.trim() ? value : "—";
  return value;
}

export function SectionRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-charcoal-50 py-3 last:border-0">
      <span className="shrink-0 text-sm text-charcoal-500">{label}</span>
      <span className="text-right text-sm font-medium text-charcoal-900">{shown(value)}</span>
    </div>
  );
}

const MARITAL_LABELS: Record<string, string> = {
  single: "Single",
  divorced: "Divorced",
  widowed: "Widowed",
};

export function maritalLabel(value: string): string {
  return MARITAL_LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

// the detail view offers the raw values too, where a bare "vegetarian" or
// "occasionally" reads as a database value rather than an answer
const LIFESTYLE_LABELS: Record<string, string> = {
  vegetarian: "Vegetarian",
  "non-vegetarian": "Non-Vegetarian",
  eggetarian: "Eggetarian",
  jain: "Jain / Sattvik",
  vegan: "Vegan",
  never: "Never",
  occasionally: "Occasionally",
  socially: "Socially",
  yes: "Yes",
};

export function lifestyleLabel(value: string): string {
  return LIFESTYLE_LABELS[value] ?? maritalLabel(value);
}

function joined(values: string[], fallback = "—"): string {
  return values.length ? values.join(", ") : fallback;
}

// an unset city and state would otherwise join to a bare ", "
function place(city: string, state: string): string {
  return [city, state].filter(Boolean).join(", ");
}

// the sibling summary, as a readable phrase rather than "2 brother(s), 1
// sister(s)", which is what the raw count fields produce when joined blindly
function siblings(p: Profile): string {
  const parts = [
    p.family.brotherCount
      ? `${p.family.brotherCount} brother${p.family.brotherCount > 1 ? "s" : ""}`
      : null,
    p.family.sisterCount
      ? `${p.family.sisterCount} sister${p.family.sisterCount > 1 ? "s" : ""}`
      : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

export function OverviewCard({
  profile,
  action,
}: {
  profile: Profile;
  action?: ReactNode;
}) {
  const primary = profile.photos.find((p) => p.isPrimary) ?? profile.photos[0];

  return (
    <SectionCard title="Overview">
      <div className="flex flex-col items-start gap-6 sm:flex-row">
        <div className="relative aspect-[4/5] w-full max-w-[220px] overflow-hidden rounded-2xl bg-charcoal-100">
          {primary && (
            <Image
              src={primary.url}
              alt={profile.fullName}
              fill
              sizes="220px"
              className="object-cover"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-semibold text-charcoal-900">
              {shown(profile.fullName)}
            </h2>
            {profile.verified && <BadgeCheck className="h-5 w-5 text-gold-500" />}
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-charcoal-500">
            <MapPin className="h-4 w-4" /> {shown(place(profile.city, profile.state))}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            {/* gated on the column rather than always shown: an unapproved
                profile landing here used to be told it was identity verified */}
            {profile.verified && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" /> Identity verified
              </span>
            )}
            {profile.education && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ivory-100 px-3 py-1 text-charcoal-600">
                <GraduationCap className="h-3.5 w-3.5" /> {profile.education}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ivory-100 px-3 py-1 text-charcoal-600">
              {profile.age ? `${profile.age} years, ${profile.heightText}` : "Age not added"}
            </span>
          </div>
          <p className="mt-5 text-sm leading-relaxed text-charcoal-600">
            {shown(profile.about)}
          </p>
          {action && <div className="mt-5 flex flex-wrap gap-2">{action}</div>}
        </div>
      </div>
    </SectionCard>
  );
}

export function BasicDetailsCard({ profile }: { profile: Profile }) {
  return (
    <SectionCard title="Basic Details">
      <SectionRow label="Full name" value={profile.fullName} />
      <SectionRow label="Age" value={profile.age ? String(profile.age) : ""} />
      <SectionRow label="Height" value={profile.height ? profile.heightText : ""} />
      <SectionRow label="Marital status" value={maritalLabel(profile.maritalStatus)} />
      <SectionRow label="Mother tongue" value={profile.motherTongue} />
      <SectionRow label="Religion" value={profile.religion} />
      <SectionRow label="Community" value={profile.community} />
      <SectionRow label="Caste" value={profile.caste} />
      <SectionRow label="Location" value={place(profile.city, profile.state)} />
    </SectionCard>
  );
}

export function EducationCareerCard({ profile }: { profile: Profile }) {
  return (
    <SectionCard title="Education & Career">
      <SectionRow label="Education" value={profile.education} />
      <SectionRow label="College / University" value={profile.college} />
      <SectionRow label="Profession" value={profile.profession} />
      <SectionRow label="Company" value={profile.company} />
      <SectionRow label="Annual income" value={profile.income} />
    </SectionCard>
  );
}

export function FamilyDetailsCard({ profile }: { profile: Profile }) {
  return (
    <SectionCard title="Family Details">
      <SectionRow label="Father's occupation" value={profile.family.fatherOccupation} />
      <SectionRow label="Mother's occupation" value={profile.family.motherOccupation} />
      <SectionRow label="Siblings" value={siblings(profile)} />
      <SectionRow label="Family type" value={profile.family.familyType} />
      <SectionRow label="Family location" value={profile.family.familyLocation} />
      <SectionRow label="Family values" value={profile.family.familyValues} />
      <SectionRow label="Gotra" value={profile.family.gotra} />
      <SectionRow
        label="Horoscope"
        value={profile.family.horoscopeRequired ? "Required" : "Not required"}
      />
    </SectionCard>
  );
}

export function LifestyleCard({ profile }: { profile: Profile }) {
  return (
    <SectionCard title="Lifestyle">
      <SectionRow label="Diet" value={lifestyleLabel(profile.lifestyle.diet)} />
      <SectionRow label="Drinking" value={lifestyleLabel(profile.lifestyle.drinking)} />
      <SectionRow label="Smoking" value={lifestyleLabel(profile.lifestyle.smoking)} />
      <SectionRow label="Hobbies" value={joined(profile.lifestyle.hobbies)} />
      <SectionRow label="Fitness" value={profile.lifestyle.fitness} />
      <SectionRow label="Music" value={profile.lifestyle.music} />
      <SectionRow label="Food preference" value={profile.lifestyle.food} />
      <SectionRow label="Appearances" value={profile.lifestyle.appearances} />
    </SectionCard>
  );
}

// only the detail view carries this: someone's own page showing their own
// partner preferences back at them is noise
export function PartnerPreferenceCard({ profile }: { profile: Profile }) {  return (
    <SectionCard title="Looking For">
      <SectionRow
        label="Age range"
        value={`${profile.preference.minAge} – ${profile.preference.maxAge} years`}
      />
      <SectionRow
        label="Height range"
        value={`${profile.preference.minHeight} – ${profile.preference.maxHeight} cm`}
      />
      <SectionRow label="Religion" value={profile.preference.religion} />
      <SectionRow label="Communities" value={joined(profile.preference.communities)} />
      <SectionRow label="Mother tongues" value={joined(profile.preference.motherTongues)} />
      <SectionRow label="Education" value={joined(profile.preference.education)} />
      <SectionRow label="Professions" value={joined(profile.preference.professions)} />
      <SectionRow label="Locations" value={joined(profile.preference.locations)} />
    </SectionCard>
  );
}
