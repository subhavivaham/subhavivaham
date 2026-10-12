"use client";

// the members-area wall, kept for mock mode only.
//
// with a backend configured the (app) layout redirects to /login instead,
// because a client-side check is not a boundary: the markup and whatever data
// sits behind it are already in the response before any javascript runs. in
// mock mode there are no sessions to check, so this is the whole gate.
import type { ReactNode } from "react";
import { KeyRound, LogIn, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";

export function MembersSignInWall({ children }: { children: ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-wine-700 border-t-transparent" />
      </div>
    );
  }

  if (isLoggedIn) return <>{children}</>;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-charcoal-100 bg-white p-8 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-wine-50 text-wine-700">
          <KeyRound className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-charcoal-900">Members area</h1>
        <p className="mt-2 text-sm text-charcoal-500">
          Sign in to explore the full matrimony experience.
        </p>
        <div className="mt-6 space-y-3">
          <Button href="/login" fullWidth size="lg">
            <LogIn className="h-4 w-4" /> Sign in
          </Button>
          <Button href="/" variant="outline" fullWidth size="lg">
            <Home className="h-4 w-4" /> Back to home
          </Button>
        </div>
      </div>
    </div>
  );
}
