import type {
  AdminUser,
  MembershipPayment,
  MembershipPlan,
  MembershipTier,
  Profile,
  ProfilePhoto,
  Subscription,
} from "@/types";
import type { Community } from "@/features/communities/data";
import type { ServiceProvider } from "@/features/services/types";
import type { SuccessStory } from "@/features/stories/data";
import {
  TEMPLE_DAYS,
  type Temple,
  type TempleDayTiming,
  type TempleFestival,
  type TempleImage,
  type TempleService,
} from "@/features/temples/types";

// shapes returned by postgrest, deliberately loose because the tables are
// read through a typed client that cannot know our jsonb column layouts

export interface ProfileRow {
  id: string;
  profile_id: string;
  user_id: string | null;
  full_name: string;
  gender: string;
  date_of_birth: string | null;
  age: number | null;
  height: number | null;
  marital_status: string;
  religion: string | null;
  community: string | null;
  caste: string | null;
  mother_tongue: string | null;
  state: string | null;
  district: string | null;
  city: string | null;
  education: string | null;
  college: string | null;
  profession: string | null;
  company: string | null;
  income: string | null;
  country: string;
  about: string | null;
  verified: boolean;
  status: string;
  online: boolean;
  last_active: string | null;
  profile_created_on: string | null;
  horoscope_link: string | null;
  // present only on admin reads, which join the users row
  email?: string | null;
  phone_number?: string | null;
  // the public profile_ids this profile has sent an interest to. the only
  // record of a sent interest - there is no interests row written by
  // sendInterest(), so this array is the whole of it. null on a row that has
  // never sent one.
  interested_profile: string[] | null;
  // family
  father_occupation: string | null;
  mother_occupation: string | null;
  brother_count: number;
  sister_count: number;
  family_type: string;
  family_location: string | null;
  family_values: string | null;
  gotra: string | null;
  horoscope_required: boolean;
  // lifestyle
  diet: string;
  smoking: string;
  drinking: string;
  hobbies: string[] | null;
  fitness: string | null;
  sports: string | null;
  music: string | null;
  food: string | null;
  appearances: string | null;
  // partner preference
  min_age: number;
  max_age: number;
  min_height: number;
  max_height: number;
  pref_religion: string | null;
  pref_communities: string[] | null;
  pref_mother_tongues: string[] | null;
  pref_education: string[] | null;
  pref_professions: string[] | null;
  pref_locations: string[] | null;
  pref_income: string | null;
  pref_diet: string | null;
  pref_smoking: string | null;
  pref_drinking: string | null;
  pref_marital_statuses: string[] | null;
}

export interface ProfilePhotoRow {
  id: string;
  profile_id: string;
  url: string;
  is_primary: boolean;
  caption: string | null;
  sort_order: number;
}

const str = (v: string | null | undefined): string => v ?? "";

// numeric columns reach us as a number or as a string depending on the driver,
// and a column the operator never filled in is null. null is kept distinct from
// 0 on purpose: 0,0 is a real coordinate in the atlantic, so collapsing an
// empty box to 0 would render a get-directions link to open water.
const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
// mysql2 can hand json columns back as raw strings (MariaDB stores json as
// text), while the postgrest client returned parsed values. accept both.
export function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function jsonList(value: unknown): string[] {
  const parsed = parseJson<unknown>(value, []);
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : [];
}

const list = jsonList;

export function heightText(height: number): string {
  const feet = Math.floor(height / 30.48);
  const inches = Math.round((height / 2.54) % 12);
  return `${feet}' ${inches}"`;
}

