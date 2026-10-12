import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from "@/lib/data/mode";
import type { MembershipPlan, Profile } from "@/types";
import type { Community } from "@/features/communities/data";
import type { ServiceProvider } from "@/features/services/types";
import type { SuccessStory } from "@/features/stories/data";
import type { Temple } from "@/features/temples/types";
import {
  toCommunity,
  toPlan,
  toProfile,
  toService,
  toStory,
  toTemple,
  toTempleFestival,
  toTempleImage,
  toTempleServicesFromRows,
  type ProfilePhotoRow,
  type ProfileRow,
} from "@/lib/data/mappers";

// The database is the only source of truth. There is deliberately no bundled
// seed fallback here: the seed files under src/features are the authoring source
// that gets loaded into the database via seed_data.sql, so anything still being
// read at runtime would be data the operator never approved.

// server components have no window, so asking for the browser client there
// returned null and every loader quietly returned nothing. on the server we
// build a plain publishable key client, which keeps public pages cacheable.
// anything private lives in admin-queries.ts instead, because the cookie backed
// client pulls in next/headers and this module is also reached from client
// components.
// How long a public read may be reused before it is fetched again. Every page in
// this module is public marketing content that changes only when an admin edits
// it, and the admin actions call revalidateTag("public-data") on save, so a
// stale window is the safety net rather than the mechanism.
const PUBLIC_REVALIDATE = 300;

// supabase-js builds its fetch init with only method/headers/body/signal (see
// PostgrestBuilder.buildFetchRequest) and drops every other RequestInit key, so
// a `next` option handed to a query builder never reaches fetch and the Next
// data cache is never populated. Passing this wrapper as the client's fetch is
// what actually puts the public reads into that cache. The tags let an admin
// save invalidate them in one call: "public-data" covers all of it, and the
// table name lets a single table be revalidated on its own.
function revalidatingFetch(
  input: RequestInfo | URL,
  init?: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } }
): Promise<Response> {
  const tags = ["public-data"];
  try {
    const raw =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const url = new URL(raw);
    const table = url.pathname.split("/rest/v1/")[1]?.split("/")[0];
    if (table) tags.push(table);
  } catch {
    // a request that is not a plain url still gets the blanket tag
  }
  return fetch(input, { ...init, next: { revalidate: PUBLIC_REVALIDATE, tags } });
}

// The server keeps one client for the whole process. It used to build a new one
// per query, which re-parsed the url and re-created the auth plumbing on every
// single read. The publishable key is not a session, so sharing it is safe.
let serverClient: SupabaseClient | null = null;

async function client(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return null;
  try {
    if (typeof window !== "undefined") return getSupabase();
    if (!supabaseUrl || !supabaseKey) return null;
    if (!serverClient) {
      serverClient = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: revalidatingFetch },
      });
    }
    return serverClient;
  } catch {
    return null;
  }
}

type Row = Record<string, unknown>;

/**
 * Every failure below collapses to an empty list, because an empty page is
 * preferable to a stack trace on a public marketing site — but a swallowed
 * rejection is also how a row-level security policy or a wrong column name can
 * hide for weeks looking like "no data yet". Log the real reason on the server
 * and let the page degrade quietly.
 */
function reportReadFailure(where: string, error: unknown) {
  if (typeof window !== "undefined") return;
  const reason = error instanceof Error ? error.message : String(error);
  console.warn(`[data] read failed: ${where} — ${reason}`);
}

async function selectFrom(table: string, columns = "*"): Promise<Row[] | null> {
  const sb = await client();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from(table).select(columns);
    if (error) {
      reportReadFailure(table, error.message);
      return null;
    }
    return (data ?? []) as unknown as Row[];
  } catch (error) {
    reportReadFailure(table, error);
    return null;
  }
}

async function mapped<T>(table: string, map: (row: Row) => T): Promise<T[]> {
  const list = await selectFrom(table);
  if (!list) return [];
  return list.map(map);
}

