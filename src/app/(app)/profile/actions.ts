"use server";

// every write to an interest. the member identity comes from the dal rather
// than from an argument, because the whole security argument here rests on
// from_profile_id and to_profile_id being the profiles.uuid of the session's own
// profile and the one being acted on. mysql has no row level security, so the
// explicit filters below are the entire boundary.
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { q1, run } from "@/lib/db";
import { assertMember } from "@/lib/data/member-dal";
import { jsonList } from "@/lib/data/mappers";
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
// recipient is not allowed to set is refused rather than filtered.
const RESPONSIBLE_STATUSES: InterestStatus[] = ["accepted", "declined"];

function newInterestKey(): string {
  return `i${randomUUID().slice(0, 8)}`;
}

async function resolveUuid(profileKey: string): Promise<string> {
  const row = await q1<{ id: string }>("select id from profiles where profile_id = ?", [profileKey]);
  return row?.id ?? "";
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

  try {
    // resolve the target's uuid. the array stores the public profile_id, which
    // the profiles table is keyed on too, so this is the same lookup either way
    const target = await q1<{ id: string }>(
      "select id from profiles where profile_id = ?",
      [toProfileId]
    );
    if (!target) return { ok: false, error: "That profile no longer exists." };

    // sending to yourself would satisfy the unique index and produce a pair
    // that can never be answered
    if (target.id === member.profileUuid) {
      return { ok: false, error: "You cannot send an interest to your own profile." };
    }

    const currentProfile = await q1<{ interested_profile: string[] | null }>(
      "select interested_profile from profiles where user_id = ?",
      [member.userId]
    );
    if (!currentProfile) return { ok: false, error: "Could not load your profile." };

    const currentInterestedProfiles = jsonList(currentProfile.interested_profile);

    // already interested in this profile?
    if (currentInterestedProfiles.includes(toProfileId)) {
      return { ok: false, error: "You have already sent an interest to this profile." };
    }

    // Monthly quota from the sender's plan. Premium (null) skips the count
    // entirely; a failed count fails open: blocking a paid-up member over a
    // transient read error is worse than one uncounted send.
    const plan = await resolveMemberPlan(member.userId);
    const { interests: quota } = await resolvePlanLimits(plan);
    if (quota !== null) {
      const sent = await interestsSentSince(member.profileUuid, monthStart());
      if (sent !== null && sent >= quota) {
        return {
          ok: false,
          error: `You have used all ${quota} interests for this month on your ${plan} plan. Upgrade for more.`,
        };
      }
    }

    // the array is the sender's own record and carries no status, so the row in
    // public.interests is what the recipient can see and what the sender's
    // history is read back from. it is written second on purpose: if it fails
    // the send still shows in the sender's list.
    await run(
      "update profiles set interested_profile = ?, updated_at = now() where user_id = ?",
      [JSON.stringify([...currentInterestedProfiles, toProfileId]), member.userId]
    );

    try {
      await run(
        "insert into interests (id, interest_id, from_profile_id, to_profile_id, status, message, viewed) " +
          "values (?, ?, ?, ?, 'pending', null, 0)",
        [randomUUID(), newInterestKey(), member.profileUuid, target.id]
      );
    } catch (error) {
      // the partial unique index: another send landed first. not a failure the
      // member can act on
      if (/idx_interests|duplicate/i.test(error instanceof Error ? error.message : "")) {
        return { ok: false, error: "You have already sent an interest to this profile." };
      }
      return { ok: false, error: `Could not record the interest: ${error instanceof Error ? error.message : "unknown error"}` };
    }

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
      error: error instanceof Error ? error.message : "An unexpected error occurred",
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

  const plan = await resolveMemberPlan(member.userId);
  const { interests: limit } = await resolvePlanLimits(plan);
  if (limit === null) return { limit: null, used: 0, remaining: null };

  const used = (await interestsSentSince(member.profileUuid, monthStart())) ?? 0;
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

  try {
    const currentProfile = await q1<{ interested_profile: string[] | null }>(
      "select interested_profile from profiles where user_id = ?",
      [member.userId]
    );
    if (!currentProfile) return { ok: false, error: "Could not load your profile." };

    const currentInterestedProfiles = jsonList(currentProfile.interested_profile);

    await run(
      "update profiles set interested_profile = ?, updated_at = now() where user_id = ?",
      [
        JSON.stringify(currentInterestedProfiles.filter((id) => id !== toProfileId)),
        member.userId,
      ]
    );

    // the row is marked withdrawn rather than deleted. it is the only record
    // that the interest was ever sent, and the recipient's side of the history
    // should show that it was recalled rather than silently vanish.
    //
    // filtered on both ends of the pair: the status != keeps the filter off the
    // rows that are already recalled, so a re-send followed by a withdraw only
    // touches the newer pending row and never rewrites the earlier history.
    const targetUuid = await resolveUuid(toProfileId);
    if (!targetUuid) return { ok: false, error: "That profile no longer exists." };

    await run(
      "update interests set status = 'withdrawn' " +
        "where from_profile_id = ? and to_profile_id = ? and status <> 'withdrawn'",
      [member.profileUuid, targetUuid]
    );

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
      error: error instanceof Error ? error.message : "An unexpected error occurred",
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

  // the to_profile_id filter is the ownership check: without it a member could
  // answer an interest that was never addressed to them
  const result = await run(
    "update interests set status = ?, viewed = 1 where id = ? and to_profile_id = ?",
    [status, interestId, member.profileUuid]
  );
  if (!(result as { affectedRows?: number }).affectedRows) {
    return { ok: false, error: "That interest is no longer waiting for you." };
  }

  revalidatePath("/interests");
  return {
    ok: true,
    message: status === "accepted" ? "Interest accepted." : "Interest declined.",
  };
}

// opened, not answered. one call for the whole list rather than one per row.
//
// deliberately does not revalidatePath: the flag only feeds the unread badge the
// recipient is already looking at. the caller marks the rows it sent as read
// locally instead.
export async function markReceivedViewed(): Promise<SendInterestResult> {
  let member;
  try {
    member = await assertMember();
  } catch {
    return { ok: false, error: FAILURE };
  }

  await run(
    "update interests set viewed = 1 where to_profile_id = ? and viewed = 0 and status <> 'withdrawn'",
    [member.profileUuid]
  );

  return { ok: true, message: "" };
}
