import type { Metadata } from "next";
import Link from "next/link";
import { Heart, MapPin, ArrowUpRight, ArrowDown, Sparkles, Quote } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { HeroPlate, Rule } from "@/components/ui/hero-plate";
import { CONTAINER } from "@/lib/constants";
import { coupleInitials } from "@/lib/utils";
import { fetchStories } from "@/lib/data/queries";

export const metadata: Metadata = {
  title: "Success Stories — Subha Vivaham",
  description:
    "Real couples who found their person on Subha Vivaham — and the families who celebrated with them.",
};

export default async function SuccessStoriesPage() {
  const successStories = await fetchStories();
  const [featured, ...rest] = successStories;

  // the hero's readout is derived rather than written, so it can never claim a
  // number the stories below do not support
  const published = successStories.filter((story) => story.status === "published");
  const cities = new Set(published.map((story) => story.location).filter(Boolean));
  const averageMatch = published.length
    ? Math.round(
        published.reduce((total, story) => total + story.matchPercent, 0) / published.length
      )
    : 0;

  const readout = [
    { value: String(published.length), label: "Marriages featured" },
    { value: String(cities.size), label: "Cities" },
    { value: `${averageMatch}%`, label: "Average match score" },
    { value: "Verified", label: "ID & photo checked" },
  ];

  return (
    <div>
      {/* hero — the shared dark title plate, centred */}
      <HeroPlate>
        <div className="relative mx-auto w-full max-w-3xl px-4 pt-10 pb-16 text-center sm:px-6 sm:pt-14 sm:pb-20 lg:py-24">
          <p className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.34em] text-gold-300 sm:text-xs">
            <Heart className="h-3.5 w-3.5" />
            Success stories
          </p>

          <h1 className="mt-2 font-display text-[1.75rem] font-semibold leading-[1.05] tracking-tight text-white sm:text-4xl lg:text-5xl xl:text-6xl">
            Journeys that{" "}
            <span className="bg-gradient-to-r from-gold-200 via-gold-400 to-gold-600 bg-clip-text text-transparent">
              began here
            </span>
          </h1>

          <div className="mx-auto mt-7 max-w-md">
            <Rule />
          </div>

          <p className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
            Real couples who found their person here — and the families who
            celebrated with them. Every story below is one we have checked, with
            the match score their chart actually gave.
          </p>

          {/* the last track is wider because "ID & photo checked" is the longest
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

          <div className="mt-10 flex justify-center">
            <Button href="#featured-story" size="lg" variant="gold" className="w-full sm:w-auto">
              Read their stories
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </HeroPlate>

      {/* featured story — editorial split */}
      {featured && (
        <section id="featured-story" className="scroll-mt-24 bg-ivory-50">
          <div className={`${CONTAINER} py-16 sm:py-24`}>
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
              <span className="h-px w-8 bg-gold-500" />
              Featured story
            </p>
            <h2 className="mt-4 max-w-2xl font-display text-2xl font-semibold tracking-tight text-charcoal-900 sm:text-3xl">
              {featured.tagline}
            </h2>

            <Link
              href={`/success-stories/${featured.id}`}
              className="group mt-10 grid overflow-hidden rounded-3xl border border-wine-500 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-wine-700 hover:shadow-card-hover lg:grid-cols-2"
            >
              {/* no stock photo here — the couple's initials carry the panel, so the
                  page never shows a picture of someone who is not a real member */}
              <div className="relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden bg-wine-950 lg:aspect-auto lg:min-h-[26rem]">
                <div
                  aria-hidden
                  className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(212,175,55,0.22),transparent_62%)]"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-[0.18] [background-image:repeating-linear-gradient(90deg,rgba(255,255,255,0.08)_0px,rgba(255,255,255,0.08)_1px,transparent_1px,transparent_7px)]"
                />
                <div className="relative flex h-32 w-32 items-center justify-center rounded-full border border-gold-400/30 bg-gold-400/10 font-display text-3xl font-semibold tracking-wide text-gold-300 sm:h-40 sm:w-40 sm:text-4xl">
                  {coupleInitials(featured.shortNames || featured.couple)}
                </div>
                <p className="relative mt-6 px-6 text-center font-display text-lg text-white/80">
                  {featured.shortNames || featured.couple}
                </p>
                <span className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-wine-700 shadow-sm">
                  <Sparkles className="h-3.5 w-3.5 text-gold-500" />
                  {featured.matchPercent}% match
                </span>
              </div>

              <div className="flex flex-col justify-center p-7 sm:p-10">
                <Quote className="h-8 w-8 text-gold-400" />
                <p className="mt-4 font-display text-lg leading-relaxed text-charcoal-800 sm:text-xl">
                  &ldquo;{featured.quote}&rdquo;
                </p>
                <div className="mt-7 border-t border-charcoal-100 pt-5">
                  <p className="font-display text-lg font-semibold text-wine-700">
                    {featured.couple}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-charcoal-500">
                    <MapPin className="h-3.5 w-3.5" /> {featured.location}
                    <span className="mx-1 text-charcoal-300">·</span>
                    Married in {featured.daysMatched}
                  </p>
                </div>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-wine-700">
                  Read their story
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* the rest — quote-led cards */}
      <section className="bg-white">
        <div className={`${CONTAINER} py-16 sm:py-24`}>
          <div className="flex flex-col gap-4 border-b-2 border-charcoal-900 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-charcoal-900 sm:text-3xl">
              More happy endings
            </h2>
            <p className="shrink-0 text-xs font-medium uppercase tracking-[0.18em] text-charcoal-400">
              {rest.length} stories
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((story) => (
              <Link
                key={story.id}
                href={`/success-stories/${story.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-wine-500 bg-white p-7 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-wine-700 hover:shadow-card-hover"
              >
                <div className="flex items-center gap-4">
                  <Avatar
                    name={story.couple}
                    fallback="icon"
                    className="h-14 w-14 border border-wine-300 ring-1 ring-wine-500/20"
                  />
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-lg font-semibold text-wine-700 transition-colors duration-300 group-hover:text-wine-900">
                      {story.couple}
                    </h3>
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-charcoal-500">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{story.location}</span>
                    </p>
                  </div>
                </div>

                <p className="mt-5 flex-1 text-sm leading-relaxed text-charcoal-600">
                  &ldquo;{story.quote}&rdquo;
                </p>

                <div className="mt-6 flex items-center justify-between gap-3 border-t border-charcoal-100 pt-4">
                  <span className="text-sm font-semibold text-wine-700">
                    {story.matchPercent}% match
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-charcoal-200 text-charcoal-400 transition-all duration-300 group-hover:border-wine-700 group-hover:bg-wine-700 group-hover:text-white">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
