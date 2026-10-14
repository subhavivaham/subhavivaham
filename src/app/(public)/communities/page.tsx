import type { Metadata } from "next";
import { CommunitiesHero } from "@/components/communities/communities-hero";
import { CONTAINER } from "@/lib/constants";
import { fetchCommunities, fetchProfiles } from "@/lib/data/queries";

// Cached and refreshed in the background rather than rebuilt per request. The
// old force-dynamic guarded against baking an empty list at build time;
// revalidate covers that too, because an empty page is regenerated on the first
// request after the window rather than served forever. reads are tagged, so an
// admin save clears them at once.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "சமூகங்கள் — Subha Vivaham Matrimony",
  description:
    "Browse matrimonial profiles by community — Iyer, Iyengar, Chettiar, Mudaliar, Gounder, Thevar, Naidu and more.",
};

export default async function CommunitiesPage() {
  const [communities, profiles] = await Promise.all([
    fetchCommunities(),
    fetchProfiles(),
  ]);
  // a community counts as populated when any visible profile claims it, so the
  // badge always reflects the rows actually in the database
  const counts = new Map<string, number>();
  for (const p of profiles) {
    const key = p.community?.toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // const membersOf = (name: string, tamilName: string) =>
  //   counts.get(name.toLowerCase()) ?? counts.get(tamilName.toLowerCase()) ?? 0;

  return (
    <div>
      <CommunitiesHero
        communityCount={communities.length}
        profileCount={profiles.length}
      />

      <div className={`${CONTAINER} py-12 sm:py-16`}>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-lg font-semibold text-wine-700">Coming soon</p>
          <p className="mt-2 text-sm text-charcoal-500">
            Community details are being updated. Please check back shortly.
          </p>
        </div>
      </div>

      {/* Communities list and CTA - commented out as requested */}
      {/* <section id="communities-grid" className={`${CONTAINER} scroll-mt-24 pt-10 sm:pt-12`}>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {communities.map((c) => {
            const members = membersOf(c.name, c.tamilName);
            return (
              <Link
                key={c.id}
                href={`/communities/${c.id}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-wine-500 bg-white p-7 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-wine-900 hover:shadow-card-hover"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-wine-700 via-gold-400 to-wine-700 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-lg font-semibold tracking-tight text-wine-700 transition-colors duration-300 group-hover:text-wine-900">
                    {c.name}
                  </h2>
                  <span className="shrink-0 text-sm text-charcoal-400">{c.tamilName}</span>
                </div>
                <p className="mt-3 mb-6 text-sm leading-relaxed text-charcoal-500">
                  {c.description}
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-charcoal-100 pt-4">
                  <span
                    className={
                      members > 0
                        ? "text-sm font-semibold text-wine-700"
                        : "text-sm font-medium text-charcoal-400"
                    }
                  >
                    {members > 0
                      ? `${members} ${members === 1 ? "profile" : "profiles"}`
                      : "No profiles yet"}
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-charcoal-200 text-charcoal-400 transition-all duration-300 group-hover:border-wine-700 group-hover:bg-wine-700 group-hover:text-white">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className={`${CONTAINER} py-16 sm:py-20`}>
        <div className="relative overflow-hidden rounded-3xl bg-wine-800 px-8 py-14 text-center shadow-soft sm:px-16">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-gold-500/10 blur-3xl"
          />
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500/15 text-gold-300">
            <Sparkles className="h-6 w-6" />
          </span>
          <h2 className="mt-5 font-display text-2xl font-semibold text-white sm:text-3xl">
            Don&apos;t see your community?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/75">
            We add new communities regularly. Register your profile and we&apos;ll list you under the
            right community so families can find you.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold-500 px-7 text-base font-semibold text-charcoal-950 shadow-sm transition-colors hover:bg-gold-400 sm:w-auto"
          >
            Register your profile
          </Link>
        </div>
      </div> */}
    </div>
  );
}