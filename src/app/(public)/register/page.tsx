import type { Metadata } from "next";
import { RegisterForm } from "@/components/forms/register-form";
import { fetchCommunities } from "@/lib/data/queries";
import { resolvePlanLimits } from "@/lib/payments/quotas";
import { pageSeo } from "@/lib/seo";

// the community list in the form is database data. prerendered at build time it
// would ship whatever the build machine could see
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageSeo({
  title: "Create Profile — Subha Vivaham Matrimony",
  description:
    "Create your free matrimonial profile in minutes and start finding compatible matches.",
  path: "/register",
});

export default async function RegisterPage() {
  const communities = await fetchCommunities();

  // the registration photo cap is the free plan's limit, read live so an admin
  // edit to the free plan applies to new sign-ups without a deploy
  const { photos: freePhotoLimit } = await resolvePlanLimits("free");

  return (
    <RegisterForm
      communities={communities.map((c) => c.name)}
      freePhotoLimit={freePhotoLimit}
    />
  );
}
