"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Users, X } from "lucide-react";
import { profiles } from "@/features/profiles/data";
import { loadOwnProfile } from "@/features/profiles/queries";
import { useAuth } from "@/features/auth/auth-provider";
import { Button } from "@/components/ui/button";
import {
  BasicDetailsCard,
  EducationCareerCard,
  FamilyDetailsCard,
  LifestyleCard,
  OverviewCard,
  PartnerPreferenceCard,
  SectionCard,
} from "@/components/profile/profile-sections";
import { ProfileEditForm } from "./profile-edit-form";
import type { Profile } from "@/types";

export default function MyProfilePage() {
  const { user, isLoading } = useAuth();
  const [editing, setEditing] = useState(false);
  // the signed-in member's own row. the id travels with the result so a slow
  // response for a previous member can never be rendered for the current one.
  const [fetched, setFetched] = useState<{ id: string; profile?: Profile } | null>(null);

  const profileId = user?.profileId;

  // shared by the initial load and the editor's post-save refetch. returning the
  // row lets the editor sync its photo grid and draft without the read view
  // having to hand anything back down.
  const reload = useCallback(async (): Promise<Profile | undefined> => {
    if (!profileId) return undefined;
    const found = await loadOwnProfile(profileId);
    setFetched({ id: profileId, profile: found });
    return found;
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;

    void loadOwnProfile(profileId).then((found) => {
      if (!cancelled) setFetched({ id: profileId, profile: found });
    });

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  // the demo profile stands in for the demo account, which has no row of its own.
  // it must not stand in while the answer is still unknown: the session resolves
  // after the first paint, so falling back too early paints the demo member's
  // photo and name for a frame and then swaps in the real ones.
  const matched = fetched && fetched.id === profileId ? fetched.profile : undefined;
  const p = matched ?? profiles[0];

  if (isLoading || (profileId && !fetched)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-wine-700 border-t-transparent" />
      </div>
    );
  }

  // the editor is only offered for a real row: the demo profile is bundled seed
  // data with no row behind it, so a save would have nowhere to go
  if (editing && matched) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-charcoal-900 sm:text-3xl">
              Edit Profile
            </h1>
            <p className="mt-1 text-charcoal-500">
              Changes go live on the browse pages as soon as you save.
            </p>
          </div>
          <Button variant="outline" onClick={() => setEditing(false)}>
            <X className="h-4 w-4" /> Close
          </Button>
        </div>

        <ProfileEditForm
          profile={matched}
          reload={reload}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-charcoal-900 sm:text-3xl">
            My Profile
          </h1>
          <p className="mt-1 text-charcoal-500">
            Keep your details up to date — complete profiles get 3x more responses.
          </p>
        </div>
        <Button variant="outline" onClick={() => setEditing(true)} disabled={!matched}>
          <Pencil className="h-4 w-4" /> Edit Profile
        </Button>
      </div>

      <OverviewCard profile={p} />

      <div className="grid gap-6 lg:grid-cols-2">
        <BasicDetailsCard profile={p} />
        <EducationCareerCard profile={p} />
        <FamilyDetailsCard profile={p} />
        <LifestyleCard profile={p} />
      </div>

      <PartnerPreferenceCard profile={p} />

      <SectionCard title="My Verified Contact">
        <div className="flex items-start gap-3 text-sm text-charcoal-600">
          <Users className="mt-0.5 h-5 w-5 shrink-0 text-wine-600" />
          <p>
            Your contact details are visible only to Premium members you interact with.
            Upgrade to unlock other members&apos; contact numbers.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}