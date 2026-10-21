import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadProfile } from "@/features/profiles/loaders";
import { ProfileDetailView } from "@/components/profile/profile-view";
import { getCurrentMember } from "@/lib/data/member-dal";
import { q1 } from "@/lib/db";
import { resolveMemberPlan } from "@/lib/payments/quotas";

// the profile comes from the database, so this route is rendered per request
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = await loadProfile(id);
  if (!profile) return { title: "Profile not found — Subha Vivaham" };
  return {
    title: `${profile.firstName}, ${profile.age} — ${profile.profession} in ${profile.city} | Subha Vivaham`,
    description: profile.about.slice(0, 155),
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await loadProfile(id);
  if (!profile) notFound();

  // contact details are a premium entitlement: the numbers are resolved here,
  // on the server, only for a premium viewer. everyone else gets no contact
  // object at all, so there is nothing in the rendered page to lift.
  let contact: { phone: string; email: string } | null = null;
  const member = await getCurrentMember();
  if (member) {
    const plan = await resolveMemberPlan(member.userId);
    if (plan === "premium") {
      const user = await q1<{ phone_number: string | null; email: string | null }>(
        "select phone_number, email from users where user_id = ?",
        [profile.userId]
      );
      if (user && (user.phone_number || user.email)) {
        contact = { phone: user.phone_number ?? "", email: user.email ?? "" };
      }
    }
  }

  return <ProfileDetailView profile={profile} contact={contact} />;
}
