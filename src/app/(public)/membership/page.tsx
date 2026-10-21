import type { Metadata } from "next";
import { ArrowDown, Check, Sparkles, X } from "lucide-react";
import { MembershipPlans } from "@/components/membership/membership-plans";
import { Button } from "@/components/ui/button";
import { HeroPlate, Rule } from "@/components/ui/hero-plate";
import { SectionHeading } from "@/components/ui/section-heading";
import { fetchPlans } from "@/lib/data/queries";
import { cn } from "@/lib/utils";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "Membership — Subha Vivaham Matrimony",
  description:
    "Compare Free, Silver and Premium plans. Get more visibility and connect faster.",
  path: "/membership",
});

// prices, plan cards and compare rows all come from the membership_plans table,
// so this page is rendered per request — a statically prerendered copy would
// keep showing the last build no matter what the admin sets afterwards.
export const dynamic = "force-dynamic";

const tiers = ["free", "silver", "premium"] as const;

export default async function MembershipPage() {
  // compare rows and their per-tier cells come from membership_plans
  // (compare_features), so an admin edit shows up on the next load. the free
  // plan defines the row order and labels; every plan lists the same labels.
  const plans = await fetchPlans();
  const rows = plans.find((plan) => plan.id === "free")?.compareFeatures ?? [];
  const cellFor = (tier: (typeof tiers)[number], label: string) =>
    plans
      .find((plan) => plan.id === tier)
      ?.compareFeatures?.find((feature) => feature.label === label)?.value ?? false;

  return (
    <div>
      {/* hero — the shared dark title plate, centred */}
      <HeroPlate>
        <div className="relative mx-auto w-full max-w-3xl px-4 pt-10 pb-16 text-center sm:px-6 sm:pt-14 sm:pb-20 lg:py-24">
          <p className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.34em] text-gold-300 sm:text-xs">
            <Sparkles className="h-3.5 w-3.5" />
            Membership
          </p>

          <h1 className="mt-2 font-display text-[1.75rem] font-semibold leading-[1.05] tracking-tight text-white sm:text-4xl lg:text-5xl xl:text-6xl">
            Seen by the{" "}
            <span className="bg-gradient-to-r from-gold-200 via-gold-400 to-gold-600 bg-clip-text text-transparent">
              right people
            </span>
          </h1>

          <div className="mx-auto mt-7 max-w-md">
            <Rule />
          </div>

          <p className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
            Plans that help you stand out, connect faster and find someone who
            truly feels like home. Start free, and move up only when you want more.
          </p>

          <div className="mt-10 flex justify-center">
            <Button href="#plans" size="lg" variant="gold" className="w-full sm:w-auto">
              See the plans
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </HeroPlate>

      <MembershipPlans />

      <section className="bg-ivory-100 py-20 sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Compare"
            title="What every plan includes"
            description="Everything you need at every stage of your journey."
          />
          {/* four columns do not fit a phone, and pushing the table sideways to
              make them fit hides the Premium column — the one people came to
              compare. below sm the same rows are stacked as cards, one per
              feature, so every plan is readable without sideways scrolling. both
              views read from the same list, so they cannot fall out of step. */}
          <div className="mx-auto max-w-4xl">
            <div className="hidden overflow-x-auto rounded-3xl border border-charcoal-100 bg-white shadow-card sm:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-charcoal-100 bg-ivory-50/60">
                    <th className="px-6 py-4 font-semibold text-charcoal-700">Feature</th>
                    <th className="px-4 py-4 text-center font-semibold text-charcoal-700">Free</th>
                    <th className="border-x border-wine-200 bg-wine-50 px-4 py-4 text-center font-semibold text-wine-700">
                      Silver
                    </th>
                    <th className="px-4 py-4 text-center font-semibold text-wine-700">Premium</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label} className="border-b border-charcoal-50 last:border-0">
                      <td className="px-6 py-3.5 text-charcoal-800">{row.label}</td>
                      {tiers.map((tier) => (
                        <td
                          key={tier}
                          className={cn(
                            "px-4 py-3.5 text-center",
                            tier === "silver" && "border-x border-wine-200 bg-wine-50/70"
                          )}
                        >
                          {cell(cellFor(tier, row.label))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 sm:hidden">
              {rows.map((row) => (
                <li
                  key={row.label}
                  className="rounded-2xl border border-charcoal-100 bg-white p-4 shadow-card"
                >
                  <p className="text-sm font-semibold text-charcoal-900">{row.label}</p>
                  <dl className="mt-3 grid grid-cols-3 gap-2">
                    {tiers.map((tier) => (
                      <div
                        key={tier}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5",
                          tier === "silver"
                            ? "border border-wine-200 bg-wine-50"
                            : "bg-ivory-50"
                        )}
                      >
                        <dt
                          className={cn(
                            "text-[11px] font-semibold uppercase tracking-[0.12em]",
                            tier === "premium" || tier === "silver"
                              ? "text-wine-700"
                              : "text-charcoal-500"
                          )}
                        >
                          {tier}
                        </dt>
                        <dd className="flex min-h-5 items-center justify-center text-sm">
                          {cell(cellFor(tier, row.label))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function cell(value: boolean | string): React.ReactNode {
  if (value === true) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-50 text-red-500">
        <X className="h-3.5 w-3.5" />
      </span>
    );
  }
  return <span className="text-xs font-medium text-charcoal-600">{value}</span>;
}
