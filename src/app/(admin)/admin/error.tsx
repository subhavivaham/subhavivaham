"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/constants";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin panel error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
        <AlertTriangle className="h-7 w-7" />
      </span>
      <h1 className="mt-5 font-display text-2xl font-semibold text-charcoal-900">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-md text-sm text-charcoal-500">
        The admin panel hit an unexpected error while loading this section. Your saved data is
        safe in this browser. Try again, and contact {BRAND.name} support if it keeps failing.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-charcoal-300">Reference: {error.digest}</p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw className="h-4 w-4" /> Try again
        </Button>
        <Button href="/admin" variant="outline">
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
