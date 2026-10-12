import { cn } from "@/lib/utils";

export function CheckboxField({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2.5", className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[#7a1832]"
      />
      <span className="text-sm text-charcoal-700">{label}</span>
    </label>
  );
}