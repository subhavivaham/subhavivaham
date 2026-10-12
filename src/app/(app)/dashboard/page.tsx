"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Sparkles,
  HeartHandshake,
  Send,
  Eye,
  ArrowRight,
  Camera,
  Briefcase,
  BadgeCheck,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ProfileGrid } from "@/components/profile/profile-card";
import { browse } from "@/components/layout/dashboard-nav";
import { useAuth } from "@/features/auth/auth-provider";
import { useToast } from "@/lib/state/toast-provider";
import {
  computeProfileCompletion,
  loadOwnProfile,
  loadRecommendedMatches,
  type ProfileCompletion,
} from "@/features/profiles/queries";
import { getPhotoQuota } from "./profile/actions";
import { cn } from "@/lib/utils";

// the greeting is read in the browser only. this page is a client component, so
// it is also rendered on the server, and the server's clock sits in the
// deployment's timezone rather than the member's — that either ships the wrong
// word or makes hydration rewrite the heading under the reader. an empty string
// from the server snapshot costs one frame and never shows the wrong time.
const NO_SUBSCRIPTION = () => () => {};

function greetingFor(date: Date): string {
  const hour = date.getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function useGreeting(): string {
  return useSyncExternalStore(
    NO_SUBSCRIPTION,
    () => greetingFor(new Date()),
    () => ""
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();

  const greeting = useGreeting();
  const firstName = user?.name.split(" ")[0] ?? "Praveen";

  // the New Matches count is the same read the /matches page makes, so the card
  // and the tab can never disagree on the number. while it is still loading the
  // value stays 0 on both the server and the first client render.
  const [matchCount, setMatchCount] = useState<number | null>(null);
  useEffect(() => {
    void loadRecommendedMatches(24).then((results) => setMatchCount(results.length));
  }, []);

  // the signed-in member's own row, the same read the profile page makes. the id
  // travels with the result so a slow response for a previous member can never
  // be rendered for the current one.
  const [fetched, setFetched] = useState<{ id: string; completion?: ProfileCompletion } | null>(null);

  const profileId = user?.profileId;
  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;

    void Promise.all([loadOwnProfile(profileId), getPhotoQuota()]).then(([found, quota]) => {
      if (cancelled) return;
      setFetched({
        id: profileId,
        completion: found ? computeProfileCompletion(found, quota) : undefined,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const completion = fetched && fetched.id === profileId ? fetched.completion : undefined;
  const percent = completion?.percent ?? 0;

  // the prompt follows the plan's photo allowance, so it only shows while the
  // member still has a free slot (free 1, silver 5, premium 10). once the quota
  // is used up the chip disappears rather than asking for a photo they cannot
  // add. until the profile is whole there is still something to fix, so that
  // earns a route to the profile page in place of the verify chip
  const completionTasks = [
    ...(completion?.tasks.enoughPhotos
      ? []
      : [{ label: "Add more photos", icon: Camera, done: false }]),
    { label: "Complete education & career", icon: Briefcase, done: completion?.tasks.career ?? false },
  ];

  const needsWork = percent < 100;
  const completionChip = needsWork ? (
    <Link
      href="/dashboard/profile"
      className="flex items-center gap-2 rounded-full border border-wine-300 bg-wine-50 px-3.5 py-2 text-sm font-medium text-wine-700 transition-colors hover:bg-wine-100"
    >
      <Pencil className="h-4 w-4" /> Complete profile
      <ArrowRight className="h-4 w-4" />
    </Link>
  ) : (
    <button
      onClick={() => toast("Verification is reviewed by our team.", "info")}
      className="flex items-center gap-2 rounded-full border border-charcoal-200 bg-white px-3.5 py-2 text-sm font-medium text-charcoal-700 transition-colors hover:border-wine-300 hover:text-wine-700"
    >
      <BadgeCheck className="h-4 w-4" /> Verify your profile
      <span className="ml-1 text-xs text-charcoal-400">→</span>
    </button>
  );

  // interests come from the database now, so the count stays at zero until that
  // read is wired up rather than being faked in the browser
  const interestsReceived = 0;
  const interestsSent = 0;

  // New Matches mirrors the nav's My Matches item, which is premium-only
  // (dashboard-nav.tsx); every other tier does not see the card at all
  const showMatches = user?.plan === "premium";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-charcoal-900 sm:text-3xl">
            {greeting && `${greeting}, `}
            {firstName} <span className="inline-block">👋</span>
          </h1>
          <p className="mt-1 text-charcoal-500">Here&apos;s what&apos;s new in your search today.</p>
        </div>
        <Button href={browse(user?.gender).href} size="sm">
          <Sparkles className="h-4 w-4" /> Discover more
        </Button>
      </div>

      <div className="rounded-3xl border border-charcoal-100 bg-white p-6 shadow-card sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-charcoal-900">Profile {percent}% complete</h2>
            <p className="mt-1 text-sm text-charcoal-500">
              Complete profiles get up to 3x more responses.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Progress value={percent} className="w-40 sm:w-56" />
            <span className="text-sm font-semibold text-wine-700">{percent}%</span>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {completionTasks.map((task) => (
            <button
              key={task.label}
              onClick={() => toast("Update available from My Profile (coming soon)", "info")}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                task.done
                  ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                  : "border-charcoal-200 bg-white text-charcoal-700 hover:border-wine-300 hover:text-wine-700"
              )}
            >
              <task.icon className="h-4 w-4" />
              {task.label}
              <span className="ml-1 text-xs text-charcoal-400">{task.done ? "✓" : "→"}</span>
            </button>
          ))}
          {completionChip}
        </div>
      </div>

      <div className={cn("grid grid-cols-1 gap-4 min-[420px]:grid-cols-2", showMatches ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
        {showMatches && (
          <StatCard icon={<Sparkles className="h-5 w-5" />} label="New Matches" value={matchCount ?? 0} tone="wine" />
        )}
        <StatCard icon={<HeartHandshake className="h-5 w-5" />} label="Interests Received" value={interestsReceived} tone="gold" />
        <StatCard icon={<Send className="h-5 w-5" />} label="Interests Sent" value={interestsSent} />
      </div>
    </div>
  );
}

function LinkButton({ href, label }: { href: string; label: string }) {
  return (
    <Button href={href} variant="ghost" size="sm" className="text-wine-700">
      {label} <ArrowRight className="h-4 w-4" />
    </Button>
  );
}