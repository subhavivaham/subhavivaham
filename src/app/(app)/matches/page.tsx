"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { SearchX } from "lucide-react";
import { ProfileGrid } from "@/components/profile/profile-card";
import { EmptyState } from "@/components/ui/states";
import { ProfileCardSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { loadOwnProfile, loadRecommendedMatches } from "@/features/profiles/loaders";
import { useAuth } from "@/features/auth/auth-provider";
import type { Profile } from "@/types";
import { cn } from "@/lib/utils";

const matchTiers = [
  { min: 0, max: 100, label: "All matches", hint: "Showing everything" },
  { min: 90, max: 100, label: "Best match", hint: "90% and above" },
  { min: 80, max: 89, label: "Very good", hint: "80–89%" },
  { min: 70, max: 79, label: "Good", hint: "70–79%" },
];

// this page reads the member's matches in an effect, so the first client render
// has no data and must not disagree with the server about it. React uses the
// server snapshot during hydration and only switches to the client one after,
// which is what keeps the loading line identical on both sides instead of a
// count the server cannot know.
const NO_SUBSCRIPTION = () => () => {};

function useMounted(): boolean {
  return useSyncExternalStore(
    NO_SUBSCRIPTION,
    () => true,
    () => false
  );
}

export default function MatchesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [tier, setTier] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<(Profile & { score?: number })[]>([]);
  const mounted = useMounted();

  // the member's own row decides which profiles are recommended, so it is read
  // first and handed to the loader. until the session settles nothing is
  // claimed: an anonymous visitor gets an empty list rather than someone
  // else's preferences
  const profileId = user?.profileId;

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    if (!profileId) {
      setMatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    void (async () => {
      const own = await loadOwnProfile(profileId);
      const results = await loadRecommendedMatches(own, 24);
      if (cancelled) return;
      setMatches(results.map((p) => ({ ...p, score: p.matchPercentage })));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, profileId]);

  const filtered = matches.filter(
    (m) => (m.score ?? 0) >= matchTiers[tier].min && (m.score ?? 0) <= matchTiers[tier].max
  );

  const showLoading = !mounted || loading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-charcoal-900 sm:text-3xl">
            Matches for you
          </h1>
          <p className="mt-1 text-charcoal-500">
            {showLoading
              ? "Finding compatible profiles based on your preferences…"
              : `${filtered.length} compatible profile${filtered.length === 1 ? "" : "s"} based on your preferences.`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {matchTiers.map((option, i) => (
          <button
            key={option.min}
            onClick={() => setTier(i)}
            className={cn(
              "group flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              tier === i
                ? "border-wine-700 bg-wine-700 text-white"
                : "border-charcoal-200 bg-white text-charcoal-700 hover:border-wine-300 hover:text-wine-700"
            )}
          >
            <span>{option.label}</span>
            <span className={cn("text-xs", tier === i ? "text-white/70" : "text-charcoal-400")}>
              {option.hint}
            </span>
          </button>
        ))}
      </div>

      {showLoading ? (
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProfileCardSkeleton key={i} />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No matches currently for your preference"
          description="We couldn't find compatible profiles right now. Try widening your partner preferences to see more members."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No matches in this range"
          description={`There are no profiles scoring ${matchTiers[tier].hint.toLowerCase()}. Try another match tier or the "All matches" view.`}
          action={
            <Button variant="outline" onClick={() => setTier(0)}>
              Show all matches
            </Button>
          }
        />
      ) : (
        <ProfileGrid profiles={filtered} />
      )}
    </div>
  );
}
