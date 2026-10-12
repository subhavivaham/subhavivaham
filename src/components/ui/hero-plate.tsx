import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The dark title plate every hero on the site sits on: the wine ground, the two
 * radial washes, the fine pinstripe and the gold hairline along the top edge.
 * It is shared rather than repeated so the three dark heroes cannot drift apart
 * as the palette is tuned.
 */
export function HeroPlate({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("relative isolate overflow-hidden bg-wine-950", className)}>
      {/* a gold hairline along the very top, the way a title plate is ruled */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent"
      />

      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(212,175,55,0.16),transparent_52%),radial-gradient(ellipse_at_bottom_right,rgba(122,24,50,0.75),transparent_60%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.18] [background-image:repeating-linear-gradient(90deg,rgba(255,255,255,0.08)_0px,rgba(255,255,255,0.08)_1px,transparent_1px,transparent_7px)]"
      />

      {children}
    </section>
  );
}

/**
 * A hairline rule with a diamond at its centre, used as a divider under a hero
 * headline so the block reads as a title plate rather than a stack of text. The
 * tone is fixed to gold because every dark hero in the brand uses it.
 */
export function Rule() {
  return (
    <span aria-hidden className="flex w-full items-center gap-3 text-gold-500/70">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold-500/50" />
      <span className="h-1.5 w-1.5 rotate-45 border border-gold-500/70" />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold-500/50" />
    </span>
  );
}
