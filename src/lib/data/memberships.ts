// The single definition of what "active" means for a membership.
//
// A subscription is live through the end of its renews_on day, and no scheduled
// job runs to retire the ones that pass. So the lapse is applied whenever
// memberships are read or written: overdue rows are flipped to expired and the
// member's denormalised users flags are re-derived from what is still live. The
// admin actions and the admin queries both go through these helpers, so a
// subscription's status, the entitlement flag and the quota a member actually
// gets can never disagree.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MembershipTier } from "@/types";
import { hasExpired, todayDate } from "@/features/membership/period";

// Flips every overdue active subscription to expired and returns the distinct
// user_ids whose active set changed. Pass a userId to scope it to one member.
export async function expireLapsedSubscriptions(
  client: SupabaseClient,
  userId?: string
): Promise<string[]> {
  const scoped = client
    .from("subscriptions")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("status", "active")
    .not("renews_on", "is", null)
    .lt("renews_on", todayDate());
  const query = userId ? scoped.eq("user_id", userId) : scoped;

  const { data, error } = await query.select("user_id");
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((row) => String(row.user_id)))];
}

// The member's tier from the subscriptions still live today. A row whose
// renews_on has passed does not count even if its status has not been flipped
// yet, and an empty or unreadable set is free.
export async function deriveMemberTier(
  client: SupabaseClient,
  userId: string
): Promise<MembershipTier> {
  const { data, error } = await client
    .from("subscriptions")
    .select("plan, renews_on")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const live = (data ?? []).find((row) => !hasExpired(row.renews_on as string | null));
  const plan = live?.plan;
  return plan === "premium" || plan === "silver" ? plan : "free";
}

// Writes the denormalised flags every quota read goes through. Kept separate so
// a caller that already knows the tier (reconciliation walks many members) does
// not have to re-derive it.
export async function setMemberEntitlement(
  client: SupabaseClient,
  userId: string,
  tier: MembershipTier
): Promise<void> {
  const { error } = await client
    .from("users")
    .update({
      is_membership_user: tier !== "free",
      membership_plan: tier === "free" ? null : tier,
    })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

// Re-derives one member's flags from their live subscriptions, retiring any
// overdue rows first so the entitlement cannot outlive the subscription.
export async function syncMemberEntitlement(
  client: SupabaseClient,
  userId: string
): Promise<void> {
  await expireLapsedSubscriptions(client, userId);
  await setMemberEntitlement(client, userId, await deriveMemberTier(client, userId));
}

// The same pass across every member, for a read that has no single user in hand.
export async function reconcileSubscriptions(client: SupabaseClient): Promise<void> {
  const affected = await expireLapsedSubscriptions(client);
  for (const userId of affected) {
    await setMemberEntitlement(client, userId, await deriveMemberTier(client, userId));
  }
}
