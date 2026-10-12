"use client";

import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  error?: string;
  hint?: string;
}

const control =
  "h-11 w-full rounded-xl border bg-white py-2 pl-3.5 pr-11 text-sm text-charcoal-900 shadow-sm transition-colors placeholder:text-charcoal-400 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-charcoal-50";

/**
 * A password field with a reveal toggle.
 *
 * The control is a <button> rather than a checkbox so the icon alone carries the
 * affordance, and type="button" keeps it from submitting the form it sits in.
 * sr-only text names the action, since the two icons are indistinguishable
 * otherwise without it.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ label, error, hint, className, id, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    const autoId = useId();
    const inputId = id ?? autoId;

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-charcoal-800">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            id={inputId}
            ref={ref}
            type={visible ? "text" : "password"}
            aria-invalid={Boolean(error)}
            className={cn(
              control,
              error
                ? "border-wine-300 focus:border-wine-500 focus:ring-wine-100"
                : "border-charcoal-200 focus:border-wine-400 focus:ring-wine-100",
              className
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-lg text-charcoal-400 transition-colors hover:bg-charcoal-100 hover:text-charcoal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-wine-400"
          >
            {visible ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="sr-only">{visible ? "Hide password" : "Show password"}</span>
          </button>
        </div>
        {hint && !error && <p className="text-xs text-charcoal-400">{hint}</p>}
        {error && <p className="text-xs font-medium text-wine-600">{error}</p>}
      </div>
    );
  }
);
