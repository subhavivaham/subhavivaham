import type { Metadata } from "next";
import { ArrowDown, Clock, ShieldCheck, Store } from "lucide-react";
import { VendorRegisterForm } from "@/components/services/vendor-register-form";
import { SERVICE_CATEGORY_LABELS, SERVICE_TYPE_LABELS, SERVICE_TYPES } from "@/features/services/types";
import { Button } from "@/components/ui/button";
import { HeroPlate, Rule } from "@/components/ui/hero-plate";
import { CONTAINER } from "@/lib/constants";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "Vendor Register — Subha Vivaham Matrimony",
  description:
    "List your marriage hall, catering, photography, decoration or event business on Subha Vivaham and reach couples planning a Tamil wedding.",
  path: "/vendor-register",
});

const PROMISES = [
  {
    icon: Clock,
    title: "Live in a day",
    body: "We review every submission ourselves, so your listing goes up quickly and stays accurate.",
  },
  {
    icon: Store,
    title: "The right audience",
    body: "Couples are already here comparing halls, caterers and photographers for their wedding.",
  },
  {
    icon: ShieldCheck,
    title: "You stay in control",
    body: "Tell us any change to your number or your offer and we will update the listing for you.",
  },
];

export default function VendorRegisterPage() {
  return (
    <div className="bg-gradient-to-b from-ivory-50 via-white to-ivory-50/60 pb-20">
      {/* hero — the shared dark title plate, centred, same as success stories */}
      <HeroPlate>
        <div className="relative mx-auto w-full max-w-3xl px-4 pt-10 pb-16 text-center sm:px-6 sm:pt-14 sm:pb-20 lg:py-24">
          <p className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.34em] text-gold-300 sm:text-xs">
            <Store className="h-3.5 w-3.5" />
            Vendor register
          </p>

          <h1 className="mt-2 font-display text-[1.75rem] font-semibold leading-[1.05] tracking-tight text-white sm:text-4xl lg:text-5xl xl:text-6xl">
            Your business, in front of{" "}
            <span className="bg-gradient-to-r from-gold-200 via-gold-400 to-gold-600 bg-clip-text text-transparent">
              Tamil couples
            </span>
          </h1>

          <div className="mx-auto mt-7 max-w-md">
            <Rule />
          </div>

          <p className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
            Marriage halls, caterers, photographers, decorators, event managers and
            marriage bureaus all appear on our services page. It is free, and your
            details are shown exactly as you write them.
          </p>

          <ul className="mx-auto mt-10 flex max-w-2xl flex-wrap items-center justify-center gap-2.5">
            {SERVICE_TYPES.map((type) => (
              <li
                key={type}
                className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/75"
              >
                {SERVICE_TYPE_LABELS[type]}
              </li>
            ))}
          </ul>

          <div className="mt-10 flex justify-center">
            <Button href="#vendor-form" size="lg" variant="gold" className="w-full sm:w-auto">
              Start your listing
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </HeroPlate>

      <div className={`${CONTAINER} pt-12`}>
        <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:items-start">
          {/* the anchor the hero button drops to, and scroll-mt so the heading it
              lands on is not tucked under the sticky header */}
          <div id="vendor-form" className="scroll-mt-24">
            <VendorRegisterForm />
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24">
            {PROMISES.map((promise) => (
              <div
                key={promise.title}
                className="flex gap-3.5 rounded-2xl border border-charcoal-200 bg-white p-5 shadow-card"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-50 text-gold-700">
                  <promise.icon className="h-4.5 w-4.5" />
                </span>
                <div>
                  <h2 className="font-semibold text-charcoal-900">{promise.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-charcoal-500">{promise.body}</p>
                </div>
              </div>
            ))}
          </aside>
        </div>
      </div>
    </div>
  );
}
