"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import type { Profile } from "@/types";
import { cn } from "@/lib/utils";

export function ViewProfileButton({
  profile,
  className,
}: {
  profile: Profile;
  className?: string;
}) {
  return (
    <Link
      href={`/profile/${profile.id}`}
      className={cn(
        "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-charcoal-200 bg-white px-4 text-sm font-semibold text-charcoal-700 transition-all hover:border-wine-300 hover:text-wine-700 active:scale-[0.98]",
        className
      )}
    >
      <Eye className="h-4 w-4" /> View Profile
    </Link>
  );
}