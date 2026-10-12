"use client";

import { useMemo } from "react";
import type { Gender, Profile } from "@/types";
import { ProfileGrid } from "@/components/profile/profile-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { filterProfiles } from "@/features/profiles/queries";
import { HOME_SEARCH_DEFAULTS, useHomeSearch } from "@/features/search/home-search";
import { CONTAINER } from "@/lib/constants";

export function FeaturedProfiles({
  profiles,
  limit = 6,
}: {
  profiles: Profile[];
  limit?: number;
}) {
  const homeSearch = useHomeSearch();
  const filters = homeSearch?.filters ?? HOME_SEARCH_DEFAULTS;

  // the whole list arrives from the server and the search narrows it here, the
  // same way the search page filters, so the two can never disagree. the cap is
  // applied after filtering rather than before, otherwise a narrow search would
  // have nothing to show.
  //
  // "newest" orders by profile_created_on, which is what the heading promises.
  // "recently-active" would order by last_active and quietly show the profiles
  // people happened to log in most recently instead.
  const results = useMemo(
    () =>
      filterProfiles(
        profiles,
        {
          // the widget offers a fixed male/female pair, so this cast cannot fail
          gender: (filters.gender || undefined) as Gender | undefined,
          ageMin: filters.ageMin ? Number(filters.ageMin) : undefined,
          ageMax: filters.ageMax ? Number(filters.ageMax) : undefined,
          religion: filters.religion || undefined,
          location: filters.location || undefined,
        },
        "newest"
      ).slice(0, limit),
    [profiles, filters, limit]
  );


  return (
    <section
      id="featured-profiles"
      className="scroll-mt-20 bg-white py-16 sm:py-20"
    >
      <div className={`${CONTAINER} pt-0 sm:pt-0`}>
        <SectionHeading
          eyebrow="Featured profiles"
          title="Recently joined, ready to connect"
          description="Hand-picked profiles from across India. One click away from a conversation."
        />
      </div>

      <div className={CONTAINER}>
        {results.length > 0 ? (
          <Reveal amount={0.05}>
            <ProfileGrid profiles={results} />
          </Reveal>
        ) : (
          <div className="rounded-2xl border border-dashed border-charcoal-200 bg-ivory-50 px-6 py-14 text-center">
            <p className="text-sm font-semibold text-charcoal-900">
              No profiles match this search yet
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
