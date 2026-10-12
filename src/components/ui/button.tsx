"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "gold" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  href?: string;
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-wine-700 text-white hover:bg-wine-800 focus-visible:ring-wine-300 shadow-sm",
  gold: "bg-gold-500 text-white hover:bg-gold-600 focus-visible:ring-gold-300 shadow-sm",
  secondary:
    "bg-charcoal-900 text-white hover:bg-charcoal-700 focus-visible:ring-charcoal-300 shadow-sm",
  outline:
    "border border-charcoal-200 bg-white text-charcoal-800 hover:border-wine-300 hover:text-wine-700 hover:bg-wine-50 focus-visible:ring-wine-200",
  ghost:
    "text-charcoal-700 hover:bg-charcoal-100 hover:text-charcoal-900 focus-visible:ring-charcoal-300",
  danger:
    "bg-wine-600 text-white hover:bg-wine-700 focus-visible:ring-wine-300 shadow-sm",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-lg gap-1.5",
  md: "h-11 px-5 text-sm rounded-xl gap-2",
  lg: "h-12 px-7 text-base rounded-xl gap-2",
  icon: "h-10 w-10 rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  href,
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  onClick,
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex cursor-pointer items-center justify-center font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 active:scale-[0.98] disabled:pointer-events-none disabled:cursor-default disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:cursor-default aria-disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && "w-full",
    className
  );

  if (href) {
    const isDisabled = disabled || loading;
    return (
      <Link
        href={isDisabled ? "#" : href}
        aria-disabled={isDisabled}
        className={classes}
        onClick={(event) => {
          if (isDisabled) {
            event.preventDefault();
            return;
          }
          onClick?.(event as unknown as MouseEvent<HTMLButtonElement>);
        }}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} disabled={disabled || loading} onClick={onClick} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}