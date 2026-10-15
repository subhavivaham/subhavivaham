import type { Metadata } from "next";
import { ArrowDown, Sparkles } from "lucide-react";
import { ServicesDirectory } from "@/components/services/services-directory";
import { Button } from "@/components/ui/button";
import { HeroPlate, Rule } from "@/components/ui/hero-plate";
import { CONTAINER } from "@/lib/constants";
import { fetchServices } from "@/lib/data/queries";
import { categoryOf } from "@/features/services/types";
import { pageSeo } from "@/lib/seo";

// Cached and refreshed in the background rather than rebuilt per request, so a
// returning visitor does not wait on a vendor query each time. Every read is
// tagged, so an admin save clears it immediately.
export const revalidate = 300;

export const metadata: Metadata = pageSeo({
  title: "சேவைகள் — Subha Vivaham Matrimony",
  description:
    "Verified wedding vendors across southern districts — marriage halls, caterers, photographers, decorators, event managers and marriage bureaus.",
  path: "/services",
});

export default async function ServicesPage() {
  const services = await fetchServices();

  // a vendor deactivated in admin must vanish from the public listing, so the
  // flag is applied here rather than inside the shared query, which the admin
  // manager also uses and which needs to see inactive rows.
  const active = services.filter((service) => service.active);

  // the hero counts are derived from the rows that are actually published, so
  // the numbers can never drift from the listing below them
  const categories = new Set(active.map((s) => categoryOf(s.type)));
  const cities = new Set(active.map((s) => s.city.trim()).filter(Boolean));
  const readout = [
    { value: String(active.length), label: "Vendors listed" },
    { value: String(categories.size), label: "Categories" },
    { value: String(cities.size), label: "Cities covered" },
    { value: "Verified", label: "ID & business checked" },
  ];

  return (
    <div className="bg-gradient-to-b from-ivory-50 via-white to-ivory-50/60 pb-20">
      {/* ------------------------------------------------------------- hero */}
      <HeroPlate>
        <div className="relative mx-auto w-full max-w-3xl px-4 pt-10 pb-16 text-center sm:px-6 sm:pt-14 sm:pb-20 lg:py-24">
          <p className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.34em] text-gold-300 sm:text-xs">
            <Sparkles className="h-3.5 w-3.5" />
            சேவைகள்
          </p>

          <h1 className="mt-2 font-display text-[1.75rem] font-semibold leading-[1.05] tracking-tight text-white sm:text-4xl lg:text-5xl xl:text-6xl">
            Wedding{" "}
            <span className="bg-gradient-to-r from-gold-200 via-gold-400 to-gold-600 bg-clip-text text-transparent">
              services
            </span>
          </h1>

          <div className="mx-auto mt-7 max-w-md">
            <Rule />
          </div>

          <p className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
            Marriage halls, caterers, photographers, decorators, event managers
            and marriage bureaus around southern districts.
            Every listing here is maintained by our own team.
          </p>

          {/* the last track is wider because "ID & business checked" is the longest
              label, and at an even four columns it wrapped while the rest did not */}
          <dl className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-[repeat(3,minmax(0,1fr))_1.45fr]">
            {readout.map((item) => (
              <div key={item.label} className="bg-wine-950 px-3 py-4 sm:px-4">
                <dt className="sr-only">{item.label}</dt>
                <dd>
                  <span className="block font-display text-xl font-semibold text-gold-300 sm:text-2xl">
                    {item.value}
                  </span>
                  <span className="mt-1 block text-[10px] uppercase leading-tight tracking-[0.12em] text-white/50 sm:text-[11px] sm:tracking-[0.14em]">
                    {item.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href="#services-directory" size="lg" variant="gold" className="w-full sm:w-auto">
              Browse vendors
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button href="/vendor-register" size="lg" variant="outline" className="w-full sm:w-auto">
              Register your service
            </Button>
          </div>
        </div>
      </HeroPlate>

      {/* --------------------------------------------------------- listing */}
      <div id="services-directory" className={`${CONTAINER} scroll-mt-24 pt-16`}>
        <ServicesDirectory services={active} />
      </div>
    </div>
  );
}
