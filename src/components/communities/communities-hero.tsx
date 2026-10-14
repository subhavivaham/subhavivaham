import { ArrowDown, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroPlate, Rule } from "@/components/ui/hero-plate";

export function CommunitiesHero({
  communityCount,
  profileCount,
}: {
  communityCount: number;
  profileCount: number;
}) {
  const readout = [
    { value: String(communityCount), label: "Communities" },
    { value: String(profileCount), label: "Profiles listed" },
    { value: "Tamil Nadu", label: "Plus all India" },
    { value: "Verified", label: "ID & photo checked" },
  ];

  return (
    <HeroPlate>
      <div className="relative mx-auto w-full max-w-3xl px-4 pt-10 pb-16 text-center sm:px-6 sm:pt-14 sm:pb-20 lg:py-24">
        <p className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.34em] text-gold-300 sm:text-xs">
          <UsersRound className="h-3.5 w-3.5" />
          சமூகங்கள்
        </p>

        <h1 className="mt-2 font-display text-[1.75rem] font-semibold leading-[1.05] tracking-tight text-white sm:text-4xl lg:text-5xl xl:text-6xl">
          Find your{" "}
          <span className="bg-gradient-to-r from-gold-200 via-gold-400 to-gold-600 bg-clip-text text-transparent">
            Community
          </span>
        </h1>

        <div className="mx-auto mt-7 max-w-md">
          <Rule />
        </div>

        <p className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
          Browse verified profiles within your own community — because family
          matters as much as the match itself. Every community here keeps its own
          customs and expectations, so start with the one that is yours.
        </p>

        {/* the last track is wider because "ID & photo checked" is the longest
            label, and at an even four columns it wrapped while the rest did not */}
        {/* <dl className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-[repeat(3,minmax(0,1fr))_1.45fr]">
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

        <div className="mt-10 flex justify-center">
          <Button href="#communities-grid" size="lg" variant="gold" className="w-full sm:w-auto">
            Browse communities
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div> */}
      </div>
    </HeroPlate>
  );
}
