import type { Profile } from "@/types";
import type { SearchFilters, SortKey } from "@/features/search/types";
import { profiles } from "@/features/profiles/data";
import { PHOTO_QUOTA } from "@/lib/payments/quotas";

export interface DashboardStats {
  newMatches: number;
  interestsReceived: number;
  interestsSent: number;
  profileViews: number;
}

const RELIGION_WEIGHT = 0.28;
const LOCATION_WEIGHT = 0.16;
const AGE_WEIGHT = 0.14;
const EDUCATION_WEIGHT = 0.12;
const PROFESSION_WEIGHT = 0.1;
const LIFESTYLE_WEIGHT = 0.2;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function computeMatchScore(
  profile: Profile,
  current: Profile = profiles[0]
): number {
  const pref = current.preference;
  const scores: number[] = [];

  if (profile.age >= pref.minAge && profile.age <= pref.maxAge) {
    scores.push(1);
  } else if (profile.age < pref.minAge) {
    scores.push(0.5);
  } else {
    scores.push(0.6);
  }

  // the preference is picked as a state, but the seed data still stores cities
  // in pref_locations, so both are compared
  const inLocation =
    pref.locations.length === 0 ||
    pref.locations.some(
      (l) =>
        l.toLowerCase() === profile.city.toLowerCase() ||
        l.toLowerCase() === profile.state.toLowerCase()
    );
  scores.push(inLocation ? 1 : 0.55);

  const religionOk =
    pref.religion === "Any" || pref.religion === profile.religion;
  const communityOk = pref.communities.some(
    (c) => c === "Any" || c === profile.community
  );
  scores.push(religionOk && communityOk ? 1 : 0.7);

  const eduOk = pref.education.some(
    (e) =>
      e === "Any" ||
      profile.education.toLowerCase().includes(e.toLowerCase().split(" ")[0])
  );
  scores.push(eduOk ? 1 : 0.75);

  const profOk = pref.professions.some(
    (p) => p.toLowerCase() === profile.profession.toLowerCase()
  );
  scores.push(profOk ? 1 : 0.8);

  let lifestyle = 0;
  if (pref.diet === profile.lifestyle.diet) lifestyle += 0.4;
  else lifestyle += 0.2;
  if (pref.smoking === "never" && profile.lifestyle.smoking !== "never") lifestyle += 0.05;
  else lifestyle += 0.3;
  if (pref.drinking === "never" && profile.lifestyle.drinking !== "never") lifestyle += 0.15;
  else lifestyle += 0.3;
  scores.push(clamp(lifestyle, 0, 1));

  const weighted =
    scores[0] * AGE_WEIGHT +
    scores[1] * LOCATION_WEIGHT +
    scores[2] * RELIGION_WEIGHT +
    scores[3] * EDUCATION_WEIGHT +
    scores[4] * PROFESSION_WEIGHT +
    scores[5] * LIFESTYLE_WEIGHT;

  const totalWeight =
    AGE_WEIGHT + LOCATION_WEIGHT + RELIGION_WEIGHT + EDUCATION_WEIGHT + PROFESSION_WEIGHT + LIFESTYLE_WEIGHT;

  const base = Math.round((weighted / totalWeight) * 76) + 18;

  const seed = profile.id.charCodeAt(profile.id.length - 1);
  const jitter = (seed % 7) - 3;
  return clamp(base + jitter, 74, 99);
}

export function withMatch(profile: Profile): Profile {
  if (profile.matchPercentage === undefined) {
    return { ...profile, matchPercentage: computeMatchScore(profile) };
  }
  return profile;
}

