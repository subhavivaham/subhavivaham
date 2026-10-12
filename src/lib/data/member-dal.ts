// the member-area equivalent of admin-dal.ts, and deliberately the same shape:
// the gate lives in one place, every private read goes through it, and a layout
// is never treated as the only check.
//
// this module reaches next/headers through getSupabaseServer, so a static import
// from a client component fails the build the same way an explicit server-only
// marker would, without taking on the extra dependency.
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/mode";

export type MemberIdentity = {
  authUserId: string;
  userId: string;
  email: string;
  name: string;
  // the public key used in urls and on Profile.id
  profileId: string;
  // the profiles.uuid. interests.from_profile_id and to_profile_id point at
  // this, not at profileId, so anything that writes or reads an interest row
  // needs both and cannot derive one from the other
  profileUuid: string;
  gender: "male" | "female" | null;
};

interface AccountRow {
  user_id: string;
  name: string;
  email: string | null;
}

interface ProfileKeyRow {
  id: string;
  profile_id: string;
  gender: string | null;
}

// the session cookie is the only thing that counts: a client-side flag or a
// stored value is not a boundary. when no credentials are configured there is no
// session, so this reports "nobody".
export const getCurrentMember = cache(async (): Promise<MemberIdentity | null> => {
  if (!isSupabaseConfigured) return null;

  let supabase;
  try {
    supabase = await getSupabaseServer();
  } catch {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // the same chain the client provider walks: auth.uid -> users.user_id ->
  // profiles.profile_id. rls scopes both reads to the signed-in member, so no
  // extra ownership check is needed.
  const { data: accountData } = await supabase
    .from("users")
    .select("user_id, name, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const account = accountData as unknown as AccountRow | null;
  if (!account) return null;

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, profile_id, gender")
    .eq("user_id", account.user_id)
    .maybeSingle();

  const profile = profileData as unknown as ProfileKeyRow | null;

  return {
    authUserId: user.id,
    userId: account.user_id,
    email: account.email ?? user.email ?? "",
    name: account.name || user.user_metadata?.full_name || "Member",
    profileId: profile?.profile_id ?? "",
    profileUuid: profile?.id ?? "",
    gender: profile?.gender === "male" || profile?.gender === "female" ? profile.gender : null,
  };
});

export const requireMember = cache(async (): Promise<MemberIdentity> => {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  return member;
});

// for server actions, which cannot redirect silently
export async function assertMember(): Promise<MemberIdentity> {
  const member = await getCurrentMember();
  if (!member) throw new Error("Not authorised.");
  return member;
}
