import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "wine" | "gold" | "success" | "neutral" | "outline" | "ivory";

const variantClasses: Record<BadgeVariant, string> = {
  wine: "bg-wine-50 text-wine-700 border-wine-100",
  gold: "bg-gold-50 text-gold-800 border-gold-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-100",
  neutral: "bg-charcoal-100 text-charcoal-700 border-charcoal-100",
  outline: "bg-white text-charcoal-700 border-charcoal-200",
  ivory: "bg-ivory-100 text-charcoal-700 border-ivory-200",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  icon?: ReactNode;
}

export function Badge({ variant = "neutral", icon, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}