// the app keeps family, lifestyle and preference nested on the profile while the
// database stores them flat on the profiles row, so this rebuilds the nesting
export function toProfile(row: ProfileRow, photos: ProfilePhotoRow[]): Profile {
  const ordered = [...photos].sort((a, b) => a.sort_order - b.sort_order);

  return {
    id: row.profile_id,
    userId: str(row.user_id),
    fullName: row.full_name,
    firstName: row.full_name.trim().split(/\s+/)[0] ?? row.full_name,
    gender: row.gender as Profile["gender"],
    dateOfBirth: str(row.date_of_birth),
    age: row.age ?? 0,
    height: row.height ?? 0,
    heightText: heightText(row.height ?? 0),
    maritalStatus: row.marital_status as Profile["maritalStatus"],
    religion: str(row.religion),
    community: str(row.community),
    caste: str(row.caste),
    motherTongue: str(row.mother_tongue),
    education: str(row.education),
    college: str(row.college),
    profession: str(row.profession),
    company: str(row.company),
    income: str(row.income),
    country: row.country,
    state: str(row.state),
    district: str(row.district),
    city: str(row.city),
    about: str(row.about),
    photos: ordered.map(
      (p): ProfilePhoto => ({
        id: p.id,
        url: p.url,
        isPrimary: p.is_primary,
        ...(p.caption ? { caption: p.caption } : {}),
      })
    ),
    verified: row.verified,
    status: row.status as Profile["status"],
    online: row.online,
    lastActive: str(row.last_active),
    profileCreatedOn: str(row.profile_created_on),
    ...(row.horoscope_link ? { horoscopeLink: row.horoscope_link } : {}),
    ...(row.email ? { email: row.email } : {}),
    ...(row.phone_number ? { mobile: row.phone_number } : {}),
    family: {
      fatherOccupation: str(row.father_occupation),
      motherOccupation: str(row.mother_occupation),
      brotherCount: row.brother_count ?? 0,
      sisterCount: row.sister_count ?? 0,
      familyType: (row.family_type ?? "nuclear") as Profile["family"]["familyType"],
      familyLocation: str(row.family_location),
      familyValues: str(row.family_values),
      gotra: str(row.gotra),
      horoscopeRequired: row.horoscope_required ?? false,
    },
    lifestyle: {
      diet: (row.diet ?? "vegetarian") as Profile["lifestyle"]["diet"],
      smoking: (row.smoking ?? "never") as Profile["lifestyle"]["smoking"],
      drinking: (row.drinking ?? "never") as Profile["lifestyle"]["drinking"],
      hobbies: list(row.hobbies),
      fitness: str(row.fitness),
      sports: str(row.sports),
      music: str(row.music),
      food: str(row.food),
      appearances: str(row.appearances),
    },
    preference: {
      minAge: row.min_age ?? 21,
      maxAge: row.max_age ?? 35,
      minHeight: row.min_height ?? 150,
      maxHeight: row.max_height ?? 190,
      religion: str(row.pref_religion),
      communities: list(row.pref_communities),
      motherTongues: list(row.pref_mother_tongues),
      education: list(row.pref_education),
      professions: list(row.pref_professions),
      locations: list(row.pref_locations),
      income: str(row.pref_income),
      diet: (row.pref_diet ?? "vegetarian") as Profile["preference"]["diet"],
      smoking: (row.pref_smoking ?? "never") as Profile["preference"]["smoking"],
      drinking: (row.pref_drinking ?? "never") as Profile["preference"]["drinking"],
      maritalStatuses: (list(row.pref_marital_statuses).length
        ? list(row.pref_marital_statuses)
        : ["single"]) as Profile["preference"]["maritalStatuses"],
    },
  };
}

export function toCommunity(row: Record<string, unknown>): Community {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    tamilName: String(row.tamil_name ?? ""),
    description: str(row.description as string | null),
    tamilDescription: str(row.tamil_description as string | null),
    visibleMembers: Number(row.visible_members ?? 0),
    active: Boolean(row.active),
  } as Community;
}

export function toPlan(row: Record<string, unknown>): MembershipPlan {
  const id = String(row.id ?? "free") as MembershipTier;
  const price = Number(row.price ?? 0);
  return {
    id,
    name: id,
    label: String(row.label ?? ""),
    price,
    labelPrice: price === 0 ? "Free" : `₹${price.toLocaleString("en-IN")}`,
    period: String(row.period ?? ""),
    popular: Boolean(row.popular),
    features: parseJson<{ label: string; included: boolean }[]>(row.features, []),
    compareFeatures: parseJson<{ label: string; value: boolean | string }[]>(
      row.compare_features,
      []
    ),
    photoLimit: Number(row.photo_limit ?? 1),
    interestLimit: row.interest_limit == null ? null : Number(row.interest_limit),
  };
}

