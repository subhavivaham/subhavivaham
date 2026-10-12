// this module reaches next/headers through getSupabaseServer, so a static import
// from a client component fails the build the same way an explicit server-only
// marker would, without taking on the extra dependency
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";

export const ADMIN_CLAIM = "admin";

export type AdminIdentity = {
  authUserId: string;
  email: string;
  name: string;
};

// admin is recognised by a claim baked into the access token, never by a
// hardcoded email, so the check survives a password change and is validated on
// the server rather than trusted from the client
function isAdmin(user: User | null): boolean {
  return user?.app_metadata?.role === ADMIN_CLAIM;
}

export const getCurrentAdmin = cache(async (): Promise<AdminIdentity | null> => {
  let supabase;
  try {
    supabase = await getSupabaseServer();
  } catch {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdmin(user)) return null;

  // best effort: the display name lives on public.users, but a missing or
  // renamed row must never turn a valid session into a sign-in failure
  let name = user!.email ?? "";
  const { data: row } = await supabase
    .from("users")
    .select("name")
    .eq("email", user!.email ?? "")
    .maybeSingle();
  if (row?.name) name = row.name;

  return { authUserId: user!.id, email: user!.email ?? "", name };
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
