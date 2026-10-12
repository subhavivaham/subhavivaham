import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  icon,
  label,
  value,
  trend,
  tone = "wine",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  trend?: { label: string; up?: boolean };
  tone?: "wine" | "gold" | "success";
}) {
  return (
    <div className="rounded-2xl border border-charcoal-100 bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover">
      <div
        className={cn(
          "mb-4 flex h-11 w-11 items-center justify-center rounded-xl",
          tone === "wine" && "bg-wine-50 text-wine-700",
          tone === "gold" && "bg-gold-50 text-gold-700",
          tone === "success" && "bg-emerald-50 text-emerald-700"
        )}
      >
        {icon}
      </div>
      <p className="text-2xl font-semibold tracking-tight text-charcoal-900">{value}</p>
      <p className="mt-1 text-sm text-charcoal-500">{label}</p>
      {trend && (
        <p
          className={cn(
            "mt-2 text-xs font-medium",
            trend.up ? "text-emerald-600" : "text-charcoal-400"
          )}
        >
          {trend.label}
        </p>
      )}
    </div>
  );
}