export async function fetchProfiles(): Promise<Profile[]> {
  const sb = await client();
  if (!sb) return [];

  try {
    const [pRes, phRes] = await Promise.all([
      // registration lands a new profile as verified=false / status=inactive,
      // and the admin verification flow flips both on, so the public browse
      // only ever reads live ones. belt and braces on top of the now matching
      // profiles_read policy - an unverified row should not even leave the db.
      sb
        .from("profiles")
        .select("*")
        .eq("verified", true)
        .eq("status", "active"),
      sb.from("profile_photos").select("*").order("sort_order"),
    ]);
    if (pRes.error) return [];

    const profileRows = (pRes.data ?? []) as unknown as ProfileRow[];

    const photosByProfile = new Map<string, ProfilePhotoRow[]>();
    for (const photo of (phRes.data ?? []) as unknown as ProfilePhotoRow[]) {
      const list = photosByProfile.get(photo.profile_id) ?? [];
      list.push(photo);
      photosByProfile.set(photo.profile_id, list);
    }

    return profileRows.map((row) => toProfile(row, photosByProfile.get(row.id) ?? []));
  } catch {
    return [];
  }
}

// the signed-in member's own row. unlike fetchProfiles this applies no verified /
// status filter: a fresh registration is deliberately verified=false /
// status=inactive so it stays out of the public browse, and pairing that gate
// with the owner's own read is what left the dashboard reporting "0% complete"
// for its own member. the read stays private because profiles_read admits the
// owner's own row (and the verified+active public ones) and nothing else, so a
// profile_id that is not the caller's simply returns no row.
export async function fetchOwnProfile(profileId: string): Promise<Profile | null> {
  const sb = await client();
  if (!sb || !profileId) return null;

  try {
    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (error || !data) return null;

    const row = data as unknown as ProfileRow;
    const { data: photoData } = await sb
      .from("profile_photos")
      .select("*")
      .eq("profile_id", row.id)
      .order("sort_order");

    return toProfile(row, (photoData ?? []) as unknown as ProfilePhotoRow[]);
  } catch {
    return null;
  }
}

export const fetchCommunities = cache((): Promise<Community[]> =>
  mapped("communities", toCommunity));

export async function fetchPlans(): Promise<MembershipPlan[]> {
  const list = await mapped("membership_plans", toPlan);
  return [...list].sort((a, b) => a.id.localeCompare(b.id));
}

export interface SiteConfig {
  bannerText: string;
  bannerEnabled: boolean;
  officeAddress: string;
}

export async function fetchSiteConfig(): Promise<SiteConfig> {
  const sb = await client();
  if (!sb) return { bannerText: "", bannerEnabled: false, officeAddress: "" };
  try {
    const { data } = await sb
      .from("site_config")
      .select("banner_text, banner_enabled, office_address")
      .eq("id", "main")
      .maybeSingle();
    if (!data) return { bannerText: "", bannerEnabled: false, officeAddress: "" };
    return {
      bannerText: String(data.banner_text ?? ""),
      bannerEnabled: Boolean(data.banner_enabled),
      officeAddress: String(data.office_address ?? ""),
    };
  } catch {
    return { bannerText: "", bannerEnabled: false, officeAddress: "" };
  }
}

// the public services list. the is_approved filter is pushed into the query rather
// than applied afterwards, so an unapproved row never even leaves the database.
// active is filtered here too, but the read policy already requires both, so the
// .eq calls are belt and braces against a policy that has not been applied yet.
export async function fetchServices(): Promise<ServiceProvider[]> {
  const sb = await client();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from("service_providers")
      .select("*")
      .eq("is_approved", true)
      .eq("active", true)
      .order("added_at", { ascending: false });
    if (error) return [];
    const rows = (data ?? []) as unknown as Row[];
    return rows.map(toService);
  } catch {
    return [];
  }
}

export const fetchTemples = cache(async (): Promise<Temple[]> => {
  const sb = await client();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from("temples")
      .select("*")
      .order("added_at", { ascending: false });
    if (error) {
      reportReadFailure("temples", error.message);
      return [];
    }
    // a select that postgrest answers with 200 and an empty array is not an
    // error, so nothing above reports it. that is exactly the shape of a row
    // level security policy filtering every row out, which is how this table
    // once rendered an empty page with the data sitting right there. say so.
    if (!data?.length) {
      reportReadFailure(
        "temples",
        "query succeeded but returned 0 rows — check the temples_read policy in table_policies.sql"
      );
      return [];
    }
    // wrapped rather than passed as the mapper itself: toTemple's second
    // argument is the gallery, and .map would hand it the array index instead
    return (data as unknown as Record<string, unknown>[]).map((row) => toTemple(row));
  } catch (error) {
    reportReadFailure("temples", error);
    return [];
  }
});

