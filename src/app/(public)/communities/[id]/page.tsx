import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, UsersRound } from "lucide-react";
import { fetchCommunities, fetchProfiles } from "@/lib/data/queries";
import { ProfileGrid } from "@/components/profile/profile-card";
import { ProfileGateLink } from "@/components/profile/profile-gate-link";
import { EmptyState } from "@/components/ui/states";
import { pageSeo } from "@/lib/seo";
import { CONTAINER } from "@/lib/constants";

// the community and its members are read from the database; cached and refreshed
// in the background rather than rebuilt per request, and tagged so an admin save
// clears it at once
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const community = (await fetchCommunities()).find((c) => c.id === id);
  if (!community) return { title: "Community not found — Subha Vivaham", robots: { index: false } };
  return pageSeo({
    title: `${community.name} — Brides & Grooms | Subha Vivaham`,
    description: community.description,
    path: `/communities/${community.id}`,
  });
}

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [communities, profiles] = await Promise.all([
    fetchCommunities(),
    fetchProfiles(),
  ]);

  const community = communities.find((c) => c.id === id);
  if (!community) notFound();

  const members = profiles.filter((p) => p.community === community.name);

  // a preview, not the list. the count in the heading stays the real total, and
  // the button below the grid is what opens the full set behind the login wall,
  // so an empty "view all" on a page that shows everyone would be pointless.
  const PREVIEW_LIMIT = 8;
  const preview = members.slice(0, PREVIEW_LIMIT);

  return (
    <div className="py-10 sm:py-14">
      <section className="bg-gradient-to-b from-wine-950 to-wine-900 py-14 text-center sm:py-16">
        <div className={CONTAINER}>
          <Link
            href="/communities"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/70 transition-colors hover:text-gold-300"
          >
            <ArrowLeft className="h-4 w-4" /> All communities
          </Link>
          <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-500/15 font-display text-3xl font-semibold text-gold-300 ring-1 ring-gold-500/30">
            {community.name.charAt(0)}
          </div>
          <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {community.name} <span className="font-medium text-gold-300">· {community.tamilName}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/70">
            {community.description}
          </p>
          <p className="mt-3 text-sm font-semibold text-gold-300">{community.tamilDescription}</p>
        </div>
      </section>

      <section className={`${CONTAINER} mt-10`}>
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold text-charcoal-900">
            Profiles in {community.name}
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ivory-100 px-3.5 py-1.5 text-sm font-semibold text-charcoal-600">
            <UsersRound className="h-4 w-4" /> {members.length} {members.length === 1 ? "profile" : "profiles"}
          </span>
        </div>

        {members.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title="No profiles yet"
            description={`We don't have any ${community.name} profiles listed at the moment. Check back soon, or browse the other communities.`}
            action={
              <Link
                href="/communities"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-wine-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-wine-800"
              >
                Browse other communities
              </Link>
            }
          />
        ) : (
          <>
            <ProfileGrid profiles={preview} />

            {/* the grid above is a preview of the first eight: the full list lives
                behind the login wall, so a signed-out visitor gets the gate modal
                from the same link instead of a redirect that loses where they
                were. the button is hidden once the page is already showing
                everything, where it would only lead back here. */}
            {members.length > preview.length && (
              <div className="mt-10 flex justify-center">
              <ProfileGateLink
                href="/search"
                title="Sign in to view all profiles"
                description={`Log in to browse every ${community.name} profile, or create a free profile to start connecting.`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-wine-700 px-8 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-wine-800"
              >
                View all profiles
                <ArrowRight className="h-4 w-4" />
              </ProfileGateLink>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}