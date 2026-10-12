"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { ProfilePhoto } from "@/types";

export function PhotoGallery({
  photos,
  name,
}: {
  photos: ProfilePhoto[];
  name: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const primary = photos.find((p) => p.isPrimary) ?? photos[0];

  if (!primary) return null;

  const show = (index: number) =>
    setActiveIndex(((index % photos.length) + photos.length) % photos.length);

  return (
    <div>
      {/* a uniform three up grid, one photo per cell. the first photo used to
          take a 2x2 hero cell, which made a three photo profile render as one
          tall image beside two small ones - twice the height for the same three
          pictures. every photo now gets the same cell, so all of them show at
          once and the block stays short. */}
      <div className="grid grid-cols-3 gap-3">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            onClick={() => show(i)}
            aria-label={`View photo ${i + 1} of ${photos.length} of ${name}`}
            className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-charcoal-100"
          >
            <Image
              src={photo.url}
              alt={`${name} photo ${i + 1}`}
              fill
              sizes="(max-width: 640px) 33vw, 220px"
              className="object-cover transition-transform duration-300 hover:scale-105"
            />
          </button>
        ))}
      </div>

      {activeIndex !== null && photos[activeIndex] && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center">
          <button
            aria-label="Close gallery"
            className="absolute inset-0 bg-charcoal-950/90"
            onClick={() => setActiveIndex(null)}
          />
          <button
            aria-label="Previous photo"
            onClick={() => show(activeIndex - 1)}
            className="absolute left-3 z-[1] rounded-full bg-white/10 p-2.5 text-white backdrop-blur transition-colors hover:bg-white/20 sm:left-6"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <figure className="relative z-[1] max-h-[85vh] w-full max-w-3xl px-4">
            <div className="relative mx-auto aspect-[4/5] max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl">
              <Image
                src={photos[activeIndex].url}
                alt={`${name} photo ${activeIndex + 1}`}
                fill
                sizes="500px"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-3 text-center text-sm text-white/80">
              {name} — Photo {activeIndex + 1} of {photos.length}
            </figcaption>
          </figure>
          <button
            aria-label="Next photo"
            onClick={() => show(activeIndex + 1)}
            className="absolute right-3 z-[1] rounded-full bg-white/10 p-2.5 text-white backdrop-blur transition-colors hover:bg-white/20 sm:right-6"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <button
            aria-label="Close"
            onClick={() => setActiveIndex(null)}
            className="absolute right-4 top-4 z-[1] rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}