"use server";

import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { ADMIN_CLAIM } from "@/lib/data/admin-dal";

export type LoginState = { error: string } | null;

export async function adminSignIn(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter both email and password." };
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "Invalid email or password." };
  }

  // a valid account without the admin claim still gets a session, so drop it
  // before it can reach any protected read
  if (data.user.app_metadata?.role !== ADMIN_CLAIM) {
    await supabase.auth.signOut();
    return { error: "This account does not have admin access." };
  }

  // signOut above already wrote cookies, so redirect must come last
  redirect("/admin");
}

export async function adminSignOut(): Promise<void> {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
