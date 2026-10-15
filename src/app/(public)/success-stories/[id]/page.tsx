import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Heart, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTAINER } from "@/lib/constants";
import { fetchStory } from "@/lib/data/queries";
import { pageSeo } from "@/lib/seo";

// a story slug is database data. without force-dynamic the page is still not
// frozen at build time: with no generateStaticParams it renders on first request
// and is then cached, so a story published after the build is picked up on its
// first visit rather than 404ing. refresh in the background after the window.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const story = await fetchStory(id);
  if (!story) return { title: "Story not found — Subha Vivaham", robots: { index: false } };
  return pageSeo({
    title: `${story.couple} — Success Story | Subha Vivaham`,
    description: story.tagline,
    path: `/success-stories/${story.id}`,
    type: "article",
  });
}

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await fetchStory(id);
  if (!story) notFound();

  return (
    <div className="py-10 sm:py-14">
      <article className={CONTAINER}>
        <Link
          href="/success-stories"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-charcoal-500 transition-colors hover:text-wine-700"
        >
          <ArrowLeft className="h-4 w-4" /> All success stories
        </Link>

        <div className="mt-6 mx-auto max-w-3xl">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold-200 bg-gold-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-gold-700">
              <Heart className="h-3.5 w-3.5" /> {story.matchPercent}% matched
            </span>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-charcoal-900 sm:text-5xl">
              {story.couple}
            </h1>
            <p className="mt-2 flex items-center gap-1.5 text-charcoal-500">
              <MapPin className="h-4 w-4" /> {story.location} · Found each other in {story.daysMatched}
            </p>
            <p className="mt-4 font-display text-xl italic text-wine-700">{story.tagline}</p>

            <figure className="mt-6 rounded-3xl border border-charcoal-100 bg-ivory-50 p-6">
              <blockquote className="font-display text-lg leading-relaxed text-charcoal-700">
                &ldquo;{story.quote}&rdquo;
              </blockquote>
            </figure>

            <div className="mt-8 space-y-5">
              {story.story.map((para, i) => (
                <p key={i} className="text-base leading-relaxed text-charcoal-700">
                  {para}
                </p>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <p className="text-sm text-charcoal-500">Inspired to begin your journey?</p>
              <Button href="/register" size="sm">
                Create free profile
              </Button>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}