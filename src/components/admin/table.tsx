import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    // min-w-0 because these cards sit in grid columns, and a grid item defaults to
    // min-width:auto — so one wide child (a table with a min-width, a long
    // unbreakable name) is enough to stretch the card past its column and push a
    // horizontal scrollbar onto the whole admin page.
    <section className={cn("min-w-0 rounded-2xl border border-charcoal-100 bg-white shadow-card", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-charcoal-50 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-charcoal-900">{title}</h2>
          {action}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead>
          <tr className="border-b border-charcoal-100">
            {head.map((h) => (
              <th key={h} className="px-3 py-3 font-semibold text-charcoal-500 first:pl-0 last:pr-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-charcoal-50">{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn("hover:bg-charcoal-50/50", className)}>{children}</tr>;
}

export function Cell({ className, colSpan, children }: { className?: string; colSpan?: number; children: ReactNode }) {
  return (
    <td colSpan={colSpan} className={cn("px-3 py-3 first:pl-0 last:pr-0 align-middle", className)}>
      {children}
    </td>
  );
}

export function Pill({ tone = "neutral", children }: { tone?: "good" | "warn" | "bad" | "neutral"; children: ReactNode }) {
  const tones = {
    good: "bg-emerald-50 text-emerald-700",
    warn: "bg-gold-50 text-gold-700",
    bad: "bg-red-50 text-red-600",
    neutral: "bg-charcoal-100 text-charcoal-600",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone])}>
      {children}
    </span>
  );
}