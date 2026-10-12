import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadProfile } from "@/features/profiles/queries";
import { ProfileDetailView } from "@/components/profile/profile-view";
import { getCurrentMember } from "@/lib/data/member-dal";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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
    const supabase = await getSupabaseServer();
    const plan = await resolveMemberPlan(supabase, member.userId);
    if (plan === "premium") {
      const admin = getSupabaseAdmin();
      if (admin) {
        const { data } = await admin
          .from("users")
          .select("phone_number, email")
          .eq("user_id", profile.userId)
          .maybeSingle<{ phone_number: string | null; email: string | null }>();
        if (data && (data.phone_number || data.email)) {
          contact = { phone: data.phone_number ?? "", email: data.email ?? "" };
        }
      }
    }
  }

  return <ProfileDetailView profile={profile} contact={contact} />;
}
