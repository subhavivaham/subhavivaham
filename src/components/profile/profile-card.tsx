import Image from "next/image";
import { BadgeCheck, MapPin, GraduationCap, Ruler, Briefcase } from "lucide-react";
import type { Profile } from "@/types";
import { cn } from "@/lib/utils";
import { ProfileGateLink } from "@/components/profile/profile-gate-link";

export function ProfileCard({
  profile,
  className,
}: {
  profile: Profile;
  className?: string;
}) {
  const primary = profile.photos.find((p) => p.isPrimary) ?? profile.photos[0];
  const showMatch = typeof profile.matchPercentage === "number";

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-2xl border border-charcoal-100 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover",
        className
      )}
    >
      <ProfileGateLink
        href={`/profile/${profile.id}`}
        className="relative block aspect-[4/5] overflow-hidden bg-charcoal-100 sm:aspect-[5/6]"
      >
        {primary && (
          <Image
            src={primary.url}
            alt={profile.fullName}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-charcoal-950/70 to-transparent sm:h-28" />

        {false && (
          <span className="absolute left-3 top-3 hidden rounded-full bg-gold-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm sm:px-2.5 sm:py-1 sm:text-xs">
            {profile.matchPercentage}% Match
          </span>
        )}
        {profile.verified && (
          <span
            className={cn(
              "absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-wine-700 shadow-sm sm:px-2.5 sm:py-1 sm:text-[11px]"
            )}
          >
            <BadgeCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Verified
          </span>
        )}

        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="truncate font-display text-lg font-semibold text-white">
            {profile.firstName}, {profile.age}
          </h3>
          <p className="flex items-center gap-1 text-sm text-white/90">
            <MapPin className="h-3.5 w-3.5 shrink-0" />{" "}
            <span className="truncate">
              {profile.city}, {profile.state}
            </span>
          </p>
        </div>
      </ProfileGateLink>

      <div className="space-y-2 p-3.5 sm:p-4">
        <p className="truncate flex items-center gap-1.5 text-sm font-medium text-charcoal-800">
          <Briefcase className="h-4 w-4 shrink-0 text-wine-600" /> {profile.profession}
        </p>
        <div className="hidden items-center gap-x-4 text-xs text-charcoal-500 sm:flex">
          <span className="flex min-w-0 flex-1 items-center gap-1">
            <GraduationCap className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{profile.education}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Ruler className="h-3.5 w-3.5 shrink-0" /> {profile.heightText}
          </span>
        </div>
        <p className="truncate text-xs font-medium text-charcoal-600">
          {profile.religion} • {profile.community}
        </p>
        <p className="hidden text-sm leading-relaxed text-charcoal-500 sm:block">
          <span className="line-clamp-4">&ldquo;{profile.about}&rdquo;</span>
        </p>

        <div className="flex gap-2 pt-1">
          <ProfileGateLink
            href={`/profile/${profile.id}`}
            className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-charcoal-200 bg-white text-xs font-semibold text-charcoal-700 transition-colors hover:border-wine-300 hover:text-wine-700 sm:h-10 sm:text-sm"
          >
            View Profile
          </ProfileGateLink>
        </div>
      </div>
    </article>
  );
}

export function ProfileGrid({
  profiles,
  className,
}: {
  profiles: Profile[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 min-[380px]:grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4",
        className
      )}
    >
      {profiles.map((p) => (
        <ProfileCard key={p.id} profile={p} />
      ))}
    </div>
  );
}