export function toSubscription(row: Record<string, unknown>): Subscription {
  return {
    id: String(row.subscription_id ?? ""),
    userId: String(row.user_id ?? ""),
    memberName: String(row.member_name ?? ""),
    plan: String(row.plan ?? "free") as MembershipTier,
    amount: Number(row.amount ?? 0),
    renewsOn: str(row.renews_on as string | null),
    status: (row.status ?? "active") as Subscription["status"],
    createdAt: str(row.created_at as string | null),
  };
}

export function toMembershipPayment(row: Record<string, unknown>): MembershipPayment {
  return {
    id: String(row.payment_id ?? ""),
    userId: String(row.user_id ?? ""),
    memberName: String(row.member_name ?? ""),
    plan: String(row.plan ?? "free") as MembershipTier,
    planName: String(row.plan_name ?? ""),
    amount: Number(row.amount ?? 0),
    screenshotPath: str(row.screenshot_path as string | null),
    screenshotUrl: "",
    status: (row.status ?? "pending") as MembershipPayment["status"],
    note: str(row.note as string | null),
    createdAt: str(row.created_at as string | null),
    reviewedAt: str(row.reviewed_at as string | null),
  };
}

export function toService(row: Record<string, unknown>): ServiceProvider {
  return {
    id: String(row.service_id ?? ""),
    type: String(row.type ?? ""),
    name: String(row.name ?? ""),
    contact: str(row.contact as string | null),
    city: str(row.city as string | null),
    // a row written before the column existed reads back as null, which is the
    // same as a category that never wanted an address, so both collapse to ""
    address: str(row.address as string | null),
    phone: str(row.phone as string | null),
    details: str(row.details as string | null),
    // a row that predates the is_approved column reads back as null, and
    // Boolean(null) is false, which would unpublish every existing listing on the
    // first load after the migration. fall back to active so only rows that
    // explicitly say false are treated as unapproved.
    isApproved: row.is_approved == null ? Boolean(row.active) : Boolean(row.is_approved),
    active: Boolean(row.active),
    addedAt: str(row.added_at as string | null),
  } as ServiceProvider;
}

// reader for temple_services rows. coerced rather than trusted: price can arrive
// as the string "25000" from jsonb, and anything unparseable drops out so the
// temple still renders.
export function toTempleServicesFromRows(rows: Record<string, unknown>[] | null): TempleService[] {
  if (!Array.isArray(rows)) return [];
  const out: TempleService[] = [];
  for (const row of rows) {
    const name = str(row.name as string | null).trim();
    if (!name) continue;
    const price = Number(row.price);
    out.push({
      name,
      details: str(row.details as string | null).trim(),
      price: Number.isFinite(price) && price > 0 ? Math.round(price) : 0,
    });
  }
  return out;
}

// legacy reader for the old temples.services jsonb array, which the schema no
// longer has. still the default for toTemple so the list query compiles; it
// always yields [] on real data.
function toTempleServices(value: unknown): TempleService[] {
  if (!Array.isArray(value)) return [];
  return toTempleServicesFromRows(value as Record<string, unknown>[]);
}

export function toTempleImage(row: Record<string, unknown>): TempleImage {
  return {
    id: String(row.id ?? ""),
    templeId: String(row.temple_id ?? ""),
    url: str(row.url as string | null),
    alt: str(row.alt as string | null),
    sortOrder: num(row.sort_order) ?? 0,
  };
}

