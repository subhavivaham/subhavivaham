import { cache } from "react";
import { q, q1 } from "@/lib/db";
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

// mysql is the only source of truth. every public read in this module is
// marketing content (verified+active profiles, temples, stories, plans) and is
// deliberately unscoped: private/member reads live in member-dal.ts and must
// always filter by the session's user id, because mysql has no row level
// security to fall back on.

function reportReadFailure(where: string, error: unknown) {
  if (typeof window !== "undefined") return;
  const reason = error instanceof Error ? error.message : String(error);
  console.warn(`[data] read failed: ${where} — ${reason}`);
}

export async function fetchProfiles(): Promise<Profile[]> {
  try {
    const profileRows = await q<ProfileRow>(
      "select * from profiles where verified = 1 and status = 'active'"
    );
    const photoRows = await q<ProfilePhotoRow>(
      "select * from profile_photos order by sort_order"
    );
    const photosByProfile = new Map<string, ProfilePhotoRow[]>();
    for (const photo of photoRows) {
      const list = photosByProfile.get(photo.profile_id) ?? [];
      list.push(photo);
      photosByProfile.set(photo.profile_id, list);
    }
    return profileRows.map((row) => toProfile(row, photosByProfile.get(row.id) ?? []));
  } catch (error) {
    reportReadFailure("profiles", error);
    return [];
  }
}

// the signed-in member's own row. no verified/status filter: a fresh
// registration stays inactive until the admin verifies it, and the owner still
// has to see it on their own dashboard.
export async function fetchOwnProfile(profileId: string): Promise<Profile | null> {
  if (!profileId) return null;
  try {
    const row = await q1<ProfileRow>("select * from profiles where profile_id = ?", [profileId]);
    if (!row) return null;
    const photos = await q<ProfilePhotoRow>(
      "select * from profile_photos where profile_id = ? order by sort_order",
      [row.id]
    );
    return toProfile(row, photos);
  } catch (error) {
    reportReadFailure(`profiles/${profileId}`, error);
    return null;
  }
}

export const fetchCommunities = cache(async (): Promise<Community[]> => {
  try {
    const rows = await q("select * from communities");
    return rows.map(toCommunity);
  } catch (error) {
    reportReadFailure("communities", error);
    return [];
  }
});

export async function fetchPlans(): Promise<MembershipPlan[]> {
  try {
    const rows = await q("select * from membership_plans");
    const list = rows.map(toPlan);
    return [...list].sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) {
    reportReadFailure("membership_plans", error);
    return [];
  }
}

export interface SiteConfig {
  bannerText: string;
  bannerEnabled: boolean;
  officeAddress: string;
}

export async function fetchSiteConfig(): Promise<SiteConfig> {
  try {
    const row = await q1<Pick<SiteConfig, "bannerText" | "bannerEnabled" | "officeAddress">>(
      "select banner_text as bannerText, banner_enabled as bannerEnabled, office_address as officeAddress from site_config where id = 'main'"
    );
    if (!row) return { bannerText: "", bannerEnabled: false, officeAddress: "" };
    return {
      bannerText: String(row.bannerText ?? ""),
      bannerEnabled: Boolean(row.bannerEnabled),
      officeAddress: String(row.officeAddress ?? ""),
    };
  } catch {
    return { bannerText: "", bannerEnabled: false, officeAddress: "" };
  }
}

export async function fetchServices(): Promise<ServiceProvider[]> {
  try {
    const rows = await q(
      "select * from service_providers where is_approved = 1 and active = 1 order by added_at desc"
    );
    return rows.map(toService);
  } catch (error) {
    reportReadFailure("service_providers", error);
    return [];
  }
}

export const fetchTemples = cache(async (): Promise<Temple[]> => {
  try {
    const rows = await q("select * from temples order by added_at desc");
    return rows.map((row) => toTemple(row));
  } catch (error) {
    reportReadFailure("temples", error);
    return [];
  }
});

// today in yyyy-mm-dd, used to drop festivals whose date has passed. read in
// UTC so a server behind IST cannot hide today's festival.
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const fetchTempleById = cache(async (id: string): Promise<Temple | null> => {
  try {
    const row = await q1("select * from temples where temple_id = ?", [id]);
    if (!row) return null;

    const [images, services, festivals] = await Promise.all([
      q("select * from temple_images where temple_id = ? order by sort_order", [id]),
      q("select * from temple_services where temple_id = ? and is_available = 1 order by sort_order", [id]),
      // upcoming only. happens_on is nullable and a null date is kept and
      // sorted last so an unannounced festival still renders by name.
      q(
        `select * from temple_festivals
          where temple_id = ? and (happens_on is null or happens_on >= ?)
          order by (happens_on is null), happens_on, sort_order`,
        [id, todayIso()]
      ),
    ]);

    return toTemple(
      row,
      images.map(toTempleImage),
      festivals.map(toTempleFestival),
      toTempleServicesFromRows(services)
    );
  } catch (error) {
    reportReadFailure(`temples/${id}`, error);
    return null;
  }
});

export const fetchStories = cache(async (): Promise<SuccessStory[]> => {
  try {
    const rows = await q("select * from success_stories");
    return rows.map(toStory);
  } catch (error) {
    reportReadFailure("success_stories", error);
    return [];
  }
});

export async function fetchStory(id: string): Promise<SuccessStory | null> {
  try {
    const row = await q1("select * from success_stories where slug = ? and status = 'published'", [id]);
    if (!row) return null;
    return toStory(row);
  } catch (error) {
    reportReadFailure(`success_stories/${id}`, error);
    return null;
  }
}
