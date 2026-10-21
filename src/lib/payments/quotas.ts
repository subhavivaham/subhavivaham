// Per-plan entitlement quotas: photo uploads and interests sent per month.
//
// The live numbers live in membership_plans.photo_limit / interest_limit so an
// admin edit takes effect at the point of use without a deploy. The maps below
// are the built-in defaults, used only when the plan row cannot be read.
// A null interest limit means unlimited.
import { hasExpired } from "@/features/membership/period";
import { q, q1 } from "@/lib/db";
import { INTEREST_QUOTA, PHOTO_QUOTA, type MemberPlan } from "@/lib/payments/quota-defaults";

// re-exported so existing callers keep one import site; the definitions live in
// quota-defaults.ts, which is safe to pull into the client bundle
export { INTEREST_QUOTA, PHOTO_QUOTA, type MemberPlan };

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
export async function resolvePlanLimits(planId: string): Promise<PlanLimits> {
  const tier = asMemberPlan(planId);
  const fallback: PlanLimits = { photos: PHOTO_QUOTA[tier], interests: INTEREST_QUOTA[tier] };

  const data = await q1<{ photo_limit: number | null; interest_limit: number | null }>(
    "select photo_limit, interest_limit from membership_plans where id = ?",
    [tier]
  );
  if (!data) return fallback;

  return {
    photos: data.photo_limit ?? fallback.photos,
    interests: data.interest_limit == null ? fallback.interests : data.interest_limit,
  };
}

/**
 * The member's effective plan from their live subscriptions. A row whose
 * renews_on has passed is not live even if its status has not been flipped yet.
 * The denormalised flags are the fallback only for a member with no
 * subscription rows at all (a legacy account).
 */
export async function resolveMemberPlan(userId: string): Promise<MemberPlan> {
  const subs = await q<{ plan: string; renews_on: string | null; status: string }>(
    "select plan, renews_on, status from subscriptions where user_id = ? order by created_at desc",
    [userId]
  );

  if (subs.length > 0) {
    const live = subs.find((row) => row.status === "active" && !hasExpired(row.renews_on));
    if (live?.plan === "premium") return "premium";
    if (live?.plan === "silver") return "silver";
    return "free";
  }

  const data = await q1<{ is_membership_user: number | null; membership_plan: string | null }>(
    "select is_membership_user, membership_plan from users where user_id = ?",
    [userId]
  );
  if (!data?.is_membership_user) return "free";
  if (data.membership_plan === "premium") return "premium";
  if (data.membership_plan === "silver") return "silver";
  return "free";
}

/** The current member's limits, resolved from their live plan row. */
export async function resolveMemberLimits(userId: string): Promise<PlanLimits> {
  const plan = await resolveMemberPlan(userId);
  return resolvePlanLimits(plan);
}

/** Start of the current calendar month (UTC), the quota window boundary. */
export function monthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Interest rows the profile sent since `since`, used against the monthly quota. */
export async function interestsSentSince(
  fromProfileUuid: string,
  since: Date
): Promise<number | null> {
  try {
    const rows = await q<{ n: number }>(
      "select count(*) as n from interests where from_profile_id = ? and created_at >= ?",
      [fromProfileUuid, since.toISOString().slice(0, 19).replace("T", " ")]
    );
    return rows[0]?.n ?? 0;
  } catch {
    return null;
  }
}
