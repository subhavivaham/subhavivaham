import { NextResponse } from "next/server";
import { q1 } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth/session";
import type { AppUser } from "@/types";
import { hasExpired } from "@/features/membership/period";

export async function POST(request: Request) {
  const { email, password } = await request.json().catch(() => ({}));
  const candidate = String(email ?? "").trim().toLowerCase();

  if (!candidate || !password) {
    return NextResponse.json({ error: "Enter both email and password." }, { status: 400 });
  }

  const user = await q1<{
    user_id: string;
    name: string;
    email: string;
    phone_number: string | null;
    is_membership_user: number;
    membership_plan: string | null;
    password_hash: string | null;
    role: string;
    status: string;
  }>(
    "select user_id, name, email, phone_number, is_membership_user, membership_plan, " +
      "password_hash, role, status from users where email = ?",
    [candidate]
  );

  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }
  if (user.status !== "active") {
    return NextResponse.json({ error: "This account is disabled." }, { status: 403 });
  }

  // live tier: a subscription whose renews_on has passed must not keep showing
  // a paid plan in the nav
  const subs = await q1<{ plan: string | null; renews_on: string | null } | null>(
    "select plan, renews_on from subscriptions where user_id = ? and status = 'active' order by created_at desc limit 1",
    [user.user_id]
  );
  const liveSub = subs && !hasExpired(subs.renews_on) ? subs : null;
  const tier = subs ? liveSub?.plan : user.membership_plan;
  const isPaid = subs ? Boolean(liveSub) : Boolean(user.is_membership_user);
  const plan: AppUser["plan"] = !isPaid
    ? "free"
    : tier === "premium"
      ? "premium"
      : tier === "silver"
        ? "silver"
        : "free";

  const profile = await q1<{ profile_id: string; gender: string | null }>(
    "select profile_id, gender from profiles where user_id = ?",
    [user.user_id]
  );

  await createSession(user.user_id);

  const body: AppUser = {
    id: user.user_id,
    email: user.email,
    mobile: user.phone_number ?? "",
    name: user.name || "Member",
    profileId: profile?.profile_id ?? "",
    gender: profile?.gender === "male" || profile?.gender === "female" ? profile.gender : null,
    plan,
  };
  return NextResponse.json({ user: body });
}
