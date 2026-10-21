import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { q1 } from "@/lib/db";

export const ADMIN_CLAIM = "admin";

export type AdminIdentity = {
  authUserId: string;
  email: string;
  name: string;
};

// admin is recognised by the role column on public.users, validated from the
// session cookie against the database rather than trusted from the client
export const getCurrentAdmin = cache(async (): Promise<AdminIdentity | null> => {
  const session = await getSessionUser();
  if (!session || session.role !== ADMIN_CLAIM) return null;

  // best effort: the display name lives on public.users, but a missing or
  // renamed row must never turn a valid session into a sign-in failure
  let name = session.email;
  const row = await q1<{ name: string }>("select name from users where email = ?", [session.email]);
  if (row?.name) name = row.name;

  return { authUserId: session.authUserId, email: session.email, name };
});

// every server component that touches admin data and every server action that
// mutates it calls this first, so authorisation cannot be forgotten at a call
// site. cache() keeps it to one auth round trip per render pass.
export const requireAdmin = cache(async (): Promise<AdminIdentity> => {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
});

// server actions cannot redirect silently, so they get a throwing variant
export async function assertAdmin(): Promise<AdminIdentity> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Not authorised.");
  return admin;
}