export function filterProfiles(
  source: Profile[],
  filters: SearchFilters = {},
  sort: SortKey = "recommended"
): Profile[] {
  let result = source;

  if (filters.gender) result = result.filter((p) => p.gender === filters.gender);
  if (filters.ageMin !== undefined)
    result = result.filter((p) => p.age >= filters.ageMin!);
  if (filters.ageMax !== undefined)
    result = result.filter((p) => p.age <= filters.ageMax!);
  if (filters.location)
    result = result.filter((p) =>
      // the dropdown offers districts, so the district is checked first and the
      // city is still matched to keep free-text locality working
      [p.district ?? "", p.city, p.state, p.country].some((v) =>
        v.toLowerCase().includes(filters.location!.toLowerCase())
      )
    );
  if (filters.religion) result = result.filter((p) => p.religion === filters.religion);
  if (filters.community)
    result = result.filter((p) => p.community.toLowerCase().includes(filters.community!.toLowerCase()));
  if (filters.motherTongue) result = result.filter((p) => p.motherTongue === filters.motherTongue);
  if (filters.education)
    result = result.filter((p) =>
      p.education.toLowerCase().includes(filters.education!.toLowerCase().split(" ")[0])
    );
  if (filters.profession)
    result = result.filter((p) =>
      p.profession.toLowerCase().includes(filters.profession!.toLowerCase())
    );
  if (filters.maritalStatus) result = result.filter((p) => p.maritalStatus === filters.maritalStatus);
  if (filters.heightMin !== undefined) result = result.filter((p) => p.height >= filters.heightMin!);
  if (filters.heightMax !== undefined) result = result.filter((p) => p.height <= filters.heightMax!);
  if (filters.diet) result = result.filter((p) => p.lifestyle.diet === filters.diet);
  if (filters.drinking) result = result.filter((p) => p.lifestyle.drinking === filters.drinking);
  if (filters.smoking) result = result.filter((p) => p.lifestyle.smoking === filters.smoking);
  if (filters.income) result = result.filter((p) => p.income === filters.income);
  if (filters.withPhoto) result = result.filter((p) => p.photos.length > 0);

  result = result.map(withMatch);

  switch (sort) {
    case "recommended":
      result.sort((a, b) => (b.matchPercentage ?? 0) - (a.matchPercentage ?? 0));
      break;
    case "recently-active":
      result.sort(
        (a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
      );
      break;
    case "newest":
      result.sort(
        (a, b) =>
          new Date(b.profileCreatedOn).getTime() - new Date(a.profileCreatedOn).getTime()
      );
      break;
    case "age":
      result.sort((a, b) => a.age - b.age);
      break;
  }

  return result;
}

export function searchProfiles(
  filters: SearchFilters = {},
  sort: SortKey = "recommended"
): Profile[] {
  return filterProfiles(profiles, filters, sort);
}

// database first, seeded data as the fallback, filtering still client side
export async function loadSearchProfiles(
  filters: SearchFilters = {},
  sort: SortKey = "recommended"
): Promise<Profile[]> {
  const { fetchProfiles } = await import("@/lib/data/queries");
  return filterProfiles(await fetchProfiles(), filters, sort);
}

export async function loadRecommendedMatches(limit = 24): Promise<Profile[]> {
  const { fetchProfiles } = await import("@/lib/data/queries");
  const allProfiles = await fetchProfiles();
  const current = allProfiles.find(p => p.id === "p-praveen") || allProfiles[0];
  if (!current) return [];
  const pref = current.preference;
  const filters: SearchFilters = {
    gender: current.gender === "male" ? "female" : "male",
    ageMin: pref.minAge,
    ageMax: pref.maxAge,
    religion: pref.religion !== "Any" ? pref.religion : undefined,
    community: pref.communities.includes("Any") ? undefined : pref.communities[0],
    education: pref.education.includes("Any") ? undefined : pref.education[0],
    profession: pref.professions.includes("Any") ? undefined : pref.professions[0],
    diet: pref.diet,
    smoking: pref.smoking,
    drinking: pref.drinking,
  };
  return filterProfiles(allProfiles, filters, "recommended").slice(0, limit);
}

export async function loadProfile(id: string): Promise<Profile | undefined> {
  const { fetchProfiles } = await import("@/lib/data/queries");
  return (await fetchProfiles()).find((p) => p.id === id);
}

// the member's own row, which is readable before an admin has verified it. the
// public loadProfile above goes through fetchProfiles and so hides anything that
// is not verified+active, which is correct for browsing other members but wrong
// for the owner's own dashboard and profile page.
export async function loadOwnProfile(id: string): Promise<Profile | undefined> {
  const { fetchOwnProfile } = await import("@/lib/data/queries");
  return (await fetchOwnProfile(id)) ?? undefined;
}

export function getRecommendedMatches(limit = 24): Profile[] {
  const current = profiles[0];
  const pref = current.preference;
  const filters: SearchFilters = {
    gender: current.gender === "male" ? "female" : "male",
    ageMin: pref.minAge,
    ageMax: pref.maxAge,
    religion: pref.religion !== "Any" ? pref.religion : undefined,
    community: pref.communities.includes("Any") ? undefined : pref.communities[0],
    education: pref.education.includes("Any") ? undefined : pref.education[0],
    profession: pref.professions.includes("Any") ? undefined : pref.professions[0],
    diet: pref.diet,
    smoking: pref.smoking,
    drinking: pref.drinking,
  };
  return searchProfiles(filters, "recommended").slice(0, limit);
}

export function getNewMatches(limit = 8): Profile[] {
  return searchProfiles({ gender: "female" }, "newest").slice(0, limit);
}

export function getNearbyMatches(limit = 8): Profile[] {
  const nearby = profiles.filter(
    (p) => p.city === profiles[0].city
  );
  return nearby.slice(0, limit).map(withMatch);
}

export function getRecentlyActive(limit = 8): Profile[] {
  return searchProfiles({ gender: "female" }, "recently-active").slice(0, limit);
}

export function getFeaturedProfiles(limit = 4): Profile[] {
  return profiles.slice(0, limit).map(withMatch);
}

export function getDashboardStats(): DashboardStats {
  const received = 2;
  const sent = 3;
  return {
    newMatches: 6,
    interestsReceived: received,
    interestsSent: sent,
    profileViews: 42,
  };
}

// the dashboard used to print a flat 80% and a fixed set of task chips. the
// number is now measured against the member's own row, so a profile filled in
// through the register wizard reports 100% and an empty one reports near zero
// instead of both looking identical.
export interface ProfileCompletion {
  percent: number;
  tasks: Record<string, boolean>;
}

function filled(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

export function computeProfileCompletion(
  p: Profile,
  photoQuota: number = PHOTO_QUOTA.free
): ProfileCompletion {
  // each key is one thing a visitor would look for, so a member can see exactly
  // what is still missing rather than a single opaque percentage
  const tasks: Record<string, boolean> = {
    basics: filled(p.fullName) && filled(p.dateOfBirth) && p.height > 0 && Boolean(p.maritalStatus),
    religion: filled(p.religion) && filled(p.community) && filled(p.motherTongue),
    career: filled(p.education) && filled(p.profession),
    careerDetail: filled(p.college) && filled(p.company) && filled(p.income),
    location: filled(p.city) && filled(p.state) && filled(p.country),
    about: p.about.trim().length >= 40,
    photo: p.photos.length >= 1,
    // the plan's photo allowance is the bar: a free member is whole at 1, while a
    // silver or premium member keeps the prompt until their quota is used up
    enoughPhotos: p.photos.length >= photoQuota,
    family:
      filled(p.family.fatherOccupation) &&
      filled(p.family.motherOccupation) &&
      filled(p.family.familyType) &&
      filled(p.family.familyLocation),
    lifestyle:
      Boolean(p.lifestyle.diet) &&
      Boolean(p.lifestyle.smoking) &&
      Boolean(p.lifestyle.drinking) &&
      p.lifestyle.hobbies.length > 0,
    preference:
      p.preference.minAge > 0 &&
      p.preference.maxAge >= p.preference.minAge &&
      p.preference.communities.length > 0,
    verified: p.verified,
  };

  const total = Object.keys(tasks).length;
  const done = Object.values(tasks).filter(Boolean).length;

  return { percent: Math.round((done / total) * 100), tasks };
}