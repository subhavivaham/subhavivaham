"use server";

// database-backed profile loaders, as server actions. client pages (dashboard,
// matches, preferences) call these over the wire, so db.ts and mysql2 never
// enter the browser bundle; server pages import them directly and they run
// in-process. the pure filter/sort logic stays in ./queries, which is the only
// half of that module client code is allowed to import.
import { fetchOwnProfile, fetchProfiles } from "@/lib/data/queries";
import { filterProfiles } from "@/features/profiles/queries";
import type { SearchFilters, SortKey } from "@/features/search/types";
import type { Profile } from "@/types";

// the rows are read from the database and then filtered and sorted, so the
// filter controls stay instant. no percentage is attached here: a public
// visitor has no preferences of their own to score against
export async function loadSearchProfiles(
  filters: SearchFilters = {},
  sort: SortKey = "recommended"
): Promise<Profile[]> {
  return filterProfiles(await fetchProfiles(), filters, sort);
}

export async function loadRecommendedMatches(
  current: Profile | undefined,
  limit = 24
): Promise<Profile[]> {
  if (!current) return [];
  const allProfiles = await fetchProfiles();
  const pref = current.preference;
  const filters: SearchFilters = {
    gender: current.gender === "male" ? "female" : "male",
    ageMin: pref.minAge,
    ageMax: pref.maxAge,
    // an unset pref_religion column maps to "", which must never become a
    // filter that matches nobody
    religion: pref.religion && pref.religion !== "Any" ? pref.religion : undefined,
    community: pref.communities.includes("Any") ? undefined : pref.communities[0],
    education: pref.education.includes("Any") ? undefined : pref.education[0],
    profession: pref.professions.includes("Any") ? undefined : pref.professions[0],
    diet: pref.diet,
    smoking: pref.smoking,
    drinking: pref.drinking,
  };
  const candidates = allProfiles.filter((p) => p.id !== current.id);
  return filterProfiles(candidates, filters, "recommended", current).slice(0, limit);
}

export async function loadProfile(id: string): Promise<Profile | undefined> {
  return (await fetchProfiles()).find((p) => p.id === id);
}

// the member's own row, which is readable before an admin has verified it. the
// public loadProfile above goes through fetchProfiles and so hides anything that
// is not verified+active, which is correct for browsing other members but wrong
// for the owner's own dashboard and profile page.
export async function loadOwnProfile(id: string): Promise<Profile | undefined> {
  return (await fetchOwnProfile(id)) ?? undefined;
}
