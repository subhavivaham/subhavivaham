// reads for the admin area. every table reached from here is gated by the
// app_metadata role claim in table_policies.sql, so these only return rows for
// a session that has already been through requireAdmin().
//
// unlike queries.ts there is no seed fallback: an empty result means the table
// really is empty, and a failed request throws instead of quietly rendering
// demo data that an admin would then try to edit.
import { cache } from "react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { PAYMENT_SCREENSHOT_BUCKET } from "@/lib/constants";
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

// public.users.password holds a credential hash, so the columns are listed
// explicitly rather than selecting "*". A hash must never be pulled into the
// admin list and handed to a client component.
const USER_COLUMNS =
  "user_id, auth_user_id, name, email, role, status, phone_number, " +
  "is_membership_user, membership_plan, joined_at, created_at, updated_at";

async function rowsFrom(table: string, order?: string): Promise<Row[]> {
  const supabase = await getSupabaseServer();
  let query = supabase.from(table).select("*");
  if (order) query = query.order(order);
  const { data, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as unknown as Row[];
}

// Nothing retires a subscription on a schedule, so the first membership read of
// a request applies the lapses: overdue rows are flipped to expired and the
// affected members' flags move with them. React.cache keeps the dashboard's
// several loaders to one pass.
const reconcileOnce = cache(async () => {
  const supabase = await getSupabaseServer();
  await reconcileSubscriptions(supabase);
});

export async function fetchAdminProfiles(): Promise<Profile[]> {
  const supabase = await getSupabaseServer();
  const [profilesRes, photosRes] = await Promise.all([
    supabase.from("profiles").select("*").order("profile_created_on", {
      ascending: false,
      nullsFirst: false,
    }),
    supabase.from("profile_photos").select("*").order("sort_order"),
  ]);

  if (profilesRes.error) throw new Error(`profiles: ${profilesRes.error.message}`);

  const profileRows = (profilesRes.data ?? []) as unknown as ProfileRow[];
  const photosByProfile = new Map<string, ProfilePhotoRow[]>();
  for (const photo of (photosRes.data ?? []) as unknown as ProfilePhotoRow[]) {
    const list = photosByProfile.get(photo.profile_id) ?? [];
    list.push(photo);
    photosByProfile.set(photo.profile_id, list);
  }

  return profileRows.map((row) => toProfile(row, photosByProfile.get(row.id) ?? []));
}

export const fetchAdminCommunities = async (): Promise<Community[]> => {
  const rows = await rowsFrom("communities", "name");
  return rows.map(toCommunity);
};

// the admin list shows each member's tier, which lives on subscriptions, so the
// join happens here rather than in the browser
export const fetchAdminUsers = async (): Promise<AdminUser[]> => {
  await reconcileOnce();
  const supabase = await getSupabaseServer();

  const [usersResult, subs] = await Promise.all([
    // explicit column list, see USER_COLUMNS above
    supabase.from("users").select(USER_COLUMNS).order("joined_at"),
    rowsFrom("subscriptions"),
  ]);

  if (usersResult.error) throw new Error(`users: ${usersResult.error.message}`);
  const users = (usersResult.data ?? []) as unknown as Row[];

  const tier = new Map<string, MembershipTier>();
  for (const s of subs) {
    if (s.status === "active") tier.set(String(s.user_id), s.plan as MembershipTier);
  }

  return users.map((row) => toUser(row, tier.get(String(row.user_id)) ?? "free"));
};

export const fetchAdminPlans = async (): Promise<MembershipPlan[]> => {
  const rows = await rowsFrom("membership_plans", "sort_order");
  return rows.map(toPlan);
};

export const fetchAdminSubscriptions = async (): Promise<Subscription[]> => {
  await reconcileOnce();
  const rows = await rowsFrom("subscriptions", "created_at");
  return rows.map(toSubscription).reverse();
};

// the payment queue. the bucket is private, so each screenshot is turned into a
// short-lived signed url here for the admin to view; a stored public url would
// hand every transaction reference to anyone who guessed the path.
export const fetchAdminPayments = async (): Promise<MembershipPayment[]> => {
  const rows = await rowsFrom("membership_payments", "created_at");
  const payments = rows.map(toMembershipPayment).reverse();

  const paths = payments
    .map((payment) => payment.screenshotPath)
    .filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    const supabase = await getSupabaseServer();
    const { data } = await supabase.storage
      .from(PAYMENT_SCREENSHOT_BUCKET)
      .createSignedUrls(paths, 60 * 60);
    const signed = new Map<string, string>();
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
    }
    for (const payment of payments) {
      if (payment.screenshotPath) {
        payment.screenshotUrl = signed.get(payment.screenshotPath) ?? "";
      }
    }
  }

  return payments;
};

