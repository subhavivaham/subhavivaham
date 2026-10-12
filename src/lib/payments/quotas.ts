// Per-plan entitlement quotas: photo uploads and interests sent per month.
//
// The live numbers live in membership_plans.photo_limit / interest_limit so an
// admin edit takes effect at the point of use without a deploy. The maps below
// are the built-in defaults, used only when the plan row cannot be read (or in
// code paths that have no database client, such as registration).
// Quotas are enforced server-side at the action that performs the write (photo
// upload, sendInterest). UI displays read the same numbers so the two can never
// disagree about what a plan allows. A null interest limit means unlimited -
// there is no number that means "no limit".
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasExpired } from "@/features/membership/period";

export type MemberPlan = "free" | "silver" | "premium";

export const PHOTO_QUOTA: Record<MemberPlan, number> = {
  free: 1,
  silver: 5,
  premium: 10,
};

/** Monthly interest sends per plan; null means unlimited. */
export const INTEREST_QUOTA: Record<MemberPlan, number | null> = {
  free: 3,
  silver: 25,
  premium: null,
};

export interface PlanLimits {
  photos: number;
  interests: number | null;
}

function asMemberPlan(planId: string): MemberPlan {
  return planId === "silver" || planId === "premium" ? planId : "free";
}

/**
 * The photo/interest limits stored on a plan row. A missing row or unreadable
 * column falls back to the built-in defaults; a present-but-null interest_limit
 * means unlimited.
 */
export async function resolvePlanLimits(
  client: SupabaseClient,
  planId: string
): Promise<PlanLimits> {
  const tier = asMemberPlan(planId);
  const fallback: PlanLimits = { photos: PHOTO_QUOTA[tier], interests: INTEREST_QUOTA[tier] };

  const { data } = await client
    .from("membership_plans")
    .select("photo_limit, interest_limit")
    .eq("id", tier)
    .maybeSingle<{ photo_limit: number | null; interest_limit?: number | null }>();
  if (!data) return fallback;

  return {
    photos: data.photo_limit ?? fallback.photos,
    interests: data.interest_limit === undefined ? fallback.interests : data.interest_limit,
  };
}

/**
 * The member's effective plan from their live subscriptions. A row whose
 * renews_on has passed is not live even if its status has not been flipped yet,
 * so a plan that lapsed since the last sync cannot keep granting quota on this
 * request. The denormalised flags are the fallback only for a member with no
 * subscription rows at all (a legacy account), which keeps the flags meaningful
 * without letting a stale paid string win.
 */
export async function resolveMemberPlan(
  client: SupabaseClient,
  userId: string
): Promise<MemberPlan> {
  const { data: subs, error } = await client
    .from("subscriptions")
    .select("plan, renews_on, status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!error && subs && subs.length > 0) {
    const live = subs.find(
      (row) => row.status === "active" && !hasExpired(row.renews_on as string | null)
    );
    if (live?.plan === "premium") return "premium";
    if (live?.plan === "silver") return "silver";
    return "free";
  }

  const { data } = await client
    .from("users")
    .select("is_membership_user, membership_plan")
    .eq("user_id", userId)
    .maybeSingle<{ is_membership_user: boolean | null; membership_plan: string | null }>();
  if (!data?.is_membership_user) return "free";
  if (data.membership_plan === "premium") return "premium";
  if (data.membership_plan === "silver") return "silver";
  return "free";
}

/** The current member's limits, resolved from their live plan row. */
export async function resolveMemberLimits(
  client: SupabaseClient,
  userId: string
): Promise<PlanLimits> {
  const plan = await resolveMemberPlan(client, userId);
  return resolvePlanLimits(client, plan);
}

/** Start of the current calendar month (UTC), the quota window boundary. */
export function monthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Interest rows the profile sent since `since`, used against the monthly quota. */
export async function interestsSentSince(
  client: SupabaseClient,
  fromProfileUuid: string,
  since: Date
): Promise<number | null> {
  const { count, error } = await client
    .from("interests")
    .select("id", { count: "exact", head: true })
    .eq("from_profile_id", fromProfileUuid)
    .gte("created_at", since.toISOString());
  if (error) return null;
  return count ?? 0;
}
