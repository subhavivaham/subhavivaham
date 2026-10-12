"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MobileTabBar, TopNav } from "@/components/layout/dashboard-nav";
import { cn } from "@/lib/utils";

// the dashboard carries a three card stat row, a four up match grid and a
// sidebar panel, and the browse pages run a dense filter bar above a multi
// column profile grid. both waste most of a desktop screen under a reading
// width cap, so both drop it. matches and profile follow the same rule: each is
// a grid or a wide form that reads better edge to edge. no member route keeps
// max-w-7xl now.
const FULL_WIDTH_ROUTES = new Set([
  "/dashboard",
  "/brides",
  "/grooms",
  "/matches",
  "/search",
  "/dashboard/profile",
]);

// /profile/[id] is matched by prefix, because its id is only known at runtime -
// My Profile and a profile you are reading have to be the same width, and they
// are the same page underneath.
const isFullWidth = (pathname: string) =>
  FULL_WIDTH_ROUTES.has(pathname) || pathname.startsWith("/profile/");

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const fullWidth = isFullWidth(pathname);

  return (
    <div className="flex w-full flex-1 flex-col">
      <TopNav />

      <div
        className={cn(
          "mx-auto w-full flex-1 px-4 pb-24 pt-3 sm:px-6 lg:px-8 lg:pb-10 lg:pt-4",
          !fullWidth && "max-w-7xl"
        )}
      >
        <main className="min-h-[60vh]">{children}</main>
      </div>

      <MobileTabBar />
    </div>
  );
}