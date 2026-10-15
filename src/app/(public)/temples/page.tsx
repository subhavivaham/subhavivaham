import type { Metadata } from "next";
import { ArrowDown, Sparkles } from "lucide-react";
import { TemplesDirectory } from "@/components/temples/temples-directory";
import { Button } from "@/components/ui/button";
import { HeroPlate, Rule } from "@/components/ui/hero-plate";
import { CONTAINER } from "@/lib/constants";
import { fetchTemples } from "@/lib/data/queries";
import { pageSeo } from "@/lib/seo";

// Cached and refreshed in the background rather than rebuilt per request. The
// old force-dynamic guarded against a build that ran without the env vars
// baking an empty list into static html; revalidate keeps that safe, because a
// page that did render empty is regenerated on the first request after the
// window rather than staying wrong. Every read is tagged, so an admin save
// clears it immediately.
export const revalidate = 300;

export const metadata: Metadata = pageSeo({
  title: "Temples — Subha Vivaham Matrimony",
  description:
    "Verified heritage temples across Tamil Nadu — deity, city, timings and contact for marriage blessings.",
  path: "/temples",
});

export default async function TemplesPage() {
  const temples = await fetchTemples();

  return (
    <div className="bg-gradient-to-b from-ivory-50 via-white to-ivory-50/60 pb-20">
      {/* ------------------------------------------------------------- hero */}
      <HeroPlate>
        <div className="relative mx-auto w-full max-w-3xl px-4 pt-10 pb-16 text-center sm:px-6 sm:pt-14 sm:pb-20 lg:py-24">
          <p className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.34em] text-gold-300 sm:text-xs">
            <Sparkles className="h-3.5 w-3.5" />
            கோயில்கள்
          </p>

          <h1 className="mt-2 font-display text-[1.75rem] font-semibold leading-[1.05] tracking-tight text-white sm:text-4xl lg:text-5xl xl:text-6xl">
            Temples{" "}
            <span className="bg-gradient-to-r from-gold-200 via-gold-400 to-gold-600 bg-clip-text text-transparent">
              across Tamil Nadu
            </span>
          </h1>

          <div className="mx-auto mt-7 max-w-md">
            <Rule />
          </div>

          <p className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
            Heritage temples across Tamil Nadu — deity, timings and contact
            details. Every listing here is maintained by our own team.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Button href="#temples-directory" size="lg" variant="gold" className="w-full sm:w-auto">
              Browse temples
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </HeroPlate>

      {/* --------------------------------------------------------- listing */}
      <div id="temples-directory" className={`${CONTAINER} scroll-mt-24 pt-16`}>
        <TemplesDirectory temples={temples} />
      </div>
    </div>
  );
}
