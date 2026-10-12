"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { PUBLIC_NAV, CONTAINER } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-all duration-300",
        scrolled
          ? "border-charcoal-100 bg-white/95 shadow-sm backdrop-blur-md"
          : "border-transparent bg-white/90 backdrop-blur-sm"
      )}
    >
      <div className={cn(CONTAINER, "flex h-16 items-center justify-between gap-4 sm:h-20")}>
        <Logo />

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {PUBLIC_NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-wine-700 bg-wine-50"
                    : "text-charcoal-600 hover:text-wine-700 hover:bg-charcoal-100/60"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Button href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
            Login
          </Button>
          <Button href="/register" size="sm">
            Register
          </Button>

          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            className="rounded-lg p-2 text-charcoal-700 transition-colors hover:bg-charcoal-100 lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-charcoal-100 bg-white lg:hidden animate-fade-in">
          <nav aria-label="Mobile" className={cn(CONTAINER, "flex flex-col gap-1 py-4")}>
            {PUBLIC_NAV.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-xl px-4 py-3 text-base font-medium",
                    active
                      ? "bg-wine-50 text-wine-700"
                      : "text-charcoal-700 hover:bg-charcoal-100"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="flex gap-3 pt-3">
              <Button href="/login" variant="outline" fullWidth onClick={() => setOpen(false)}>
                Login
              </Button>
              <Button href="/register" fullWidth onClick={() => setOpen(false)}>
                Register
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}