// today in yyyy-mm-dd, used to drop festivals whose date has passed. read in
// UTC rather than local time: the server may not be in IST, and a festival that
// is on today must not disappear because the server is eight hours behind. the
// comparison is date-only so a few hours of skew cannot hide today's festival.
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// one temple by its slug, for the detail route. resolved by maybeSingle so a
// stale or mistyped url is a 404 rather than a crash, and the error is logged
// rather than swallowed into an empty array the way the list query used to.
//
// the gallery, service list and festivals are separate tables and are fetched
// alongside. they used to be read off the temple row, which meant this call
// handed toTemple no gallery and no services at all — the detail page rendered
// "prices are not published yet" on every temple, including the seeded ones that
// have packages. each child is fetched independently and a failure degrades to an
// empty list for that section only: a temple with no readable festivals should
// still show its timings.
export const fetchTempleById = cache(async (id: string): Promise<Temple | null> => {
  const sb = await client();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from("temples")
      .select("*")
      .eq("temple_id", id)
      .maybeSingle();
    if (error) {
      reportReadFailure(`temples/${id}`, error.message);
      return null;
    }
    if (!data) return null;

    const [imagesRes, servicesRes, festivalsRes] = await Promise.all([
      sb.from("temple_images").select("*").eq("temple_id", id).order("sort_order"),
      // is_available is the package on/off switch and the read policy already
      // hides disabled rows from anon, so this only needs to guard against an
      // admin viewing the public page — where the disabled ones should stay out.
      sb
        .from("temple_services")
        .select("*")
        .eq("temple_id", id)
        .eq("is_available", true)
        .order("sort_order"),
      // upcoming only. happens_on is nullable and null sorts after every date in
      // postgres, so `.or("happens_on.is.null,happens_on.gte." + today)` with the
      // date as the secondary sort puts an unannounced festival last rather than
      // dropping it — an admin who entered a name but not a date should not see
      // it silently vanish from their own page.
      sb
        .from("temple_festivals")
        .select("*")
        .eq("temple_id", id)
        .or(`happens_on.is.null,happens_on.gte.${todayIso()}`)
        .order("happens_on", { ascending: true, nullsFirst: false })
        .order("sort_order", { ascending: true }),
    ]);

    if (imagesRes.error) reportReadFailure(`temple_images/${id}`, imagesRes.error.message);
    if (servicesRes.error)
      reportReadFailure(`temple_services/${id}`, servicesRes.error.message);
    if (festivalsRes.error)
      reportReadFailure(`temple_festivals/${id}`, festivalsRes.error.message);

    return toTemple(
      (data ?? {}) as unknown as Row,
      ((imagesRes.data ?? []) as unknown as Row[]).map(toTempleImage),
      ((festivalsRes.data ?? []) as unknown as Row[]).map(toTempleFestival),
      toTempleServicesFromRows(servicesRes.data as unknown as Row[] | null)
    );
  } catch (error) {
    reportReadFailure(`temples/${id}`, error);
    return null;
  }
});

export const fetchStories = cache((): Promise<SuccessStory[]> =>
  mapped("success_stories", toStory));

// one story by its slug. the slug is the public id used in the url and in the
// listing links, so the detail page must resolve it against the same rows the
// listing renders. this used to read a bundled array whose ids had drifted out
// of sync with the table, which is why most cards landed on a 404.
export async function fetchStory(id: string): Promise<SuccessStory | null> {
  const sb = await client();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from("success_stories")
      .select("*")
      .eq("slug", id)
      .eq("status", "published")
      .maybeSingle();
    if (error) {
      reportReadFailure(`success_stories/${id}`, error.message);
      return null;
    }
    if (!data) return null;
    return toStory((data ?? {}) as unknown as Row);
  } catch (error) {
    reportReadFailure(`success_stories/${id}`, error);
    return null;
  }
}
