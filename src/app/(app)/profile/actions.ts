"use server";

// every write to an interest. the member identity comes from the dal rather
// than from an argument, because the whole security argument here rests on
// from_profile_id and to_profile_id being the profiles.uuid of the session's own
// profile and the one being acted on - a client that could name either would be
// able to send interests as somebody else or answer one addressed to them.
import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { assertMember } from "@/lib/data/member-dal";
import { interestsSentSince, monthStart, resolveMemberPlan, resolvePlanLimits } from "@/lib/payments/quotas";
import type { InterestStatus } from "@/types";

export type SendInterestResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export type InterestQuota = {
  limit: number | null;
  used: number;
  remaining: number | null;
};

const FAILURE = "Your session has expired. Please sign in again.";

// the recipient's answer, and the sender's recall, both land here. anything the
// recipient is not allowed to set is refused rather than filtered, so a forged
// call fails loudly instead of quietly doing nothing.
const RESPONSIBLE_STATUSES: InterestStatus[] = ["accepted", "declined"];

function newInterestKey(): string {
  // interest_id is the human-facing key the sibling tables carry; the uuid
  // primary key is generated at the insert, which needs it back first
  return `i${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Send interest to another profile by saving their profile ID to interested_profile column
 */
export async function sendInterest(toProfileId: string): Promise<SendInterestResult> {
  let member;
  try {
    member = await assertMember();
  } catch {
    return { ok: false, error: FAILURE };
  }

  if (!member.profileUuid) return { ok: false, error: "Complete your profile to send an interest." };

  const supabase = await getSupabaseServer();

  try {
    // resolve the target's uuid. the array stores the public profile_id, which
    // the profiles table is keyed on too, so this is the same lookup either way
    const { data: target, error: targetError } = await supabase
      .from("profiles")
      .select("id, profile_id")
      .eq("profile_id", toProfileId)
      .maybeSingle();
    if (targetError) throw new Error(targetError.message);
    if (!target) return { ok: false, error: "That profile no longer exists." };

    // sending to yourself would satisfy the unique index and produce a pair
    // that can never be answered
    if (target.id === member.profileUuid) {
      return { ok: false, error: "You cannot send an interest to your own profile." };
    }

    // Get current user's profile ID
    const { data: currentProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, interested_profile")
      .eq("user_id", member.userId)
      .maybeSingle();

    if (profileError || !currentProfile) {
      return { ok: false, error: "Could not load your profile." };
    }

    const currentInterestedProfiles = (currentProfile.interested_profile || []) as string[];

    // Check if already interested in this profile
    if (currentInterestedProfiles.includes(toProfileId)) {
      return { ok: false, error: "You have already sent an interest to this profile." };
    }

    // Monthly quota from the sender's plan. Premium (null) skips the count
    // entirely; every other tier is refused once this month's sends reach it.
    // A failed count fails open: blocking a paid-up member over a transient
    // read error is worse than one uncounted send.
    const plan = await resolveMemberPlan(supabase, member.userId);
    const { interests: quota } = await resolvePlanLimits(supabase, plan);
    if (quota !== null) {
      const sent = await interestsSentSince(supabase, member.profileUuid, monthStart());
      if (sent !== null && sent >= quota) {
        return {
          ok: false,
          error: `You have used all ${quota} interests for this month on your ${plan} plan. Upgrade for more.`,
        };
      }
    }

    // Add the profile ID to the interested_profile array
    const updatedInterestedProfiles = [...currentInterestedProfiles, toProfileId];

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        interested_profile: updatedInterestedProfiles,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", member.userId);

    if (updateError) {
      return { ok: false, error: `Could not send interest: ${updateError.message}` };
    }

    // the array is the sender's own record and carries no status, so the row in
    // public.interests is what the recipient can see and what the sender's
    // history is read back from. it is written second on purpose: if it fails
    // the send still shows in the sender's list, whereas writing it first would
    // leave a pending row the sender has no record of.
    const { error: interestError } = await supabase.from("interests").insert({
      id: crypto.randomUUID(),
      interest_id: newInterestKey(),
      from_profile_id: member.profileUuid,
      to_profile_id: target.id,
      status: "pending",
      message: null,
      viewed: false,
      created_at: new Date().toISOString(),
    });
    if (interestError) {
      // 23505 is the partial unique index: the array check above passed but
      // another send landed first. not a failure the member can act on
      if (interestError.code === "23505") {
        return { ok: false, error: "You have already sent an interest to this profile." };
      }
      return { ok: false, error: `Could not record the interest: ${interestError.message}` };
    }

    // Revalidate relevant paths
    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath("/brides");
    revalidatePath("/grooms");
    revalidatePath("/matches");
    revalidatePath("/interests");

    return { ok: true, message: "Interest sent successfully!" };
  } catch (error) {
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    };
  }
}

/**
 * The member's interest quota for display. The write action re-resolves and
 * re-counts it on every send, so this is display-only — a stale answer here can
 * never grant an extra send, and premium (null) means unlimited.
 */
export async function getInterestQuota(): Promise<InterestQuota> {
  let member;
  try {
    member = await assertMember();
  } catch {
    return { limit: null, used: 0, remaining: null };
  }

  const supabase = await getSupabaseServer();
  const plan = await resolveMemberPlan(supabase, member.userId);
  const { interests: limit } = await resolvePlanLimits(supabase, plan);
  if (limit === null) return { limit: null, used: 0, remaining: null };

  const used = (await interestsSentSince(supabase, member.profileUuid, monthStart())) ?? 0;
  return { limit, used, remaining: Math.max(0, limit - used) };
}

/**
 * Withdraw interest from a profile
 */
export async function withdrawInterest(toProfileId: string): Promise<SendInterestResult> {
  let member;
  try {
    member = await assertMember();
  } catch {
    return { ok: false, error: FAILURE };
  }

  const supabase = await getSupabaseServer();

  try {
    // Get current user's profile ID
    const { data: currentProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, interested_profile")
      .eq("user_id", member.userId)
      .maybeSingle();

    if (profileError || !currentProfile) {
      return { ok: false, error: "Could not load your profile." };
    }

    const currentInterestedProfiles = (currentProfile.interested_profile || []) as string[];

    // Remove the profile ID from the interested_profile array
    const updatedInterestedProfiles = currentInterestedProfiles.filter(
      (id) => id !== toProfileId
    );

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        interested_profile: updatedInterestedProfiles,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", member.userId);

    if (updateError) {
      return { ok: false, error: `Could not withdraw interest: ${updateError.message}` };
    }

    // the row is marked withdrawn rather than deleted. it is the only record
    // that the interest was ever sent, and the recipient's side of the history
    // should show that it was recalled rather than silently vanish.
    //
    // filtered on both ends of the pair: the neq keeps the filter off the rows
    // that are already recalled, so a re-send followed by a withdraw only
    // touches the newer pending row and never rewrites the earlier history.
    const targetUuid = await resolveUuid(supabase, toProfileId);
    if (!targetUuid) return { ok: false, error: "That profile no longer exists." };

    const { error: withdrawError } = await supabase
      .from("interests")
      .update({ status: "withdrawn" })
      .eq("from_profile_id", member.profileUuid)
      .eq("to_profile_id", targetUuid)
      .neq("status", "withdrawn");
    if (withdrawError) {
      return { ok: false, error: `Could not withdraw interest: ${withdrawError.message}` };
    }

    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath("/brides");
    revalidatePath("/grooms");
    revalidatePath("/matches");
    revalidatePath("/interests");

    return { ok: true, message: "Interest withdrawn successfully!" };
  } catch (error) {
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    };
  }
}

// the recipient answers an interest addressed to them
export async function respondToInterest(
  interestId: string,
  status: InterestStatus
): Promise<SendInterestResult> {
  if (!RESPONSIBLE_STATUSES.includes(status)) {
    return { ok: false, error: "That is not an answer you can give." };
  }

  let member;
  try {
    member = await assertMember();
  } catch {
    return { ok: false, error: FAILURE };
  }

  const supabase = await getSupabaseServer();

  // the to_profile_id filter is the ownership check: interests_update would
  // happily let the sender answer their own interest, and the recipient is the
  // only one whose answer means anything
  const { data, error } = await supabase
    .from("interests")
    .update({ status, viewed: true })
    .eq("id", interestId)
    .eq("to_profile_id", member.profileUuid)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "That interest is no longer waiting for you." };

  revalidatePath("/interests");
  return {
    ok: true,
    message: status === "accepted" ? "Interest accepted." : "Interest declined.",
  };
}

// opened, not answered. one call for the whole list rather than one per row.
//
// deliberately does not revalidatePath: the flag only feeds the unread badge the
// recipient is already looking at, and revalidating from an effect on the page
// that renders it would bounce the router back on itself. the caller marks the
// rows it sent as read locally instead.
export async function markReceivedViewed(): Promise<SendInterestResult> {
  let member;
  try {
    member = await assertMember();
  } catch {
    return { ok: false, error: FAILURE };
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from("interests")
    .update({ viewed: true })
    .eq("to_profile_id", member.profileUuid)
    .eq("viewed", false)
    .neq("status", "withdrawn");

  if (error) return { ok: false, error: error.message };

  return { ok: true, message: "" };
}

async function resolveUuid(
  supabase: Awaited<ReturnType<typeof getSupabaseServer>>,
  profileKey: string
): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("profile_id", profileKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { id?: string } | null)?.id ?? "";
}
