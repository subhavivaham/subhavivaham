import { AutoPlanOpener } from "@/components/membership/auto-plan-opener";
import { MembershipCard } from "@/components/membership/membership-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { fetchPlans } from "@/lib/data/queries";

export async function MembershipPlans() {
  // membership_plans is the single source of truth. there is deliberately no
  // bundled fallback here: an empty read means the database is unreachable or
  // unseeded, and it is shown as such rather than masked by stale shipped copy
  // (which is how a wrong key or a missing policy used to look like real data).
  const plans = await fetchPlans();
  return (
    <section id="plans" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Membership"
          title="Choose a membership plan"
        />
        {plans.length === 0 ? (
          <p className="mx-auto mt-4 max-w-xl text-center text-sm text-charcoal-500">
            Membership plans are unavailable right now. Please check back shortly.
          </p>
        ) : (
          <>
            <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-3">
              {plans
                .filter((p) => p.id !== "gold")
                .sort((a, b) => {
                  const order: Record<string, number> = { free: 0, silver: 1, premium: 2 };
                  return (order[a.id] ?? 99) - (order[b.id] ?? 99);
                })
                .map((plan) => (
                  <MembershipCard key={plan.id} plan={plan} />
                ))}
            </div>
            <AutoPlanOpener plans={plans} />
          </>
        )}
      </div>
    </section>
  );
}