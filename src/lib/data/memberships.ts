// The single definition of what "active" means for a membership.
//
// A subscription is live through the end of its renews_on day, and no scheduled
// job runs to retire the ones that pass. So the lapse is applied whenever
// memberships are read or written: overdue rows are flipped to expired and the
// member's denormalised users flags are re-derived from what is still live.
import type { MembershipTier } from "@/types";
import { hasExpired, todayDate } from "@/features/membership/period";
import { q, q1, run } from "@/lib/db";

// Flips every overdue active subscription to expired and returns the distinct
// user_ids whose active set changed. Pass a userId to scope it to one member.
export async function expireLapsedSubscriptions(userId?: string): Promise<string[]> {
  const params: unknown[] = [todayDate()];
  let sql =
    "update subscriptions set status = 'expired' where status = 'active' and renews_on is not null and renews_on < ?";
  if (userId) {
    sql += " and user_id = ?";
    params.push(userId);
  }
  await run(sql, params);

  const affected = await q<{ user_id: string }>(
    userId
      ? "select distinct user_id from subscriptions where user_id = ?"
      : "select distinct user_id from subscriptions",
    userId ? [userId] : []
  );
  return [...new Set(affected.map((row) => row.user_id))];
}

// The member's tier from the subscriptions still live today. A row whose
// renews_on has passed does not count even if its status has not been flipped
// yet, and an empty or unreadable set is free.
export async function deriveMemberTier(userId: string): Promise<MembershipTier> {
  const rows = await q<{ plan: string; renews_on: string | null }>(
    "select plan, renews_on from subscriptions where user_id = ? and status = 'active' order by created_at desc",
    [userId]
  );
  const live = rows.find((row) => !hasExpired(row.renews_on));
  const plan = live?.plan;
  return plan === "premium" || plan === "silver" ? plan : "free";
}

// Writes the denormalised flags every quota read goes through.
export async function setMemberEntitlement(userId: string, tier: MembershipTier): Promise<void> {
  await run(
    "update users set is_membership_user = ?, membership_plan = ? where user_id = ?",
    [tier !== "free", tier === "free" ? null : tier, userId]
  );
}

// Re-derives one member's flags from their live subscriptions, retiring any
// overdue rows first so the entitlement cannot outlive the subscription.
export async function syncMemberEntitlement(userId: string): Promise<void> {
  await expireLapsedSubscriptions(userId);
  await setMemberEntitlement(userId, await deriveMemberTier(userId));
}

// The same pass across every member, for a read that has no single user in hand.
export async function reconcileSubscriptions(): Promise<void> {
  const affected = await expireLapsedSubscriptions();
  for (const userId of affected) {
    await setMemberEntitlement(userId, await deriveMemberTier(userId));
  }
}

// kept for callers that only need the live rows without the update pass
export async function hasAnySubscription(userId: string): Promise<boolean> {
  const row = await q1("select 1 as x from subscriptions where user_id = ? limit 1", [userId]);
  return Boolean(row);
}
