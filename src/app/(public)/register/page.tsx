import type { Metadata } from "next";
import { RegisterForm } from "@/components/forms/register-form";
import { fetchCommunities } from "@/lib/data/queries";
import { resolvePlanLimits } from "@/lib/payments/quotas";
import { getSupabaseServer } from "@/lib/supabase/server";

// the community list in the form is database data. prerendered at build time it
// would ship whatever the build machine could see, which on a misconfigured prod
// build is an empty select with no options
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create Profile — Subha Vivaham Matrimony",
  description:
    "Create your free matrimonial profile in minutes and start finding compatible matches.",
};

export default async function RegisterPage() {

  const communities = await fetchCommunities();

  // the registration photo cap is the free plan's limit, read live so an admin
  // edit to the free plan applies to new sign-ups without a deploy
  const supabase = await getSupabaseServer();
  const { photos: freePhotoLimit } = await resolvePlanLimits(supabase, "free");

  return (
    <RegisterForm
      communities={communities.map((c) => c.name)}
      freePhotoLimit={freePhotoLimit}
    />
  );
}
