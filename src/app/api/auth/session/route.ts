import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { q1 } from "@/lib/db";
import { hasExpired } from "@/features/membership/period";
import type { AppUser } from "@/types";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ user: null });

  // the same live-tier rule as /api/auth/login
  const liveSub = await q1<{ plan: string | null; renews_on: string | null }>(
    "select plan, renews_on from subscriptions where user_id = ? and status = 'active' order by created_at desc limit 1",
    [session.userId]
  );
  const tier = liveSub ? liveSub.plan : session.membershipPlan;
  const isPaid = liveSub ? !hasExpired(liveSub.renews_on) : session.isMembershipUser;
  const plan: AppUser["plan"] = !isPaid
    ? "free"
    : tier === "premium"
      ? "premium"
      : tier === "silver"
        ? "silver"
        : "free";

  const profile = await q1<{ profile_id: string; gender: string | null }>(
    "select profile_id, gender from profiles where user_id = ?",
    [session.userId]
  );

  const user: AppUser = {
    id: session.userId,
    email: session.email,
    mobile: session.phone,
    name: session.name || "Member",
    profileId: profile?.profile_id ?? "",
    gender: profile?.gender === "male" || profile?.gender === "female" ? profile.gender : null,
    plan,
  };
  return NextResponse.json({ user });
}
