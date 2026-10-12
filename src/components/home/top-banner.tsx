"use client";

import { useState } from "react";

export function TopBanner({ message, enabled = true }: { message?: string; enabled?: boolean }) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible || !enabled || !message) return null;

  const messages = message
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-wine-700 to-wine-600 text-white">
      <div className="flex items-center py-2 sm:py-2.5">
        <div className="relative flex w-full items-center overflow-hidden">
          <div className="animate-marquee flex whitespace-nowrap will-change-transform [animation-duration:35s]">
            {[...messages, ...messages].map((message, index) => (
              <span
                key={index}
                className="inline-flex items-center text-xs font-medium sm:text-sm"
              >
                <span className="mx-6 text-gold-300">•</span>
                {message}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
