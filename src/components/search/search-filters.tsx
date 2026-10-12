"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { CheckboxField } from "@/components/ui/checkbox";
import type { SearchFilters as SearchFiltersType } from "@/features/search/types";
import type { Drink, Smoke } from "@/types";
import {
  RELIGIONS,
  MOTHER_TONGUES,
  EDUCATION_OPTIONS,
  PROFESSION_OPTIONS,
  INCOME_RANGES,
  TAMIL_NADU_DISTRICTS,
} from "@/lib/constants";

export interface SearchFiltersProps {
  value: SearchFiltersType;
  onChange: (filters: SearchFiltersType) => void;
  onApply?: () => void;
  onClear: () => void;
  className?: string;
}

function chipOptions<T extends string | number>(value: T | undefined, set: (v: T | undefined) => void, options: T[], label: (v: T) => string) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={String(opt)}
            type="button"
            onClick={() => set(active ? undefined : opt)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "border-wine-700 bg-wine-700 text-white"
                : "border-charcoal-200 bg-white text-charcoal-600 hover:border-wine-300 hover:text-wine-700"
            )}
          >
            {label(opt)}
          </button>
        );
      })}
    </div>
  );
}

export function SearchFilters({ value, onChange, onApply, onClear, className }: SearchFiltersProps) {
  const set = (patch: Partial<SearchFiltersType>) => onChange({ ...value, ...patch });
  const v = value;

  return (
    <div className={cn("space-y-6 rounded-2xl border border-charcoal-100 bg-white p-5 shadow-card", className)}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-charcoal-900">Filters</h2>
        <button
          onClick={onClear}
          className="text-sm font-medium text-wine-700 transition-colors hover:text-wine-800"
        >
          Clear all
        </button>
      </div>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">Age</h3>
        <div className="grid grid-cols-2 gap-2">
          <Select value={String(v.ageMin ?? 18)} onChange={(e) => set({ ageMin: Number(e.target.value) })}>
            {Array.from({ length: 40 }, (_, i) => 18 + i).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
          <Select value={String(v.ageMax ?? 55)} onChange={(e) => set({ ageMax: Number(e.target.value) })}>
            {Array.from({ length: 40 }, (_, i) => 18 + i).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">Location</h3>
        <Select
          value={v.location ?? ""}
          onChange={(e) => set({ location: e.target.value })}
        >
          <option value="">Any location</option>
          {TAMIL_NADU_DISTRICTS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">Religion</h3>
        {chipOptions(v.religion, (r) => set({ religion: r }), RELIGIONS, (r) => r)}
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">Mother tongue</h3>
        <select
          value={v.motherTongue ?? ""}
          onChange={(e) => set({ motherTongue: e.target.value || undefined })}
          className="h-11 w-full rounded-xl border border-charcoal-200 bg-white px-3 text-sm text-charcoal-900 focus:border-wine-400 focus:outline-none"
        >
          <option value="">Any</option>
          {MOTHER_TONGUES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">Education</h3>
        <select
          value={v.education ?? ""}
          onChange={(e) => set({ education: e.target.value || undefined })}
          className="h-11 w-full rounded-xl border border-charcoal-200 bg-white px-3 text-sm text-charcoal-900 focus:border-wine-400 focus:outline-none"
        >
          <option value="">Any</option>
          {EDUCATION_OPTIONS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">Profession</h3>
        <select
          value={v.profession ?? ""}
          onChange={(e) => set({ profession: e.target.value || undefined })}
          className="h-11 w-full rounded-xl border border-charcoal-200 bg-white px-3 text-sm text-charcoal-900 focus:border-wine-400 focus:outline-none"
        >
          <option value="">Any</option>
          {PROFESSION_OPTIONS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">Height (cm)</h3>
        <div className="grid grid-cols-2 gap-2">
          <Select value={String(v.heightMin ?? 145)} onChange={(e) => set({ heightMin: Number(e.target.value) })}>
            {Array.from({ length: 25 }, (_, i) => 145 + i * 2).map((hcm) => (
              <option key={hcm} value={hcm}>{hcm} cm</option>
            ))}
          </Select>
          <Select value={String(v.heightMax ?? 193)} onChange={(e) => set({ heightMax: Number(e.target.value) })}>
            {Array.from({ length: 25 }, (_, i) => 145 + i * 2).map((hcm) => (
              <option key={hcm} value={hcm}>{hcm} cm</option>
            ))}
          </Select>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">Marital status</h3>
        {chipOptions(v.maritalStatus, (m) => set({ maritalStatus: m }), ["single", "divorced", "widowed"] as const, (m) =>
          m.charAt(0).toUpperCase() + m.slice(1)
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">Diet</h3>
        {chipOptions(v.diet, (d) => set({ diet: d }), ["vegetarian", "eggetarian", "jain", "vegan", "non-vegetarian"] as const, (d) => d)}
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">Drinking / Smoking</h3>
        <div className="grid grid-cols-2 gap-2">
          <select value={v.drinking ?? ""} onChange={(e) => set({ drinking: (e.target.value || undefined) as Drink })} className="h-11 rounded-xl border border-charcoal-200 bg-white px-3 text-sm focus:border-wine-400 focus:outline-none">
            <option value="">Any drinking</option>
            <option value="never">Never</option>
            <option value="occasionally">Occasionally</option>
            <option value="socially">Socially</option>
          </select>
          <select value={v.smoking ?? ""} onChange={(e) => set({ smoking: (e.target.value || undefined) as Smoke })} className="h-11 rounded-xl border border-charcoal-200 bg-white px-3 text-sm focus:border-wine-400 focus:outline-none">
            <option value="">Any smoking</option>
            <option value="never">Never</option>
            <option value="occasionally">Occasionally</option>
            <option value="yes">Yes</option>
          </select>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">Income</h3>
        <select value={v.income ?? ""} onChange={(e) => set({ income: e.target.value || undefined })} className="h-11 w-full rounded-xl border border-charcoal-200 bg-white px-3 text-sm focus:border-wine-400 focus:outline-none">
          <option value="">Any</option>
          {INCOME_RANGES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </section>

      <section className="space-y-3">
        <CheckboxField
          checked={Boolean(v.withPhoto)}
          onChange={(c) => set({ withPhoto: c })}
          label="Profiles with photo only"
        />
        <span className="block h-0"></span>
        <div className="pt-1">
          <Button onClick={onApply} fullWidth size="lg">
            Apply Filters
          </Button>
        </div>
      </section>
    </div>
  );
}
