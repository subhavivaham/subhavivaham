"use client";

import { useState, useEffect } from "react";
import { ProfileGrid } from "@/components/profile/profile-card";
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

export function MatchesGrid() {
  const { user, isLoading: authLoading } = useAuth();
  const [tier, setTier] = useState(0);
  const [matches, setMatches] = useState<(Profile & { score?: number })[]>([]);

  const profileId = user?.profileId;

  useEffect(() => {
    if (authLoading || !profileId) return;
    let cancelled = false;

    void (async () => {
      const own = await loadOwnProfile(profileId);
      const results = await loadRecommendedMatches(own, 24);
      if (cancelled) return;
      setMatches(results.map((p) => ({ ...p, score: p.matchPercentage })));
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, profileId]);

  const filtered = matches.filter(
    (m) => (m.score ?? 0) >= matchTiers[tier].min && (m.score ?? 0) <= matchTiers[tier].max
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-charcoal-900 sm:text-3xl">
            Matches for you
          </h1>
          <p className="mt-1 text-charcoal-500">
            {filtered.length} compatible profile{filtered.length === 1 ? "" : "s"} based on your preferences.
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

      <ProfileGrid profiles={filtered} />
    </div>
  );
}
