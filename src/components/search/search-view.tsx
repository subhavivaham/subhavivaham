"use client";

import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { SearchFilters } from "@/components/search/search-filters";
import { loadPublicProfiles } from "@/lib/data/public-actions";
import { ProfileGrid } from "@/components/profile/profile-card";
import { EmptyState } from "@/components/ui/states";
import { SearchX } from "lucide-react";
import { filterProfiles as searchProfilesFrom } from "@/features/profiles/queries";
import type {
  SearchFilters as SearchFiltersType,
  SortKey,
} from "@/features/search/types";
import type { Gender, Profile } from "@/types";
import { cn } from "@/lib/utils";

const sortOptions: { label: string; value: SortKey }[] = [
  { label: "Recommended", value: "recommended" },
  { label: "Recently Active", value: "recently-active" },
  { label: "Newest", value: "newest" },
  { label: "Age (youngest)", value: "age" },
];

const defaultFilters: Omit<SearchFiltersType, "gender"> = {
  ageMin: 18,
  ageMax: 55,
};

// the toolbar row on desktop and the sheet on a phone both need this, and they
// must not be able to drift apart, so the control is written once. the class is
// left to the caller because the two want different widths.
function SortSelect({
  value,
  onChange,
  className,
  full,
}: {
  value: SortKey;
  onChange: (value: SortKey) => void;
  className?: string;
  full?: boolean;
}) {
  return (
    <label className={cn("items-center gap-2 text-sm text-charcoal-500", full ? "flex flex-col items-stretch" : "flex", className)}>
      Sort
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className={cn(
          "h-10 rounded-xl border border-charcoal-200 bg-white px-3 text-sm font-medium text-charcoal-800 focus:border-wine-400 focus:outline-none",
          full && "w-full"
        )}
      >
        {sortOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function SearchView({
  gender = "female",
  heading = true,
}: {
  gender?: Gender;
  // the member browse pages already carry a page header, so they switch this off
  // rather than stack a second h1 under it
  heading?: boolean;
}) {
  const [filters, setFilters] = useState<SearchFiltersType>({ ...defaultFilters, gender });
  const [sort, setSort] = useState<SortKey>("recommended");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [source, setSource] = useState<Profile[] | null>(null);

  // pull the rows once, then filter and sort locally so the filter controls
  // stay instant
  useEffect(() => {
    let live = true;
    void (async () => {
      const rows = await loadPublicProfiles();
      if (live) setSource(rows);
    })();
    return () => {
      live = false;
    };
  }, []);

  const profiles = useMemo(
    () => (source ? searchProfilesFrom(source, filters, sort) : []),
    [source, filters, sort]
  );

  const resultsHeading = useMemo(() => {
    if (!filters.gender) return "All profiles";
    return filters.gender === "male" ? "Bridegrooms" : "Brides";
  }, [filters.gender]);

  // one reset for both filter panels. the sheet closes with it, otherwise a tap
  // on clear leaves the panel covering the very results it just restored.
  const resetFilters = () => {
    setFilters({ ...defaultFilters, gender });
    setDrawerOpen(false);
  };

  return (
    <div className="space-y-6">
      {heading ? (
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-charcoal-900 sm:text-4xl">
            Discover {resultsHeading.toLowerCase()}
          </h1>
          <p className="mt-2 text-charcoal-500">
            Refine your search to find profiles that truly match what you&apos;re looking for.
          </p>
        </div>
      ) : null}

      {/* the filters stay in a left sidebar on desktop, sticky so a long filter
          list never runs past the grid. the page itself keeps the full width the
          shell gives it, so the grid takes everything the sidebar leaves */}
      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        <div className="hidden lg:block">
          <div className="sticky top-24">
            <SearchFilters
              value={filters}
              onChange={setFilters}
              onClear={resetFilters}
              className="max-h-[calc(100vh-8rem)] overflow-y-auto"
            />
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-charcoal-600">
              <span className="font-semibold text-charcoal-900">{profiles.length}</span>{" "}
              profiles found
            </p>
            <div className="flex items-center gap-2">
              {/* the sidebar is hidden below lg, so the same filters open from a
                  left sheet behind this icon on a phone */}
              <button
                onClick={() => setDrawerOpen(true)}
                aria-label="Open filters"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-charcoal-200 bg-white text-charcoal-700 shadow-sm transition-colors hover:border-wine-300 hover:text-wine-700 lg:hidden"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
              <SortSelect
                value={sort}
                onChange={setSort}
                className="hidden lg:flex"
              />
            </div>
          </div>

          {source === null ? (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-72 animate-pulse rounded-2xl bg-charcoal-100"
                />
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No profiles found"
              description="Try widening your filters or clearing a few preferences to see more matches."
              className="mt-4"
            />
          ) : (
            <ProfileGrid profiles={profiles} className="mt-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" />
          )}
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button
            aria-label="Close filters"
            className="absolute inset-0 bg-charcoal-950/50"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm animate-slide-in-left flex-col rounded-r-2xl bg-ivory-50 p-4 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="font-display text-xl font-semibold text-charcoal-900">Refine search</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close filters"
                className="rounded-full p-2 text-charcoal-500 hover:bg-charcoal-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {/* on a phone the toolbar has no room for two controls, so sort
                  rides at the top of the sheet with the rest of the settings */}
              <div className="mb-3 rounded-2xl border border-charcoal-100 bg-white p-4 shadow-card">
                <SortSelect value={sort} onChange={setSort} full />
              </div>
              <SearchFilters
                value={filters}
                onChange={setFilters}
                onClear={resetFilters}
                onApply={() => setDrawerOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
