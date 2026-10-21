// reads for the admin area. every caller has already been through
// requireAdmin()/assertAdmin() — mysql has no row level security, so that gate
// and the explicit user_id filters in the data layer are the whole boundary.
import { cache } from "react";
import { q } from "@/lib/db";
import { reconcileSubscriptions } from "@/lib/data/memberships";
import {
  toCommunity,
  toMembershipPayment,
  toPlan,
  toProfile,
  toService,
  toSubscription,
  toTemple,
  toTempleFestival,
  toTempleImage,
  toTempleServicesFromRows,
  toUser,
  type ProfilePhotoRow,
  type ProfileRow,
} from "@/lib/data/mappers";
import type {
  Temple,
  TempleFestival,
  TempleImage,
  TempleService,
} from "@/features/temples/types";
import type { Community } from "@/features/communities/data";
import type { ServiceProvider } from "@/features/services/types";
import type {
  AdminUser,
  MembershipPayment,
  MembershipPlan,
  MembershipTier,
  Profile,
  Subscription,
} from "@/types";

type Row = Record<string, unknown>;

// Nothing retires a subscription on a schedule, so the first membership read of
// a request applies the lapses.
const reconcileOnce = cache(async () => {
  await reconcileSubscriptions();
});

export async function fetchAdminProfiles(): Promise<Profile[]> {
  const [profileRows, photos] = await Promise.all([
    q<ProfileRow>(
      "select p.*, u.email, u.phone_number from profiles p " +
        "left join users u on u.user_id = p.user_id " +
        "order by (p.profile_created_on is null), p.profile_created_on desc"
    ),
    q<ProfilePhotoRow>("select * from profile_photos order by sort_order"),
  ]);

  const photosByProfile = new Map<string, ProfilePhotoRow[]>();
  for (const photo of photos) {
    const list = photosByProfile.get(photo.profile_id) ?? [];
    list.push(photo);
    photosByProfile.set(photo.profile_id, list);
  }

  return profileRows.map((row) => toProfile(row, photosByProfile.get(row.id) ?? []));
}

export const fetchAdminCommunities = async (): Promise<Community[]> => {
  const rows = await q("select * from communities order by name");
  return rows.map(toCommunity);
};

// the admin list shows each member's tier, which lives on subscriptions, so the
// join happens here rather than in the browser
export const fetchAdminUsers = async (): Promise<AdminUser[]> => {
  await reconcileOnce();

  // explicit column list: password_hash must never leave the database
  const [users, subs] = await Promise.all([
    q<Row>(
      "select user_id, auth_user_id, name, email, role, status, phone_number, " +
        "is_membership_user, membership_plan, joined_at, created_at, updated_at " +
        "from users order by joined_at"
    ),
    q<Row>("select * from subscriptions"),
  ]);

  const tier = new Map<string, MembershipTier>();
  for (const s of subs) {
    if (s.status === "active") tier.set(String(s.user_id), s.plan as MembershipTier);
  }

  return users.map((row) => toUser(row, tier.get(String(row.user_id)) ?? "free"));
};

export const fetchAdminPlans = async (): Promise<MembershipPlan[]> => {
  const rows = await q("select * from membership_plans order by sort_order");
  return rows.map(toPlan);
};

export const fetchAdminSubscriptions = async (): Promise<Subscription[]> => {
  await reconcileOnce();
  const rows = await q("select * from subscriptions order by created_at");
  return rows.map(toSubscription).reverse();
};

// the payment queue. screenshots are stored on the filesystem under
// public/uploads, so the stored path is already the public url.
export const fetchAdminPayments = async (): Promise<MembershipPayment[]> => {
  const rows = await q("select * from membership_payments order by created_at");
  return rows
    .map((row) => {
      const payment = toMembershipPayment(row);
      payment.screenshotUrl = payment.screenshotPath;
      return payment;
    })
    .reverse();
};

export const fetchAdminServices = async (): Promise<ServiceProvider[]> => {
  const rows = await q("select * from service_providers order by added_at");
  return rows.map(toService).reverse();
};

// temples and their galleries in four queries rather than one per temple.
export const fetchAdminTemples = async (): Promise<Temple[]> => {
  const [temples, images, festivals, services] = await Promise.all([
    q<Row>("select * from temples order by added_at"),
    // no date filter here: the admin must see a festival whose date has passed
    // in order to roll it forward — the public query hides those.
    q<Row>("select * from temple_festivals order by sort_order"),
    // services with no is_available filter: the edit form has to show a
    // disabled package so it can be switched back on.
    q<Row>("select * from temple_services order by sort_order"),
    q<Row>("select * from temple_images order by sort_order"),
  ]);

  const imagesByTemple = new Map<string, TempleImage[]>();
  for (const image of images.map(toTempleImage)) {
    const group = imagesByTemple.get(image.templeId);
    if (group) group.push(image);
    else imagesByTemple.set(image.templeId, [image]);
  }

  const festivalsByTemple = new Map<string, TempleFestival[]>();
  for (const festival of festivals.map(toTempleFestival)) {
    const group = festivalsByTemple.get(festival.templeId);
    if (group) group.push(festival);
    else festivalsByTemple.set(festival.templeId, [festival]);
  }

  const servicesByTemple = new Map<string, TempleService[]>();
  for (const row of services) {
    const templeId = String(row.temple_id ?? "");
    const group = servicesByTemple.get(templeId);
    if (group) group.push(...toTempleServicesFromRows([row]));
    else servicesByTemple.set(templeId, toTempleServicesFromRows([row]));
  }

  return temples
    .map((row) => {
      const templeId = String(row.temple_id ?? "");
      return toTemple(
        row,
        imagesByTemple.get(templeId) ?? [],
        festivalsByTemple.get(templeId) ?? [],
        servicesByTemple.get(templeId) ?? []
      );
    })
    .reverse();
};

// one round trip for the dashboard, then the same rollups the old client-side
// useMemo computed.
export async function fetchDashboardData() {
  const [profiles, communities, users, plans, subs, services] = await Promise.all([
    fetchAdminProfiles(),
    fetchAdminCommunities(),
    fetchAdminUsers(),
    fetchAdminPlans(),
    fetchAdminSubscriptions(),
    fetchAdminServices(),
  ]);

  const activeSubs = subs.filter((s) => s.status === "active");
  const paidSubs = activeSubs.filter((s) => s.plan !== "free");
  const listedServices = services.filter((s) => s.isApproved && s.active);
  const pendingServices = services.filter((s) => !s.isApproved);
  const unverifiedProfiles = profiles.filter((p) => !p.verified && p.status !== "rejected");

  return {
    profiles,
    communities,
    users,
    plans,
    subs,
    services,
    verified: profiles.filter((p) => p.verified).length,
    live: profiles.filter((p) => p.status === "active" && p.verified).length,
    activeSubs,
    paidSubs,
    revenue: activeSubs.reduce((sum, s) => sum + s.amount, 0),
    listedServices,
    pendingServices,
    unverifiedProfiles,
  };
}

export type DashboardData = Awaited<ReturnType<typeof fetchDashboardData>>;
