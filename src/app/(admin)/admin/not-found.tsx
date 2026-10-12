import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-charcoal-100 text-charcoal-600">
        <SearchX className="h-7 w-7" />
      </span>
      <h1 className="mt-5 font-display text-2xl font-semibold text-charcoal-900">
        Admin page not found
      </h1>
      <p className="mt-2 max-w-md text-sm text-charcoal-500">
        The page you requested does not exist in the admin panel. Use the sidebar to find what you
        need.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button href="/admin">Go to dashboard</Button>
        <Link
          href="/admin/profiles"
          className="inline-flex items-center rounded-xl border border-charcoal-200 px-4 py-2 text-sm font-semibold text-charcoal-700 transition-colors hover:bg-charcoal-50"
        >
          Browse profiles
        </Link>
      </div>
    </div>
  );
}
