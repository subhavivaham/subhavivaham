import type { Metadata } from "next";
import { Home, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTAINER } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "பக்கம் கிடைக்கவில்லை — Page Not Found | Subha Vivaham",
  description:
    "The page you are looking for could not be found. Explore profiles, communities and temples on Subha Vivaham Matrimony.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className={cn(CONTAINER, "flex flex-1 flex-col items-center justify-center py-20 text-center sm:py-28")}>
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-wine-50 text-wine-700">
        <SearchX className="h-8 w-8" />
      </span>

      <p className="mt-6 font-display text-6xl font-semibold tracking-tight text-wine-700 sm:text-7xl">
        404
      </p>

      <p className="mt-2 max-w-xl text-base text-charcoal-500">
        The page you are looking for is not available.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button href="/" size="lg">
          <Home className="h-4 w-4" />
          Back to home
        </Button>
      </div>
    </main>
  );
}
