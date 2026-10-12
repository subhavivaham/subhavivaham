import type { ReactNode } from "react";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = "center",
  light = false,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  action?: ReactNode;
  align?: "center" | "left";
  light?: boolean;
  className?: string;
}) {
  return (
    <Reveal
      className={cn(
        "mb-10 flex flex-col gap-4 sm:mb-12",
        align === "center"
          ? "items-center text-center"
          : "items-start text-left",
        className
      )}
    >
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
            <span className="h-px w-6 bg-gold-400" />
            {eyebrow}
            {align === "center" && <span className="h-px w-6 bg-gold-400" />}
          </p>
        )}
        <h2
          className={cn(
            "font-display text-2xl font-semibold tracking-tight sm:text-3xl",
            light ? "text-white" : "text-charcoal-900"
          )}
        >
          {title}
        </h2>
        {description && (
          <p
            className={cn(
              "mt-3 text-base leading-relaxed sm:text-lg",
              light ? "text-white/70" : "text-charcoal-500"
            )}
          >
            {description}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </Reveal>
  );
}