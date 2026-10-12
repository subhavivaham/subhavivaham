import Link from "next/link";
import Image, { type StaticImageData } from "next/image";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo/subhavivaham_logo.png";

export function Logo({
  variant = "dark",
  size = "md",
  src = logo,
  className,
}: {
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  src?: StaticImageData;
  className?: string;
}) {
  // md carries the site headers. sm is the member top bar, which floats over the
  // page rather than sitting at the top of it, so its mark is kept small enough
  // that the bar takes as little vertical room as possible; lg is for the
  // footer, so the mark never dictates the row it sits in.
  const box = {
    sm: "h-11 w-24",
    md: "h-14 w-28 sm:h-16 sm:w-32",
    lg: "h-18 w-36 sm:h-24 sm:w-48",
  }[size];
  const pix = size === "lg" ? "192px" : size === "sm" ? "96px" : "128px";
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2.5", className)}>
      <span className={cn("relative", box, variant === "light" && "brightness-150")}>
        <Image
          src={src}
          alt="Subhavivaham"
          fill
          sizes={pix}
          priority
          className="object-contain object-left"
        />
      </span>
    </Link>
  );
}