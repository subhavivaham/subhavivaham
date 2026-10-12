import Image from "next/image";
import { UserRound } from "lucide-react";
import { cn, initials } from "@/lib/utils";

export interface AvatarProps {
  src?: string;
  name: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  alt?: string;
  /**
   * What to draw when there is no photo. Initials suit a named person; the
   * plain person icon suits a listing where the name is already written beside
   * it and repeating its letters only adds noise.
   */
  fallback?: "initials" | "icon";
}

const sizes = {
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-base",
  xl: "h-24 w-24 text-xl",
  "2xl": "h-32 w-32 text-2xl",
};

export function Avatar({
  src,
  name,
  size = "md",
  className,
  alt,
  fallback = "initials",
}: AvatarProps) {
  const classes = cn(
    "relative shrink-0 overflow-hidden rounded-full bg-gold-100 text-charcoal-700 ring-1 ring-charcoal-100",
    sizes[size],
    className
  );

  if (!src) {
    return (
      <div
        aria-label={name}
        className={cn(classes, "flex items-center justify-center", fallback === "initials" && "font-semibold")}
      >
        {fallback === "icon" ? (
          <UserRound className="h-1/2 w-1/2 text-charcoal-400" aria-hidden />
        ) : (
          initials(name)
        )}
      </div>
    );
  }

  return (
    <div className={classes}>
      <Image
        src={src}
        alt={alt ?? name}
        fill
        sizes="160px"
        className="object-cover"
      />
    </div>
  );
}