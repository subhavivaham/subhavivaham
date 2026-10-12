"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { TempleImage } from "@/features/temples/types";

// The temple photo gallery. A plain grid with a lightbox, mirroring the profile
// gallery: every photo gets the same cell so the block stays short, and the
// lightbox is what makes a set of six readable on a phone.
export function TempleGallery({
  images,
  name,
}: {
  images: TempleImage[];
  name: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // escape closes the lightbox. without it the overlay can only be dismissed by
  // clicking the backdrop, which a keyboard user cannot reach.
  useEffect(() => {
    if (activeIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveIndex(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex]);

  if (images.length === 0) return null;

  // wraps in both directions, so the arrows are never a dead end
  const show = (index: number) =>
    setActiveIndex(((index % images.length) + images.length) % images.length);

  const active = activeIndex === null ? null : images[activeIndex];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((image, index) => (
          <button
            key={image.id || image.url}
            type="button"
            onClick={() => show(index)}
            aria-label={`View photo ${index + 1} of ${images.length} of ${name}`}
            className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-charcoal-100"
          >
            <Image
              src={image.url}
              // the alt an admin typed is the caption for this exact photo; when
              // they left it blank the temple name still beats an empty alt,
              // which would drop the photo out of the page for a screen reader
              alt={image.alt || `${name} photo ${index + 1}`}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px"
              className="object-cover transition-transform duration-300 hover:scale-105"
            />
          </button>
        ))}
      </div>

      {active && activeIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${name} photo ${activeIndex + 1} of ${images.length}`}
          className="fixed inset-0 z-[95] flex items-center justify-center"
        >
          <button
            type="button"
            aria-label="Close gallery"
            className="absolute inset-0 bg-charcoal-950/90"
            onClick={() => setActiveIndex(null)}
          />
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => show(activeIndex - 1)}
            className="absolute left-3 z-[1] rounded-full bg-white/10 p-2.5 text-white backdrop-blur transition-colors hover:bg-white/20 sm:left-6"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <figure className="relative z-[1] max-h-[85vh] w-full max-w-3xl px-4">
            <div className="relative mx-auto aspect-[4/3] max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-2xl">
              <Image
                src={active.url}
                alt={active.alt || `${name} photo ${activeIndex + 1}`}
                fill
                sizes="100vw"
                className="object-contain"
              />
            </div>
            <figcaption className="mt-3 text-center text-sm text-white/80">
              {name} — Photo {activeIndex + 1} of {images.length}
            </figcaption>
          </figure>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => show(activeIndex + 1)}
            className="absolute right-3 z-[1] rounded-full bg-white/10 p-2.5 text-white backdrop-blur transition-colors hover:bg-white/20 sm:right-6"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-4 z-[1] rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            onClick={() => setActiveIndex(null)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
