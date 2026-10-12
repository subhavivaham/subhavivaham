"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Contact,
  UsersRound,
  Crown,
  Store,
  Inbox,
  Landmark,
  Settings,
  LogOut,
  ExternalLink,
  Menu,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ADMIN_NAV, BRAND } from "@/lib/constants";
import { adminSignOut } from "@/app/(admin)/admin/auth-actions";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  users: Users,
  contact: Contact,
  "users-round": UsersRound,
  crown: Crown,
  store: Store,
  inbox: Inbox,
  landmark: Landmark,
  settings: Settings,
};

export function AdminShell({
  children,
  adminName,
  adminEmail,
}: {
  children: ReactNode;
  adminName: string;
  adminEmail: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signingOut, startSignOut] = useTransition();

  const nav = ADMIN_NAV.map((item) => ({
    ...item,
    icon: ICONS[item.icon] ?? LayoutDashboard,
  }));

  const active = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const items = nav.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={() => setOpen(false)}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors",
        active(item.href)
          ? "bg-wine-700 text-white shadow-sm"
          : "text-charcoal-600 hover:bg-charcoal-100 hover:text-charcoal-900"
      )}
    >
      <item.icon className="h-[18px] w-[18px]" />
      {item.label}
    </Link>
  ));

  // clears the real Supabase session cookie, then the server action redirects
  const signOut = () => startSignOut(() => void adminSignOut());

  const displayName = adminName || adminEmail || BRAND.name;

  const activeLabel = nav.find((item) => active(item.href))?.label ?? "Dashboard";

  const navBlock = (
    <>
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-charcoal-100 px-5">
        <Logo />
      </div>
      <nav aria-label="Admin" className="flex-1 space-y-1 overflow-y-auto p-3">
        {items}
      </nav>
      <div className="shrink-0 border-t border-charcoal-100 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-charcoal-50 p-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wine-700 text-sm font-bold uppercase text-white">
            {displayName.trim().charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-charcoal-800">{displayName}</p>
            <p className="truncate text-xs text-charcoal-400">{adminEmail}</p>
          </div>
        </div>
        <div className="mt-2 space-y-2">
          <Button href="/" variant="outline" size="sm" fullWidth>
            <ExternalLink className="h-4 w-4" /> View site
          </Button>
          <Button variant="danger" size="sm" fullWidth loading={signingOut} onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-charcoal-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-charcoal-100 bg-white lg:flex">
        {navBlock}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-charcoal-950/50"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl animate-slide-in-right">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 rounded-lg p-2 text-charcoal-700 transition-colors hover:bg-charcoal-100"
            >
              <X className="h-5 w-5" />
            </button>
            {navBlock}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-charcoal-100 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="shrink-0 rounded-lg p-2 text-charcoal-700 transition-colors hover:bg-charcoal-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center text-sm">
              <span
                key={pathname}
                className="truncate rounded-lg bg-charcoal-100 px-2.5 py-1 font-semibold text-charcoal-800 animate-fade-in"
              >
                {activeLabel}
              </span>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button href="/" variant="ghost" size="sm" className="hidden md:inline-flex">
              <ExternalLink className="h-4 w-4" /> View site
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={signingOut}
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </header>

        <main className="w-full p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}