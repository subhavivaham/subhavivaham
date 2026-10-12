import { membershipPlans as fallbackPlans } from "@/features/membership/data";
import { AutoPlanOpener } from "@/components/membership/auto-plan-opener";
import { MembershipCard } from "@/components/membership/membership-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { fetchPlans } from "@/lib/data/queries";

export async function MembershipPlans() {
  // the plans table is the source of truth, so an admin price change shows up
  // on the next load. the shipped copy is only the fallback for an empty read
  // or an unreachable database, never the display.
  let plans = fallbackPlans;
  try {
    const rows = await fetchPlans();
    if (rows.length > 0) plans = rows;
  } catch {
    /* fall back to the shipped copy */
  }
  return (
    <section id="plans" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Membership"
          title="Choose a membership plan"
        />
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
      </div>
    </section>
  );
}