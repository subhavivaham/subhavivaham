"use client";

import { useState } from "react";
import { SlidersHorizontal, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/lib/state/toast-provider";
import { profiles } from "@/features/profiles/data";
import {
  RELIGIONS,
  MOTHER_TONGUES,
  EDUCATION_OPTIONS,
  PROFESSION_OPTIONS,
  HEIGHTS,
  INDIAN_STATES,
} from "@/lib/constants";
import type { Diet, Drink, Smoke } from "@/types";

export default function PartnerPreferencesPage() {
  const pref = profiles[0].preference;
  const toast = useToast();

  const [form, setForm] = useState({
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
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = () => {
    toast("Partner preferences saved (demo).", "success");
  };

  const ageOptions = Array.from({ length: 38 }, (_, i) => 18 + i);

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
        <Button
          variant="outline"
          onClick={() => setForm({
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
          })}
        >
          Reset
        </Button>
        <Button onClick={save}>
          <Save className="h-4 w-4" /> Save Preferences
        </Button>
      </div>
    </div>
  );
}