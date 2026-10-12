"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserRound,
  Sparkles,
  HeartHandshake,
  // Crown,
  Venus,
  Mars,
  VenusAndMars,
  LogOut,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/utils";

// a groom looks for a bride and a bride looks for a groom, so this one item
// resolves its label, destination and icon from whoever is signed in. only one
// side is ever offered. gender is null until the profile row is readable, and
// the unfiltered search page stands in until then rather than guessing. short is
// the bottom bar's label, which has no room for "Brides / Grooms", and the icon
// is the side's own mark rather than the paired one, so the tab says which list
// it opens before it is read.
export const browse = (gender: "male" | "female" | null | undefined) => {
  if (gender === "male") return { label: "Brides", href: "/brides", short: "Brides", icon: Venus };
  if (gender === "female") return { label: "Grooms", href: "/grooms", short: "Grooms", icon: Mars };
  return { label: "Brides / Grooms", href: "/search", short: "Browse", icon: VenusAndMars };
};

const items = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Matches", href: "/matches", icon: Sparkles },
  { label: "Interests", href: "/interests", icon: HeartHandshake },
  // { label: "Membership", href: "/membership", icon: Crown },
  { label: "My Profile", href: "/dashboard/profile", icon: UserRound },
];

// the member nav floats across the top rather than sitting down the side. a
// sidebar pushed the content right and capped it, so every page below the fold
// needed scrolling to reach; a detached bar keeps the full width for the
// profile grids and trades the column's height for the bar's own.
export function TopNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const target = browse(user?.gender);

  // My Matches is premium-only: hidden from the bar for every other tier.
  // the /matches route itself keeps its server-side upgrade wall, so a typed
  // URL still cannot show the list to a non-premium member.
  const [first, second, ...rest] = items;
  const nav = [
    first,
    ...(user?.plan === "premium" ? [second] : []),
    { label: target.label, href: target.href, icon: VenusAndMars },
    ...rest,
  ];

  return (
    // the outer element owns the sticky offset and the gutter, so the bar
    // inside can float free of the page edges and let content scroll past it
    <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3 rounded-3xl border border-charcoal-100 bg-white/90 px-4 py-2 shadow-card backdrop-blur">
        <Logo size="sm" className="shrink-0" />

        <nav
          aria-label="Dashboard"
          className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex"
        >
          {nav.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-2xl px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-wine-700 text-white shadow-sm"
                    : "text-charcoal-600 hover:bg-charcoal-100 hover:text-charcoal-900"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {user && (
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  // the same side-aware browse item the top bar splices in, so a member reaches
  // the side they are looking for from the bar they are already holding
  const target = browse(user?.gender);
  const showMatches = user?.plan === "premium";
  const items = [
    { label: "Home", href: "/dashboard", icon: LayoutDashboard },
    // premium-only, same rule as the top bar
    ...(showMatches ? [{ label: "Matches", href: "/matches", icon: Sparkles }] : []),
    { label: "Interests", href: "/interests", icon: HeartHandshake },
    { label: target.short, href: target.href, icon: target.icon },
    { label: "Profile", href: "/dashboard/profile", icon: UserRound },
  ];
  return (
    <nav
      aria-label="Mobile dashboard"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-charcoal-100 bg-white/95 backdrop-blur lg:hidden"
    >
      <div className={cn(showMatches ? "grid grid-cols-5" : "grid grid-cols-4")}>
        {items.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                active ? "text-wine-700" : "text-charcoal-500"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                  active && "bg-wine-50"
                )}
              >
                <item.icon className="h-5 w-5" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}