export const fetchAdminServices = async (): Promise<ServiceProvider[]> => {
  const rows = await rowsFrom("service_providers", "added_at");
  return rows.map(toService).reverse();
};

// temples and their galleries in two queries rather than one per temple. the
// images are grouped by temple_id here because the rows come back flat, and
// toTemple takes them as an argument rather than reading a join, which postgrest
// would only give us with an embedded resource the loose row type cannot model.
export const fetchAdminTemples = async (): Promise<Temple[]> => {
  const supabase = await getSupabaseServer();
  const [templesRes, imagesRes, festivalsRes, servicesRes] = await Promise.all([
    supabase.from("temples").select("*").order("added_at"),
    supabase.from("temple_images").select("*").order("sort_order"),
    // no date filter here. the admin is editing this list and needs to see a
    // festival whose date has passed in order to roll it forward to next year —
    // the public query hides those, this one deliberately does not.
    supabase.from("temple_festivals").select("*").order("sort_order"),
    // services too, and with no is_available filter: the edit form has to show a
    // disabled package so it can be switched back on. the read policy admits
    // those rows to an admin, so they arrive here.
    supabase.from("temple_services").select("*").order("sort_order"),
  ]);
  if (templesRes.error) throw new Error(`temples: ${templesRes.error.message}`);
  if (imagesRes.error) throw new Error(`temple_images: ${imagesRes.error.message}`);
  if (festivalsRes.error) throw new Error(`temple_festivals: ${festivalsRes.error.message}`);
  if (servicesRes.error) throw new Error(`temple_services: ${servicesRes.error.message}`);

  const images = (imagesRes.data ?? []).map(toTempleImage);
  const byTemple = new Map<string, TempleImage[]>();
  for (const image of images) {
    const group = byTemple.get(image.templeId);
    if (group) group.push(image);
    else byTemple.set(image.templeId, [image]);
  }

  // same grouping for festivals
  const festivals = (festivalsRes.data ?? []).map(toTempleFestival);
  const festivalsByTemple = new Map<string, TempleFestival[]>();
  for (const festival of festivals) {
    const group = festivalsByTemple.get(festival.templeId);
    if (group) group.push(festival);
    else festivalsByTemple.set(festival.templeId, [festival]);
  }

  // and for services. the rows are grouped by the temple_id column rather than
  // read off a mapped object, because toTempleServicesFromRows is the one reader
  // that drops the columns and keeps the package fields.
  const servicesByTemple = new Map<string, TempleService[]>();
  for (const row of (servicesRes.data ?? []) as unknown as Row[]) {
    const templeId = String(row.temple_id ?? "");
    const group = servicesByTemple.get(templeId);
    if (group) group.push(...toTempleServicesFromRows([row]));
    else servicesByTemple.set(templeId, toTempleServicesFromRows([row]));
  }

  const rows = (templesRes.data ?? []) as unknown as Row[];
  return rows
    .map((row) => {
      const templeId = String(row.temple_id ?? "");
      return toTemple(
        row,
        byTemple.get(templeId) ?? [],
        festivalsByTemple.get(templeId) ?? [],
        servicesByTemple.get(templeId) ?? []
      );
    })
    .reverse();
};

// one round trip for the dashboard, then the same rollups the old client-side
// useMemo computed. every rule below is the same one the matching admin screen
// and the public listing use, so a card can never disagree with the page it
// links to.
export async function fetchDashboardData() {
  const [profiles, communities, users, plans, subs, services] =
    await Promise.all([
      fetchAdminProfiles(),
      fetchAdminCommunities(),
      fetchAdminUsers(),
      fetchAdminPlans(),
      fetchAdminSubscriptions(),
      fetchAdminServices(),
    ]);

  const activeSubs = subs.filter((s) => s.status === "active");

  // a free-tier row is a real subscription row with amount 0, so it inflates an
  // "active subscriptions" count without contributing any revenue. paidSubs is
  // the paying count; revenue is still the sum over every active row, which is
  // the same figure the memberships screen shows.
  const paidSubs = activeSubs.filter((s) => s.plan !== "free");

  // both gates, as in fetchServices() and the services screen: an approved
  // vendor that has been switched off is not listed, and a vendor still waiting
  // for review is not listed either.
  const listedServices = services.filter((s) => s.isApproved && s.active);
  const pendingServices = services.filter((s) => !s.isApproved);

  // rejected has already been decided on, so those rows are not waiting for
  // anyone and must stay out of the verification queue and its count
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
