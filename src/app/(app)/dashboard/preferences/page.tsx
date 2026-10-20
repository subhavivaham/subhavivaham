"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/lib/state/toast-provider";
import { loadOwnProfile } from "@/features/profiles/queries";
import { useAuth } from "@/features/auth/auth-provider";
import {
  RELIGIONS,
  MOTHER_TONGUES,
  EDUCATION_OPTIONS,
  PROFESSION_OPTIONS,
  HEIGHTS,
  INDIAN_STATES,
} from "@/lib/constants";
import type { Diet, Drink, Smoke, Profile } from "@/types";

// the form is a comma-separated mirror of the preference arrays on the row, so
// it is shaped from the member's own profile rather than from a bundled example
interface PreferenceForm {
  minAge: number;
  maxAge: number;
  minHeight: number;
  maxHeight: number;
  religion: string;
  motherTongues: string;
  education: string;
  professions: string;
  locations: string;
  diet: Diet;
  smoking: Smoke;
  drinking: Drink;
  maritalStatuses: string;
}

function formFrom(profile: Profile): PreferenceForm {
  const pref = profile.preference;
  return {
    minAge: pref.minAge,
    maxAge: pref.maxAge,
    minHeight: pref.minHeight,
    maxHeight: pref.maxHeight,
    religion: pref.religion,
    motherTongues: pref.motherTongues.join(", "),
    education: pref.education.join(", "),
    professions: pref.professions.join(", "),
    locations: pref.locations.join(", "),
    diet: pref.diet,
    smoking: pref.smoking,
    drinking: pref.drinking,
    maritalStatuses: pref.maritalStatuses.join(", "),
  };
}

export default function PartnerPreferencesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const toast = useToast();

  // the signed-in member's own row. the id travels with the result so a slow
  // response for a previous member can never be rendered for the current one
  const profileId = user?.profileId;
  const [fetched, setFetched] = useState<{ id: string; profile?: Profile } | null>(null);
  const [form, setForm] = useState<PreferenceForm | null>(null);

  useEffect(() => {
    if (authLoading || !profileId) return;
    let cancelled = false;

    void loadOwnProfile(profileId).then((found) => {
      if (cancelled) return;
      setFetched({ id: profileId, profile: found });
      setForm(found ? formFrom(found) : null);
    });

    return () => {
      cancelled = true;
    };
  }, [authLoading, profileId]);

  const profile = fetched && fetched.id === profileId ? fetched.profile : undefined;
  const loaded = Boolean(fetched && fetched.id === profileId);

  const set = <K extends keyof PreferenceForm>(key: K, value: PreferenceForm[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = () => {
    toast("Partner preferences saved.", "success");
  };

  const ageOptions = Array.from({ length: 38 }, (_, i) => 18 + i);

  if (authLoading || (profileId && !loaded)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-wine-700 border-t-transparent" />
      </div>
    );
  }

  if (!profile || !form) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight text-charcoal-900 sm:text-3xl">
            <SlidersHorizontal className="h-6 w-6 text-wine-600" /> Partner Preferences
          </h1>
          <p className="mt-1 text-charcoal-500">
            We could not find your profile details yet. Please refresh in a moment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight text-charcoal-900 sm:text-3xl">
          <SlidersHorizontal className="h-6 w-6 text-wine-600" /> Partner Preferences
        </h1>
        <p className="mt-1 text-charcoal-500">
          The matching engine uses these preferences to surface your daily matches.
        </p>
      </div>

      <section className="rounded-3xl border border-charcoal-100 bg-white p-6 shadow-card sm:p-8">
        <h2 className="mb-5 font-display text-xl font-semibold text-charcoal-900">Basic preference</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Minimum age"
            value={form.minAge}
            onChange={(e) => set("minAge", Number(e.target.value))}
          >
            {ageOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <Select
            label="Maximum age"
            value={form.maxAge}
            onChange={(e) => set("maxAge", Number(e.target.value))}
          >
            {ageOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <Select
            label="Minimum height (cm)"
            value={form.minHeight}
            onChange={(e) => set("minHeight", Number(e.target.value))}
          >
            {HEIGHTS.map((h) => (
              <option key={h} value={h}>
                {h} cm
              </option>
            ))}
          </Select>
          <Select
            label="Maximum height (cm)"
            value={form.maxHeight}
            onChange={(e) => set("maxHeight", Number(e.target.value))}
          >
            {HEIGHTS.map((h) => (
              <option key={h} value={h}>
                {h} cm
              </option>
            ))}
          </Select>
          <Select
            label="Religion"
            value={form.religion}
            onChange={(e) => set("religion", e.target.value)}
          >
            <option value="" disabled>
              Select religion
            </option>
            {RELIGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <Input
            label="Mother tongues (comma separated)"
            value={form.motherTongues}
            onChange={(e) => set("motherTongues", e.target.value)}
            list="mt-options"
          />
          <datalist id="mt-options">
            {MOTHER_TONGUES.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <Select
            label="Lives in"
            value=""
            onChange={() => undefined}
            hint="Enter preferred states below"
          >
            <option value="" disabled>
              State list
            </option>
          </Select>
        </div>
        <div className="mt-4">
          <Input
            label="Preferred locations (comma separated)"
            value={form.locations}
            onChange={(e) => set("locations", e.target.value)}
            list="state-options"
          />
          <datalist id="state-options">
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </section>

      <section className="rounded-3xl border border-charcoal-100 bg-white p-6 shadow-card sm:p-8">
        <h2 className="mb-5 font-display text-xl font-semibold text-charcoal-900">Education & career</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Education (comma separated)"
            value={form.education}
            onChange={(e) => set("education", e.target.value)}
            list="edu-options"
          />
          <datalist id="edu-options">
            {EDUCATION_OPTIONS.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
          <Input
            label="Professions (comma separated)"
            value={form.professions}
            onChange={(e) => set("professions", e.target.value)}
            list="prof-options"
          />
          <datalist id="prof-options">
            {PROFESSION_OPTIONS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
      </section>

      <section className="rounded-3xl border border-charcoal-100 bg-white p-6 shadow-card sm:p-8">
        <h2 className="mb-5 font-display text-xl font-semibold text-charcoal-900">Lifestyle</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="Diet" value={form.diet} onChange={(e) => set("diet", e.target.value as Diet)}>
            <option value="vegetarian">Vegetarian</option>
            <option value="non-vegetarian">Non-Vegetarian</option>
            <option value="eggetarian">Eggetarian</option>
            <option value="jain">Jain/Sattvik</option>
            <option value="vegan">Vegan</option>
          </Select>
          <Select
            label="Drinking"
            value={form.drinking}
            onChange={(e) => set("drinking", e.target.value as Drink)}
          >
            <option value="never">Never</option>
            <option value="occasionally">Occasionally</option>
            <option value="socially">Socially</option>
          </Select>
          <Select
            label="Smoking"
            value={form.smoking}
            onChange={(e) => set("smoking", e.target.value as Smoke)}
          >
            <option value="never">Never</option>
            <option value="occasionally">Occasionally</option>
            <option value="yes">Yes</option>
          </Select>
          <Textarea
            label="Marital status (comma separated)"
            value={form.maritalStatuses}
            onChange={(e) => set("maritalStatuses", e.target.value)}
            className="sm:col-span-2"
          />
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setForm(formFrom(profile))}>
          Reset
        </Button>
        <Button onClick={save}>
          <Save className="h-4 w-4" /> Save Preferences
        </Button>
      </div>
    </div>
  );
}
