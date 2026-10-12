"use client";

import { Upload, X } from "lucide-react";
import { MAX_PHOTO_BYTES, PHOTO_ACCEPT, formatBytes } from "@/lib/constants";
import { Button } from "@/components/ui/button";

// one entry per picked image, held in the browser until the admin commits to
// them - either by pressing upload in the photo manager or by saving the profile
// form. the object url is only the on-screen preview, so the owner of this list
// revokes it as soon as the photo is dropped or the modal is left.
export interface PendingPhoto {
  id: string;
  file: File;
  preview: string;
}

// the picked-images half of a gallery: the previews, the picker that fills the
// remaining slots and, when the caller passes onUpload, the button that commits
// them. shared by the profile form and the row-action photo manager so the two
// cannot drift apart on the rules an admin sees while picking.
export function PhotoPicker({
  photos,
  slotsLeft,
  notice,
  error,
  heading = "Ready to upload",
  onPick,
  onDrop,
  onUpload,
  busy,
}: {
  photos: PendingPhoto[];
  slotsLeft: number;
  notice: string;
  error?: string;
  heading?: string;
  onPick: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (id: string) => void;
  onUpload?: () => void;
  busy?: boolean;
}) {
  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-charcoal-800">{heading}</p>
            <p className="text-xs text-charcoal-400">
              {photos.length} picked · {slotsLeft} {slotsLeft === 1 ? "slot" : "slots"} left
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo, index) => (
              <li
                key={photo.id}
                className="group relative overflow-hidden rounded-2xl border border-charcoal-100 bg-ivory-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local object-url preview, not optimizable */}
                <img
                  src={photo.preview}
                  alt={`Pending photo ${index + 1} preview`}
                  className="aspect-[3/4] w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => onDrop(photo.id)}
                  aria-label={`Remove pending photo ${index + 1}`}
                  className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-charcoal-600 shadow-sm transition-colors hover:bg-white hover:text-wine-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <p className="truncate px-3 py-2 text-[11px] text-charcoal-500">
                  {photo.file.name} · {formatBytes(photo.file.size)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      {onUpload && photos.length > 0 && (
        <div className="flex justify-end">
          <Button type="button" onClick={onUpload} loading={busy}>
            <Upload className="h-4 w-4" /> Upload {photos.length}{" "}
            {photos.length === 1 ? "photo" : "photos"}
          </Button>
        </div>
      )}

      {slotsLeft > 0 && (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-charcoal-200 bg-ivory-50 px-4 py-6 text-center transition-colors hover:border-wine-300 hover:bg-wine-50/40">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-50 text-gold-600">
            <Upload className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold text-charcoal-700">
            {photos.length === 0 ? "Add photos" : "Add more photos"}
          </span>
          <span className="text-xs text-charcoal-400">
            {slotsLeft} {slotsLeft === 1 ? "slot" : "slots"} left
          </span>
          <input type="file" accept={PHOTO_ACCEPT} multiple className="hidden" onChange={onPick} />
        </label>
      )}

      {error ? (
        <p role="alert" className="text-xs font-medium text-wine-700">
          {error}
        </p>
      ) : notice ? (
        <p role="alert" className="text-xs font-medium text-wine-700">
          {notice}
        </p>
      ) : (
        <p className="text-xs text-charcoal-400">
          JPEG, PNG or WebP, up to {formatBytes(MAX_PHOTO_BYTES)} each.
        </p>
      )}
    </div>
  );
}