// a date column read through postgrest is "yyyy-mm-dd". if anything longer
// turns up it is a timestamp or an already-formatted string, and neither is
// safe to hand to <input type="date"> — an empty box is recoverable, a silently
// shifted date is not.
function dateOnly(value: string | null): string {
  const raw = str(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

// An admin pastes whatever Google gave them: a long google.com/maps/place/...
// link, a short maps.app.goo.gl one, or occasionally a bare place id. Anything
// that is not recognisably a Google Maps link returns "" so the page falls back
// to an address search rather than rendering a link that 404s.
//
// This is not a security boundary. It exists to catch the common paste mistakes —
// a map url typed into the website box, or a tracking query dropped on the end.
// javascript: urls are refused outright because this value ends up in an href,
// and anything else is dropped.
export function mapsUrl(value: string | null): string {
  const raw = str(value).trim();
  if (!raw) return "";
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return "";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";

  const host = parsed.hostname.replace(/^www\./, "");
  const isGoogle = host === "google.com" || host.endsWith(".google.com");
  const isShort = host === "maps.app.goo.gl" || host.endsWith(".goo.gl");
  // youtu.be is what Google returns for some place shares
  if (!isGoogle && !isShort && host !== "youtu.be") return "";

  return parsed.toString();
}

// The seven weekday columns, in TEMPLE_DAYS order.
//
// Both sides of this file derive their order from TEMPLE_DAYS, and templeTimingsRow
// in the admin actions writes by the same sequence, so a day can never end up
// written to the wrong column. Adding a day means adding it in one place.
//
// every day is present in the result, including the unset ones: the caller decides
// what to hide, and a seven-entry array means the public page never has to guard
// against a missing day.
export function toTempleTimings(row: Record<string, unknown>): TempleDayTiming[] {
  return TEMPLE_DAYS.map((day) => ({
    day,
    hours: str(row[`${day.toLowerCase()}_timings`] as string | null).trim(),
  }));
}

export function toTempleFestival(row: Record<string, unknown>): TempleFestival {
  return {
    id: String(row.id ?? ""),
    templeId: String(row.temple_id ?? ""),
    name: str(row.name as string | null).trim(),
    // supabase returns a date column as "yyyy-mm-dd" already, so it passes
    // through unchanged. a timestamp-shaped value would break the <input
    // type="date"> value, so anything longer than ten characters is dropped
    // rather than sliced: a wrong date is worse than an empty box.
    happensOn: dateOnly(row.happens_on as string | null),
    sortOrder: num(row.sort_order) ?? 0,
  };
}

export function toTemple(
  row: Record<string, unknown>,
  images: TempleImage[] = [],
  festivals: TempleFestival[] = [],
  services: TempleService[] = toTempleServices(row.services)
): Temple {
  return {
    id: String(row.temple_id ?? row.id ?? ""),
    name: String(row.name ?? ""),
    nameTa: str(row.name_ta as string | null),
    deity: str(row.deity as string | null),
    coverImage: str(row.cover_image as string | null),
    address: str(row.address as string | null),
    city: str(row.city as string | null),
    district: str(row.district as string | null),
    state: str(row.state as string | null),
    country: str((row.country as string | null) ?? "India"),
    mapsUrl: mapsUrl(row.maps_url as string | null),
    history: str(row.history as string | null).trim(),
    timings: toTempleTimings(row),
    contact: str(row.contact as string | null),
    whatsapp: str(row.whatsapp as string | null),
    email: str(row.email as string | null),
    contactPerson: str(row.contact_person as string | null),
website: str(row.website as string | null),
// defaults to the legacy jsonb array on the row, which the schema no longer
    // has — so the list query still yields []. fetchTempleById passes the real
    // temple_services rows.
    services,
    images,
    festivals,
    isApproved: row.is_approved == null ? true : Boolean(row.is_approved),
    active: Boolean(row.active),
    addedAt: str(row.added_at as string | null),
  };
}

export function toStory(row: Record<string, unknown>): SuccessStory {
  return {
    id: String(row.slug ?? ""),
    couple: String(row.couple ?? ""),
    shortNames: str(row.short_names as string | null),
    location: str(row.location as string | null),
    image: str(row.image as string | null),
    matchPercent: Number(row.match_percent ?? 0),
    tagline: str(row.tagline as string | null),
    quote: str(row.quote as string | null),
    story: list(row.story as string[] | null),
    daysMatched: str(row.days_matched as string | null),
    status: (row.status ?? "published") as SuccessStory["status"],
  } as SuccessStory;
}

export function toUser(row: Record<string, unknown>, tier: MembershipTier): AdminUser {
  return {
    id: String(row.user_id ?? ""),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    role: (row.role ?? "member") as AdminUser["role"],
    status: (row.status ?? "active") as AdminUser["status"],
    membership: tier,
    joinedAt: str(row.joined_at as string | null),
    phoneNumber: str(row.phone_number as string | null),
    isMembershipUser: Boolean(row.is_membership_user),
    membershipPlan: str(row.membership_plan as string | null),
  };
}
