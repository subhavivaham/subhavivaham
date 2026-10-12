import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-charcoal-200 bg-white px-6 py-16 text-center",
        className
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-50 text-gold-600">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="font-display text-lg font-semibold text-charcoal-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-charcoal-500">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong.",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50/50 px-6 py-16 text-center">
      <h3 className="font-display text-lg font-semibold text-charcoal-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-charcoal-500">{description}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-6 h-10 rounded-xl bg-wine-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-wine-800"
        >
          Try again
        </button>
      )}
    </div>
  );
}