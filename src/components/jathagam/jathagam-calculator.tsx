"use client";

import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  Heart,
  Info,
  Loader2,
  MapPin,
  Minus,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SectionHeading } from "@/components/ui/section-heading";
import { JathagamHero } from "@/components/jathagam/jathagam-hero";
import { findPlacesAction, marriageMatchAction } from "@/app/(public)/jathagam/actions";
import { RASI_TAMIL } from "@/features/jathagam/data";
import type { Koota, MatchReport, Place } from "@/features/jathagam/service";
import { cn } from "@/lib/utils";
import { useToast } from "@/lib/state/toast-provider";

const DEBOUNCE_MS = 300;

type Accent = "wine" | "gold";

interface PersonForm {
  name: string;
  date: string;
  time: string;
  place: Place | null;
}

const EMPTY: PersonForm = { name: "", date: "", time: "", place: null };

/**
 * Traffic-light tone for a percentage, kept in the brand palette so a score never
 * reads as a colour-blind red/green pair on its own: the number and the label
 * beside it always say the same thing.
 */
function toneFor(percent: number) {
  if (percent >= 70) {
    return { text: "text-emerald-700", ring: "stroke-emerald-500", chip: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }
  if (percent >= 45) {
    return { text: "text-gold-700", ring: "stroke-gold-500", chip: "border-gold-200 bg-gold-50 text-gold-800" };
  }
  return { text: "text-wine-700", ring: "stroke-wine-600", chip: "border-wine-200 bg-wine-50 text-wine-700" };
}

/**
 * Circular progress for a headline score. The fraction stays visible inside the
 * ring so the shape is decoration, not the only carrier of the number.
 */
function ScoreRing({
  value,
  max,
  label,
  caption,
}: {
  value: number;
  max: number;
  label: string;
  caption: string;
}) {
  const percent = max > 0 ? (value / max) * 100 : 0;
  const tone = toneFor(percent);
  const size = 140;
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, percent)) / 100);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-charcoal-100"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn(tone.ring, "transition-[stroke-dashoffset] duration-700 ease-out")}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-4xl font-semibold text-charcoal-900">{value}</span>
          <span className="text-sm font-medium text-charcoal-400">out of {max}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="font-display text-base font-semibold text-charcoal-900">{label}</p>
        <span className={cn("mt-1.5 inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold", tone.chip)}>
          {caption}
        </span>
      </div>
    </div>
  );
}

/**
 * City autocomplete, inlined rather than its own component because the jathagam
 * form is the only consumer.
 *
 * The match engine requires latitude, longitude and a timezone offset, so the
 * selected city object is the source of truth and not the typed text. Free
 * typing is deliberately not accepted: a guessed offset silently corrupts the
 * chart, so the member has to choose from the list.
 */
