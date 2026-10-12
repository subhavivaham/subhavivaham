"use client";

import { useEffect, useState } from "react";
import { Heart, Mail, Phone, Users } from "lucide-react";
import type { Profile } from "@/types";
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
import { PhotoGallery } from "@/components/profile/photo-gallery";
import { useToast } from "@/lib/state/toast-provider";
import { getInterestQuota, sendInterest, type InterestQuota } from "@/app/(app)/profile/actions";

// deliberately the same layout as /dashboard/profile: the same section cards,
// the same overview block and the same two column grid. only the parts that
// genuinely belong to someone else's profile differ - the send-interest action,
// the photo strip, and the partner preferences.
export function ProfileDetailView({
  profile,
  contact,
}: {
  profile: Profile;
  // present only for premium viewers (resolved server-side); null renders the
  // upgrade prompt instead, so contact details never reach other tiers.
  contact?: { phone: string; email: string } | null;
}) {
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const [quota, setQuota] = useState<InterestQuota | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getInterestQuota().then((q) => {
      if (!cancelled) setQuota(q);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSendInterest = async () => {
    setSending(true);
    try {
      const result = await sendInterest(profile.id);
      if (result.ok) {
        toast(result.message, "success");
        // the send is one step closer to the limit, so the count ahead of the
        // next click is refreshed rather than guessed
        const fresh = await getInterestQuota();
        setQuota(fresh);
      } else {
        toast(result.error, "error");
        // the server refused for a quota reason (or the member hit it between
        // the read and the click), so reflect that without another round trip
        const fresh = await getInterestQuota();
        setQuota(fresh);
      }
    } catch {
      toast("Failed to send interest. Please try again.", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-charcoal-900 sm:text-3xl">
            {profile.fullName}&apos;s Profile
          </h1>
          <p className="mt-1 text-charcoal-500">
            {[profile.profession, profile.city && `in ${profile.city}`, profile.religion]
              .filter(Boolean)
              .join(" · ")}
            {profile.age ? ` · ${profile.age} years` : ""}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <Button onClick={handleSendInterest} loading={sending}>
            <Heart className="h-4 w-4" /> Send Interest
          </Button>
          {quota !== null && quota.limit !== null && quota.remaining !== null && (
            <p className="text-right text-xs text-charcoal-400">
              {quota.remaining > 0 ? (
                <>
                  {quota.used} of {quota.limit} monthly interests used —{" "}
                  {quota.remaining} remain
                </>
              ) : (
                <span className="font-medium text-wine-700">
                  Monthly interest limit reached.{" "}
                  <a href="/membership" className="underline hover:text-wine-800">
                    Upgrade
                  </a>
                  .
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      <OverviewCard profile={profile} />

      <div className="grid gap-6 lg:grid-cols-2">
        <BasicDetailsCard profile={profile} />
        <EducationCareerCard profile={profile} />
        <FamilyDetailsCard profile={profile} />
        <LifestyleCard profile={profile} />
      </div>

      <PartnerPreferenceCard profile={profile} />

      {profile.photos.length > 1 && (
        <SectionCard title="Photos">
          <PhotoGallery photos={profile.photos} name={profile.fullName} />
        </SectionCard>
      )}

      <SectionCard title="Contact Details">
        {contact && (contact.phone || contact.email) ? (
          <ul className="space-y-3 text-sm">
            {contact.phone && (
              <li className="flex items-center gap-2.5 text-charcoal-700">
                <Phone className="h-4 w-4 shrink-0 text-wine-600" />
                <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`} className="font-medium hover:text-wine-700 hover:underline">
                  {contact.phone}
                </a>
              </li>
            )}
            {contact.email && (
              <li className="flex items-center gap-2.5 text-charcoal-700">
                <Mail className="h-4 w-4 shrink-0 text-wine-600" />
                <a href={`mailto:${contact.email}`} className="font-medium hover:text-wine-700 hover:underline">
                  {contact.email}
                </a>
              </li>
            )}
          </ul>
        ) : (
          <div className="flex items-start gap-3 text-sm text-charcoal-600">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-wine-600" />
            <p>
              {profile.firstName}&apos;s contact details are visible only to Premium members.{" "}
              <a href="/membership" className="font-semibold text-wine-700 hover:underline">
                Upgrade to unlock them
              </a>
              .
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
