import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

function FieldShell({
  label,
  error,
  hint,
  children,
}: {
  label?: ReactNode;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-charcoal-800">{label}</label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-charcoal-400">{hint}</p>}
      {error && <p className="text-xs font-medium text-wine-600">{error}</p>}
    </div>
  );
}

const baseControl =
  "w-full rounded-xl border border-charcoal-200 bg-white px-3.5 text-sm text-charcoal-900 placeholder:text-charcoal-400 shadow-sm transition-colors focus:outline-none focus:border-wine-400 focus:ring-2 focus:ring-wine-100 disabled:cursor-not-allowed disabled:bg-charcoal-50";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, hint, className, id, ...props }, ref) {
    const autoId = useId();
    const inputId = id ?? autoId;
    return (
      <FieldShell label={label} error={error} hint={hint}>
        <input
          id={inputId}
          ref={ref}
          aria-invalid={Boolean(error)}
          className={cn(baseControl, "h-11", error && "border-wine-300 focus:border-wine-500 focus:ring-wine-100", className)}
          {...props}
        />
      </FieldShell>
    );
  }
);

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ label, error, hint, className, id, children, ...props }, ref) {
    const autoId = useId();
    const selectId = id ?? autoId;
    return (
      <FieldShell label={label} error={error} hint={hint}>
        <select
          id={selectId}
          ref={ref}
          aria-invalid={Boolean(error)}
          className={cn(baseControl, "h-11 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23685f58%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_0.75rem_center] bg-no-repeat pr-10", error && "border-wine-300", className)}
          {...props}
        >
          {children}
        </select>
      </FieldShell>
    );
  }
);

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, error, hint, className, id, ...props }, ref) {
    const autoId = useId();
    const textareaId = id ?? autoId;
    return (
      <FieldShell label={label} error={error} hint={hint}>
        <textarea
          id={textareaId}
          ref={ref}
          aria-invalid={Boolean(error)}
          className={cn(baseControl, "min-h-[110px] py-3", error && "border-wine-300", className)}
          {...props}
        />
      </FieldShell>
    );
  }
);

export interface CheckboxGroupProps {
  label?: ReactNode;
  error?: string;
  hint?: string;
  options: readonly string[];
  values: readonly string[];
  onToggle: (value: string) => void;
  /** classes for the option grid, so wide pickers can use more columns */
  gridClassName?: string;
}

export function CheckboxGroup({
  label,
  error,
  hint,
  options,
  values,
  onToggle,
  gridClassName = "sm:grid-cols-2 lg:grid-cols-3",
}: CheckboxGroupProps) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      <div className={cn("grid gap-2", gridClassName)}>
        {options.map((option) => {
          const checked = values.includes(option);
          return (
            <label
              key={option}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors",
                checked
                  ? "border-wine-400 bg-wine-50"
                  : "border-charcoal-200 bg-white hover:border-wine-300"
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(option)}
                className="h-4 w-4 accent-[#7a1832]"
              />
              <span className="text-sm text-charcoal-700">{option}</span>
            </label>
          );
        })}
      </div>
    </FieldShell>
  );
}
