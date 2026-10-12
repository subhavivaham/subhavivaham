"use client";

import { useState, type ReactNode } from "react";
import { Plus, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-charcoal-900 sm:text-3xl">
          {title}
        </h1>
        <p className="mt-1 text-sm text-charcoal-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function FilterTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { key: T; label: string; count?: number }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
            value === opt.key
              ? "bg-wine-700 text-white shadow-sm"
              : "bg-white text-charcoal-600 ring-1 ring-charcoal-200 hover:bg-charcoal-100"
          )}
        >
          {opt.label}
          {opt.count !== undefined && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                value === opt.key ? "bg-white/20 text-white" : "bg-charcoal-100 text-charcoal-500"
              )}
            >
              {opt.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-400" />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-charcoal-200 bg-white pl-9 pr-9 text-sm text-charcoal-900 shadow-sm transition-colors placeholder:text-charcoal-400 focus:border-wine-400 focus:outline-none focus:ring-2 focus:ring-wine-100"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-charcoal-400 hover:bg-charcoal-100 hover:text-charcoal-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>;
}

export function ToolbarSelect({
  label,
  value,
  onChange,
  children,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Select
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn("min-w-[160px]", className)}
    >
      {children}
    </Select>
  );
}

export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button onClick={onClick} size="sm">
      <Plus className="h-4 w-4" /> {children}
    </Button>
  );
}

export function useConfirm() {
  const [target, setTarget] = useState<{
    title: string;
    description?: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  return { target, setTarget };
}

// page numbers around the current one, with 0 standing in for the gaps. only a
// window is ever built, so a list of 5000 rows does not render 5000 buttons
const pageWindow = (current: number, total: number): (number | 0)[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | 0)[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) out.push(0);
    out.push(page);
    previous = page;
  }
  return out;
};

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  // nothing to page through: one page, or nothing at all
  if (pageCount <= 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-charcoal-400">
        Showing <span className="font-semibold text-charcoal-600">{first}</span>–
        <span className="font-semibold text-charcoal-600">{last}</span> of{" "}
        <span className="font-semibold text-charcoal-600">{total}</span>
      </p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-charcoal-200 bg-white text-charcoal-600 transition-colors hover:border-wine-300 hover:text-wine-700 disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pageWindow(page, pageCount).map((entry, index) =>
          entry === 0 ? (
            <span key={`gap-${index}`} className="px-1 text-sm text-charcoal-400">
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onPage(entry)}
              aria-current={entry === page ? "page" : undefined}
              className={cn(
                "h-9 min-w-9 rounded-lg px-2.5 text-sm font-semibold transition-colors",
                entry === page
                  ? "bg-wine-700 text-white shadow-sm"
                  : "border border-charcoal-200 bg-white text-charcoal-600 hover:border-wine-300 hover:text-wine-700"
              )}
            >
              {entry}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-charcoal-200 bg-white text-charcoal-600 transition-colors hover:border-wine-300 hover:text-wine-700 disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
