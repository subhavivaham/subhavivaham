import Link from "next/link";
import { ArrowRight, Landmark, MapPin, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/states";
import type { Temple } from "@/features/temples/types";

export function TemplesDirectory({ temples }: { temples: Temple[] }) {
  if (temples.length === 0) {
    return (
      <EmptyState
        icon={Landmark}
        title="No temples listed yet"
        description="Temples verified from the admin will appear here."
      />
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {temples.map((temple) => {
        const place = [temple.city, temple.state].filter(Boolean).join(", ");

        return (
          <article
            key={temple.id}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-gold-200 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-gold-300 hover:shadow-card-hover"
          >
            {/* ---------------------------------------------------------- body */}
            <div className="flex flex-1 flex-col p-6">
              {/* the title carries the link and its ::after stretches over the
                  whole card, so every part of the surface is clickable. the
                  footer below is a plain span rather than a second link, so
                  there is no nested interactive element and no doubled tab
                  stop for one destination */}
              <h3 className="font-display text-lg font-semibold leading-snug text-charcoal-900">
                <Link
                  href={`/temples/${temple.id}`}
                  className="after:absolute after:inset-0 after:content-[''] group-hover:text-wine-700"
                >
                  {temple.name}
                </Link>
              </h3>

              {temple.deity && (
                <p className="mt-1.5 text-sm font-medium leading-snug text-gold-700">
                  {temple.deity}
                </p>
              )}

              {place && (
                <p className="mt-2.5 flex items-center gap-2 text-sm text-charcoal-600">
                  <MapPin className="h-4 w-4 shrink-0 text-gold-700" />
                  <span className="truncate">{place}</span>
                </p>
              )}

              {/* clamped here because the detail page carries the full text.
                  line-clamp-5 displays exactly 5 lines of text with ellipsis */}
              {temple.history && (
                <p className="mt-4 line-clamp-5 max-h-[calc(5.5*1.5rem)] overflow-hidden rounded-lg border border-charcoal-100 bg-charcoal-50/80 p-4 text-sm leading-relaxed text-charcoal-600">
                  {temple.history}
                </p>
              )}

              {/* a hint, not a count: the number of services is on the page the
                  button leads to */}
              {temple.services.length > 0 && (
                <p className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Services &amp; pricing listed
                </p>
              )}
            </div>

            {/* --------------------------------------------------------- foot */}
            {/* mt-auto pins this to the bottom so every card in the grid ends at
                the same height however long the copy above it is */}
            <div className="mt-auto border-t border-charcoal-100 p-4">
              <span className="flex w-full items-center justify-center gap-2 rounded-xl border border-charcoal-200 px-4 py-3 text-sm font-semibold text-charcoal-800 transition-colors group-hover:border-wine-300 group-hover:bg-wine-50 group-hover:text-wine-700">
                View details
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
