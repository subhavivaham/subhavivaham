"use server";

import { redirect } from "next/navigation";
import { q1 } from "@/lib/db";
import { createSession, destroySession, verifyPassword } from "@/lib/auth/session";
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

  const user = await q1<{ user_id: string; role: string; password_hash: string | null; status: string }>(
    "select user_id, role, password_hash, status from users where email = ?",
    [email]
  );

  if (!user || !verifyPassword(password, user.password_hash)) {
    return { error: "Invalid email or password." };
  }

  // a valid account without the admin role still must not get a session here
  if (user.role !== ADMIN_CLAIM) {
    return { error: "This account does not have admin access." };
  }

  if (user.status !== "active") {
    return { error: "This account is disabled." };
  }

  await createSession(user.user_id);
  redirect("/admin");
}

export async function adminSignOut(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}
