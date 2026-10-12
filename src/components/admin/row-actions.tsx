"use client";

import type { ReactNode } from "react";

export function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-1">{children}</div>;
}

export function IconAction({
  label,
  onClick,
  tone = "default",
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  tone?: "default" | "good" | "warn" | "bad";
  children: ReactNode;
  disabled?: boolean;
}) {
  const tones = {
    default: "text-charcoal-400 hover:bg-charcoal-100 hover:text-charcoal-800",
    good: "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700",
    warn: "text-gold-600 hover:bg-gold-50 hover:text-gold-700",
    bad: "text-charcoal-400 hover:bg-red-50 hover:text-red-600",
  } as const;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}
