import { cn } from "@/lib/utils";

export function Progress({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-charcoal-100", className)}
    >
      <div
        className={cn("h-full rounded-full bg-wine-600 transition-all duration-500", barClassName)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { label: string; value: T }[];
  active: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-charcoal-100 bg-white p-1 shadow-sm",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              isActive
                ? "bg-wine-700 text-white shadow-sm"
                : "text-charcoal-600 hover:bg-charcoal-100 hover:text-charcoal-900"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}