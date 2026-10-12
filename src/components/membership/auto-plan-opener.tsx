"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MembershipPlan } from "@/types";
import { PlanCheckout } from "@/components/membership/plan-checkout";

// reopens checkout after a sign-in bounce. a signed-out member who tapped a paid
// plan is sent to /login with ?next=/membership?plan=<id>; this reads that id
// back and opens the plan's checkout immediately, so signing in does not quietly
// drop the purchase. closing the modal clears the query so a refresh does not
// reopen it.
function AutoPlanOpenerInner({ plans }: { plans: MembershipPlan[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const plan = plans.find((p) => p.id === searchParams.get("plan") && p.price > 0) ?? null;
  const [open, setOpen] = useState(() => plan !== null);

  if (!plan) return null;

  const close = () => {
    setOpen(false);
    router.replace("/membership");
  };

  return (
    <PlanCheckout
      plan={plan}
      open={open}
      initialStep="pay"
      onClose={() => {
        close();
        router.refresh();
      }}
    />
  );
}

export function AutoPlanOpener({ plans }: { plans: MembershipPlan[] }) {
  return (
    <Suspense fallback={null}>
      <AutoPlanOpenerInner plans={plans} />
    </Suspense>
  );
}