function PlacePicker({
  label,
  value,
  onChange,
  error,
  accent = "wine",
}: {
  label: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  error?: string;
  accent?: Accent;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const latestRequest = useRef(0);
  const listId = useId();

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    // each keystroke supersedes the last request. the id check means a slow
    // earlier response can never overwrite a newer one's results.
    const id = ++latestRequest.current;
    const timer = setTimeout(async () => {
      // set inside the timer rather than in the effect body, so the render is
      // not triggered synchronously by the effect itself.
      setLoading(true);
      const result = await findPlacesAction(trimmed);
      if (id !== latestRequest.current) return;
      setLoading(false);
      if (result.ok) {
        setResults(result.data);
        setMessage(result.data.length === 0 ? "No matching city found." : "");
        setHighlight(0);
      } else {
        setResults([]);
        setMessage(result.error);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onClickAway = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const choose = (place: Place) => {
    onChange(place);
    setQuery("");
    setResults([]);
    setOpen(false);
    setMessage("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[highlight]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label className="block text-sm font-medium text-charcoal-800">{label}</label>

      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={Boolean(error)}
          value={value ? value.displayName : query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            // editing after a pick drops the old coordinates, so a stale
            // selection can never be submitted against changed text.
            if (value) onChange(null);
          }}
          onFocus={() => {
            if (value) {
              setQuery("");
              setOpen(true);
            }
          }}
          onKeyDown={onKeyDown}
          placeholder="Search for a city, e.g. Salem"
          className={cn(
            "h-11 w-full rounded-xl border border-charcoal-200 bg-white px-3.5 pr-10 text-sm text-charcoal-900 shadow-sm transition-colors placeholder:text-charcoal-400 focus:border-wine-400 focus:outline-none focus:ring-2 focus:ring-wine-100",
            error && "border-wine-300 focus:ring-wine-100"
          )}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        </span>

        {open && (query.trim().length >= 2 || results.length > 0) && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto overscroll-contain rounded-xl border border-charcoal-200 bg-white py-1 shadow-lg"
          >
            {results.map((place, index) => (
              <li
                key={`${place.displayName}-${place.latitude}`}
                role="option"
                aria-selected={index === highlight}
              >
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => choose(place)}
                  className={cn(
                    "flex w-full flex-col items-start px-3.5 py-2 text-left text-sm",
                    index === highlight ? "bg-wine-50" : "bg-white"
                  )}
                >
                  <span className="font-medium text-charcoal-900">{place.displayName}</span>
                  <span
                    className={cn(
                      "text-xs",
                      accent === "gold" ? "text-gold-700" : "text-wine-700"
                    )}
                  >
                    {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)} &middot; UTC
                    {place.timezone >= 0 ? "+" : ""}
                    {place.timezone}
                  </span>
                </button>
              </li>
            ))}
            {!loading && message && <li className="px-3.5 py-2 text-sm text-charcoal-500">{message}</li>}
          </ul>
        )}
      </div>

      {error ? (
        <p className="text-xs font-medium text-wine-600">{error}</p>
      ) : value ? (
        <p className="flex items-center gap-1.5 text-xs text-charcoal-400">
          <Check className="h-3.5 w-3.5 text-emerald-600" />
          <span>
            {value.state ? `${value.state} · ` : ""}
            {value.country || "coordinates captured"}
          </span>
        </p>
      ) : (
        <p className="text-xs text-charcoal-400">
          Pick a city from the list so the correct timezone is used.
        </p>
      )}
    </div>
  );
}

/**
 * One side of the form. Groom and bride differ only in wording and accent, so
 * they share this instead of being two near-identical blocks of markup.
 */
function PersonCard({
  title,
  tamil,
  role,
  gender,
  accent,
  person,
  onChange,
  cityError,
}: {
  title: string;
  tamil: string;
  role: string;
  gender: string;
  accent: Accent;
  person: PersonForm;
  onChange: (patch: Partial<PersonForm>) => void;
  cityError?: string;
}) {
  return (
    <section
      className={cn(
        // deliberately no overflow-hidden: the city dropdown is absolutely
        // positioned and would be clipped by it. the rail is clipped by its
        // own wrapper below, which shares the card's radius.
        "relative rounded-3xl border bg-white p-6 shadow-card transition-shadow hover:shadow-card-hover sm:p-7",
        accent === "wine" ? "border-wine-200" : "border-gold-200"
      )}
    >
      {/* a soft tint along the top edge, so the two sides read apart at a glance.
        the wrapper is pulled out to the border box and carries the card's own
        radius, so the bar is trimmed along the corners instead of poking past
        them the way a rounded 4px strip of its own cannot be. */}
      <div aria-hidden className="pointer-events-none absolute -inset-px overflow-hidden rounded-3xl">
        <div
          className={cn(
            "h-1 w-full",
            accent === "wine"
              ? "bg-gradient-to-r from-wine-300 via-wine-400 to-wine-200"
              : "bg-gradient-to-r from-gold-300 via-gold-400 to-gold-200"
          )}
        />
      </div>

      <header className="mb-6 flex items-center gap-3.5">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
            accent === "wine" ? "bg-wine-100 text-wine-700" : "bg-gold-100 text-gold-800"
          )}
        >
          {accent === "wine" ? <User className="h-5 w-5" /> : <Heart className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <h2
            className={cn(
              "font-display text-xl font-semibold",
              accent === "wine" ? "text-wine-800" : "text-gold-800"
            )}
          >
            {title}
          </h2>
          <p className="text-sm text-charcoal-500">{tamil}</p>
        </div>
        <span
          className={cn(
            "ml-auto shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",
            accent === "wine"
              ? "border-wine-200 bg-wine-50 text-wine-700"
              : "border-gold-200 bg-gold-50 text-gold-800"
          )}
        >
          {gender}
        </span>
      </header>

      <div className="space-y-4">
        <Input
          label="Name"
          placeholder={role}
          value={person.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Date of birth"
            type="date"
            value={person.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
          <Input
            label="Time of birth"
            type="time"
            value={person.time}
            onChange={(e) => onChange({ time: e.target.value })}
          />
        </div>

        <PlacePicker
          label="Birth city"
          accent={accent}
          value={person.place}
          onChange={(place) => onChange({ place })}
          error={cityError}
        />
      </div>
    </section>
  );
}

function ChartFacts({
  label,
  name,
  nakshatraName,
  pada,
  raasiName,
  raasiNumber,
  nadi,
  gana,
  accent,
}: {
  label: string;
  name: string;
  nakshatraName: string;
  pada: number;
  raasiName: string;
  raasiNumber: number;
  nadi: string;
  gana: string;
  accent: Accent;
}) {
  // the engine numbers the rasi 1-12; the tamil table is a 0-indexed array.
  const raasiTamil = RASI_TAMIL[raasiNumber - 1];

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white p-5 shadow-card",
        accent === "wine" ? "border-wine-200" : "border-gold-200"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-[0.18em]",
            accent === "wine" ? "text-wine-700" : "text-gold-700"
          )}
        >
          {label}
        </span>
      </div>
      <p className="mt-1.5 font-display text-lg font-semibold text-charcoal-900">{name}</p>

      <dl className="mt-4 space-y-2.5 text-sm">
        <div className="flex items-baseline justify-between gap-3 border-b border-charcoal-100 pb-2.5">
          <dt className="text-charcoal-500">Rasi</dt>
          <dd className="text-right font-medium text-charcoal-900">
            {raasiName}
            {raasiTamil && <span className="ml-1.5 font-normal text-charcoal-400">{raasiTamil}</span>}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-b border-charcoal-100 pb-2.5">
          <dt className="text-charcoal-500">Nakshatra</dt>
          <dd className="font-medium text-charcoal-900">{nakshatraName}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-b border-charcoal-100 pb-2.5">
          <dt className="text-charcoal-500">Pada</dt>
          <dd className="font-medium text-charcoal-900">{pada}</dd>
        </div>
        {nadi && (
          <div className="flex items-baseline justify-between gap-3 border-b border-charcoal-100 pb-2.5">
            <dt className="text-charcoal-500">Nadi</dt>
            <dd className="font-medium text-charcoal-900">{nadi}</dd>
          </div>
        )}
        {gana && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-charcoal-500">Gana</dt>
            <dd className="font-medium text-charcoal-900">{gana}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function KootaCard({ koota }: { koota: Koota }) {
  const partial = !koota.failed && koota.score < koota.max;
  const percent = koota.max > 0 ? (koota.score / koota.max) * 100 : 0;

  const shell = koota.failed
    ? "border-wine-200 bg-wine-50/50"
    : partial
      ? "border-gold-200 bg-gold-50/40"
      : "border-emerald-200 bg-emerald-50/40";

  const rail = koota.failed ? "bg-wine-500" : partial ? "bg-gold-500" : "bg-emerald-500";

  const badge = koota.failed
    ? "bg-wine-100 text-wine-700"
    : partial
      ? "bg-gold-100 text-gold-800"
      : "bg-emerald-100 text-emerald-700";

  const Icon = koota.failed ? X : partial ? Minus : Check;

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border p-4 pl-5 transition-shadow hover:shadow-card", shell)}>
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", rail)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-charcoal-900">{koota.label}</h4>
          {koota.tamil && <p className="text-xs text-charcoal-500">{koota.tamil}</p>}
        </div>
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", badge)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/70">
          <span className={cn("block h-full rounded-full", rail)} style={{ width: `${percent}%` }} />
        </span>
        <span className="shrink-0 font-display text-sm font-semibold text-charcoal-800">
          {koota.score}
          <span className="font-normal text-charcoal-400">/{koota.max}</span>
        </span>
      </div>

      {koota.quality && <p className="mt-2.5 text-xs font-semibold text-charcoal-700">{koota.quality}</p>}
      {koota.detail && <p className="mt-1 text-xs leading-relaxed text-charcoal-500">{koota.detail}</p>}
    </div>
  );
}

function DoshaBars({ dosha }: { dosha: MatchReport["boyDosha"] }) {
  const rows = [
    { label: "Mangal", value: dosha.mars },
    { label: "Surya", value: dosha.sun },
    { label: "Shani", value: dosha.saturn },
    { label: "Rahu / Ketu", value: dosha.rahuKetu },
  ];

  return (
    <>
      <ul className="mt-4 space-y-2.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-3 text-sm">
            <span className="w-24 shrink-0 text-charcoal-600">{row.label}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-charcoal-100">
              <span
                className={cn(
                  "block h-full rounded-full",
                  row.value >= 50 ? "bg-wine-600" : row.value > 0 ? "bg-gold-500" : "bg-emerald-500"
                )}
                style={{ width: `${Math.min(100, row.value)}%` }}
              />
            </span>
            <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-charcoal-700">
              {row.value.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-charcoal-100 pt-3 text-sm text-charcoal-600">
        Total dosha{" "}
        <span className="font-semibold text-charcoal-900">{dosha.total.toFixed(1)}%</span>
      </p>
    </>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-2xl border border-charcoal-200 bg-charcoal-50 p-4 text-sm text-charcoal-600">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-charcoal-400" />
      <span>{children}</span>
    </p>
  );
}

export function JathagamCalculator({ enabled = true }: { enabled?: boolean }) {
  const toast = useToast();
  const [boy, setBoy] = useState<PersonForm>({ ...EMPTY });
  const [girl, setGirl] = useState<PersonForm>({ ...EMPTY });
  const [report, setReport] = useState<MatchReport | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const update = (side: "boy" | "girl", patch: Partial<PersonForm>) => {
    const setter = side === "boy" ? setBoy : setGirl;
    setter((prev) => ({ ...prev, ...patch }));
  };

  if (!enabled) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center sm:px-6">
        <h1 className="font-display text-3xl font-semibold text-wine-800">ஜாதக பொருத்தம்</h1>
        <p className="mt-4 text-charcoal-500">
          Porutham matching is being configured. Please check back shortly.
        </p>
      </div>
    );
  }

  const submit = () => {
    if (!boy.date) return setError("Groom's date of birth is required.");
    if (!girl.date) return setError("Bride's date of birth is required.");
    if (!boy.time) return setError("Groom's time of birth is required.");
    if (!girl.time) return setError("Bride's time of birth is required.");
    if (!boy.place) return setError("Groom's birth city is required. Pick one from the list.");
    if (!girl.place) return setError("Bride's birth city is required. Pick one from the list.");
    setError("");

    // captured as consts: the narrowing from the guards above is lost inside the
    // async callback below, and the places are what the action requires.
    const boyPlace = boy.place;
    const girlPlace = girl.place;

    startTransition(async () => {
      const result = await marriageMatchAction(
        { ...boy, place: boyPlace },
        { ...girl, place: girlPlace }
      );
      if (result.ok) {
        setReport(result.data);
        toast("Porutham calculated successfully.", "success");
      } else {
        setReport(null);
        setError(result.error);
      }
    });
  };

  const boyName = boy.name.trim() || "Groom";
  const girlName = girl.name.trim() || "Bride";

  return (
    <div className="bg-gradient-to-b from-ivory-50 via-white to-ivory-50/60 pb-20">
      <JathagamHero />

      {/* --------------------------------------------------------------- form */}
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div id="porutham-form" className="grid scroll-mt-24 gap-6 py-10 md:grid-cols-2">
          <PersonCard
            title="Groom details"
            tamil="வரன்"
            role="Groom name"
            gender="Male"
            accent="wine"
            person={boy}
            onChange={(patch) => update("boy", patch)}
            cityError={error.startsWith("Groom's birth city") ? error : undefined}
          />
          <PersonCard
            title="Bride details"
            tamil="மணப்பெண்"
            role="Bride name"
            gender="Female"
            accent="gold"
            person={girl}
            onChange={(patch) => update("girl", patch)}
            cityError={error.startsWith("Bride's birth city") ? error : undefined}
          />
        </div>

        <div className="flex flex-col items-center gap-3 pb-4">
          <Button size="lg" disabled={true} className="px-10">
            <Sparkles className="h-4 w-4" /> Coming soon
          </Button>
          <p className="text-xs text-charcoal-400">
             Coming soon. Not available yet.
          </p>
          {error && !error.includes("birth city") && (
            <p className="text-sm font-medium text-wine-600">{error}</p>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------ results */}
      {report && (
        <div className="animate-fade-in mx-auto w-full max-w-6xl space-y-14 px-4 pt-8 sm:px-6">
          {/* verdict */}
          <section className="overflow-hidden rounded-3xl border border-charcoal-200 bg-white shadow-card">
            <div className="border-b border-charcoal-100 bg-charcoal-50/70 px-6 py-4 sm:px-8">
              <h2 className="font-display text-xl font-semibold text-charcoal-900">Your porutham result</h2>
              <p className="mt-1 text-sm text-charcoal-500">
                {boyName} &amp; {girlName} &middot; worked out from the birth details above
              </p>
            </div>

            <div className="grid gap-8 px-6 py-10 sm:grid-cols-2 sm:px-8">
              <ScoreRing
                value={report.ashtakoota.total}
                max={report.ashtakoota.max}
                label="Ashtakoota"
                caption={report.ashtakoota.rating}
              />
              <div className="flex items-center justify-center sm:border-l sm:border-charcoal-100">
                <ScoreRing
                  value={report.porutham.matched}
                  max={report.porutham.total}
                  label="Porutham"
                  caption={report.porutham.rating}
                />
              </div>
            </div>

            <div className="grid gap-4 border-t border-charcoal-100 px-6 py-6 sm:grid-cols-2 sm:px-8">
              <ChartFacts
                label="Groom chart"
                accent="wine"
                name={boyName}
                nakshatraName={report.boy.nakshatraName}
                pada={report.boy.padaNumber}
                raasiName={report.boy.raasiName}
                raasiNumber={report.boy.raasiNumber}
                nadi={report.boy.nadi}
                gana={report.boy.gana}
              />
              <ChartFacts
                label="Bride chart"
                accent="gold"
                name={girlName}
                nakshatraName={report.girl.nakshatraName}
                pada={report.girl.padaNumber}
                raasiName={report.girl.raasiName}
                raasiNumber={report.girl.raasiNumber}
                nadi={report.girl.nadi}
                gana={report.girl.gana}
              />
            </div>
          </section>

          {/* ashtakoota */}
          <section>
            <SectionHeading
              align="left"
              eyebrow="Ashtakoota"
              title="Eight Koota, 36 points"
              description="Shown in full so the score is never a bare number."
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {report.ashtakoota.kootas.map((koota) => (
                <KootaCard key={koota.key} koota={koota} />
              ))}
            </div>
          </section>

          {/* porutham */}
          <section>
            <SectionHeading
              align="left"
              eyebrow="South Indian"
              title="Ten Porutham"
              description="The Tamil tradition, checked one by one. Nadi dosha is the one that matters most."
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {report.porutham.checks.map((check) => (
                <KootaCard key={check.key} koota={check} />
              ))}
            </div>
          </section>

          {/* dosha */}
          <section>
            <SectionHeading
              align="left"
              eyebrow="Additional checks"
              title="Dosha and Beeja Sthana"
              description="Reported separately from the scores, as tradition requires."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-charcoal-200 bg-white p-5 shadow-card">
                <h4 className="font-display text-base font-semibold text-charcoal-900">{boyName}&apos;s dosha</h4>
                <DoshaBars dosha={report.boyDosha} />
              </div>
              <div className="rounded-2xl border border-charcoal-200 bg-white p-5 shadow-card">
                <h4 className="font-display text-base font-semibold text-charcoal-900">{girlName}&apos;s dosha</h4>
                <DoshaBars dosha={report.girlDosha} />
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-charcoal-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">Beeja rasi</p>
                <p className="mt-1 font-semibold text-charcoal-900">{report.beejaRasi}</p>
              </div>
              <div className="rounded-2xl border border-charcoal-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">Kshetra rasi</p>
                <p className="mt-1 font-semibold text-charcoal-900">{report.kshetraRasi}</p>
              </div>
            </div>
          </section>

          <Note>
            This is a traditional calculation, not a judgement. Please confirm with an astrologer before
            any decision is made.
          </Note>
        </div>
      )}
    </div>
  );
}
