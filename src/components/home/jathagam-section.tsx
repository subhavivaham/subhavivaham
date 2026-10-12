"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { RASI_LORDS, RASI_NAMES, RASI_RANGES, RASI_TAMIL } from "@/features/jathagam/data";
import { CONTAINER } from "@/lib/constants";
import { cn } from "@/lib/utils";

const PI = "+91 85086 30290";

export function JathagamSection() {
  // the rasi is picked here rather than on the jathagam page, so the tiles are
  // plain buttons: they feed the card beside them and nothing else. only
  // "Check matches" navigates, and it goes to the page that does the matching.
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <section className="bg-charcoal-950 py-20 text-white sm:py-28">
      <div className={CONTAINER}>
        <div className="mb-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-gold-400">✦ ஜாதக பொருத்தம்</p>
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Jathagam Porutham
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-white/70 sm:text-base">
            Pick your Rasi to see its lord and range, then check compatibility for yourself. Get the
            8-koota Ashtakoota match and the full 10-porutham analysis instantly, free of cost.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            <blockquote className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
              <p className="font-display text-lg leading-relaxed text-gold-300 sm:text-xl">
                இல்வாழ்வான் என்பான் இயல்புடைய மூவர்க்கும்
                <br />நல்லாற்றின் நின்ற துணை.
              </p>
              <p className="mt-3 text-sm text-white/70">
                “The householder who lives rightly is the pillar of the other three orders.”
              </p>
              <cite className="mt-2 block text-xs not-italic text-white/50">Thirukkural — Kural #41</cite>
            </blockquote>

            <div
              role="group"
              aria-label="Choose your Rasi"
              className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4"
            >
              {RASI_NAMES.map((name, i) => {
                const isSelected = selected === i;
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelected(i)}
                    className={cn(
                      "group rounded-2xl border px-3 py-4 text-center transition-all",
                      isSelected
                        ? "border-gold-400 bg-gold-500 text-charcoal-950 shadow-soft"
                        : "border-white/10 bg-white/5 hover:border-gold-500 hover:bg-gold-500 hover:text-charcoal-950"
                    )}
                  >
                    <span className="block text-sm font-semibold">{name}</span>
                    <span
                      className={cn(
                        "mt-0.5 block text-xs",
                        isSelected ? "text-charcoal-700" : "text-white/60 group-hover:text-charcoal-700"
                      )}
                    >
                      {RASI_TAMIL[i]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col rounded-3xl bg-gold-500 p-6 text-charcoal-950 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-charcoal-950 px-3 py-1 text-xs font-semibold text-gold-300">
                {selected === null ? "Your Rasi" : "Selected"}
              </span>
              <span className="font-display text-sm font-semibold text-charcoal-700">Free Analysis</span>
            </div>

            {selected === null ? (
              <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                <Sparkles className="h-8 w-8 text-charcoal-700/50" />
                <p className="mt-4 font-display text-2xl font-semibold leading-snug">
                  Choose a Rasi to begin
                </p>
                <p className="mt-2 text-sm text-charcoal-700/80">
                  Tap your Rasi on the left and its lord, range and Tamil name appear here.
                </p>
              </div>
            ) : (
              <div className="flex-1">
                <h3 className="mt-6 font-display text-2xl font-semibold sm:text-3xl">{RASI_NAMES[selected]}</h3>
                <p className="text-lg font-medium text-charcoal-700">{RASI_TAMIL[selected]}</p>
                <div className="mt-6 space-y-2 border-t border-charcoal-950/15 pt-5 text-sm">
                  <p className="flex items-center justify-between gap-3">
                    <span className="text-charcoal-700/80">Lord Planet</span>
                    <span className="font-semibold">{RASI_LORDS[selected + 1]}</span>
                  </p>
                  <p className="flex items-center justify-between gap-3">
                    <span className="text-charcoal-700/80">Range</span>
                    <span className="font-semibold">{RASI_RANGES[selected]}</span>
                  </p>
                </div>
              </div>
            )}

            <Link
              href="/jathagam"
              className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-charcoal-950 text-base font-semibold text-gold-300 transition-colors hover:bg-charcoal-800"
            >
              Check Matches <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
