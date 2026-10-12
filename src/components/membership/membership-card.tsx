"use client";

import { useState } from "react";
import { Check, Crown, Gift, Sparkles } from "lucide-react";
import type { MembershipPlan } from "@/types";
import { Button } from "@/components/ui/button";
import { PlanCheckout } from "@/components/membership/plan-checkout";
import { cn } from "@/lib/utils";

export function MembershipCard({ plan }: { plan: MembershipPlan }) {
  const [open, setOpen] = useState(false);

  // the checkout modal always opens, signed in or not. a signed-out visitor
  // meets the sign-in option inside it rather than being bounced away before
  // seeing anything, and the modal carries the plan id into the login redirect
  // so the upload step reopens straight after signing in.
  const choose = () => {
    setOpen(true);
  };

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-3xl border bg-white p-7 shadow-card transition-all hover:shadow-card-hover",
        plan.popular ? "border-wine-700 ring-1 ring-wine-700" : "border-charcoal-100"
      )}
    >
      {plan.popular && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-wine-700 px-4 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
          Most popular
        </span>
      )}

      <div className="mb-4 flex items-center gap-2">
        {plan.name === "premium" ? (
          <Crown className="h-6 w-6 text-gold-500" />
        ) : plan.name === "silver" ? (
          <Sparkles className="h-6 w-6 text-wine-600" />
        ) : plan.name === "free" ? (
          <Gift className="h-6 w-6 text-charcoal-500" />
        ) : (
          <span className="h-6 w-6" />
        )}
        <div>
          <h3 className="font-display text-lg font-semibold text-charcoal-900">{plan.label}</h3>
          {plan.subtitle && <p className="text-xs text-charcoal-500">{plan.subtitle}</p>}
        </div>
      </div>

      <div className="mb-6 flex items-baseline gap-1">
        <span className="text-lg font-medium text-charcoal-600">₹</span>
        <p className="text-4xl font-semibold tracking-tight text-charcoal-900">
          {plan.price === 0 ? "0" : String(plan.price)}
        </p>
        <p className="mt-1 text-sm text-charcoal-500">
          {plan.price === 0 ? "Free forever" : `for ${plan.period}`}
        </p>
      </div>

      <ul className="mb-7 flex-1 space-y-2.5">
        {plan.features.map((feature) => (
          <li key={feature.label} className="flex items-start gap-2.5 text-sm">
            <span
              className={cn(
                "mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full",
                feature.included ? "bg-emerald-100 text-emerald-700" : "bg-charcoal-100 text-charcoal-400"
              )}
            >
              <Check className="h-3 w-3" />
            </span>
            <span className={feature.included ? "text-charcoal-700" : "text-charcoal-400 line-through"}>
              {feature.label}
            </span>
          </li>
        ))}
      </ul>

      <Button
        variant={plan.popular ? "primary" : plan.price === 0 ? "outline" : "secondary"}
        fullWidth
        size="lg"
        href={plan.price === 0 ? "/register" : undefined}
        onClick={plan.price === 0 ? undefined : choose}
      >
        {plan.price === 0 ? "Create Free Profile" : `Choose ${plan.label}`}
      </Button>

      {plan.price > 0 && (
        <PlanCheckout plan={plan} open={open} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
