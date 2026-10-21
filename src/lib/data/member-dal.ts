// the member-area equivalent of admin-dal.ts: the gate lives in one place,
// every private read goes through it.
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { q1 } from "@/lib/db";

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

interface ProfileKeyRow {
  id: string;
  profile_id: string;
  gender: string | null;
}

export const getCurrentMember = cache(async (): Promise<MemberIdentity | null> => {
  const session = await getSessionUser();
  if (!session) return null;

  const profile = await q1<ProfileKeyRow>(
    "select id, profile_id, gender from profiles where user_id = ?",
    [session.userId]
  );

  return {
    authUserId: session.authUserId,
    userId: session.userId,
    email: session.email,
    name: session.name || "Member",
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
