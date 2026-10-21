import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { q1, run } from "@/lib/db";

export const SESSION_COOKIE = "sv_session";

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, saltB64, hashB64] = stored.split(":");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  try {
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const actual = scryptSync(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await run(
    "insert into sessions (token_hash, user_id, expires_at) values (?, ?, date_add(now(), interval 30 day))",
    [sha256(token), userId]
  );
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await run("delete from sessions where token_hash = ?", [sha256(token)]);
  }
  cookieStore.delete(SESSION_COOKIE);
}

export interface SessionUser {
  userId: string;
  authUserId: string;
  email: string;
  name: string;
  role: string;
  status: string;
  phone: string;
  isMembershipUser: boolean;
  membershipPlan: string | null;
}

interface SessionRow {
  user_id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  phone_number: string | null;
  is_membership_user: number;
  membership_plan: string | null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await q1<SessionRow>(
    `select u.user_id, u.email, u.name, u.role, u.status, u.phone_number,
            u.is_membership_user, u.membership_plan
       from sessions s
       join users u on u.user_id = s.user_id
      where s.token_hash = ? and s.expires_at > now()`,
    [sha256(token)]
  );
  if (!row) return null;
  return {
    userId: row.user_id,
    authUserId: row.user_id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    phone: row.phone_number ?? "",
    isMembershipUser: Boolean(row.is_membership_user),
    membershipPlan: row.membership_plan,
  };
}
