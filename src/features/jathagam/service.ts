// jathagam porutham matching, delegated to the jagannatha hora engine. the
// engine does the real vedic work: sidereal positions, lagna, 8-koota
// Ashtakoota, the 10 Tamil poruthams and the doshas. nothing is recomputed here.
//
// server-only in practice: JATHAGAM_API_URL is read in this file, and the browser
// reaches it only through the server actions in ../../app/(public)/jathagam/
// actions.ts, which run on the server. the client component imports the types
// below with `import type` only, so nothing here is bundled to the browser. (the
// "server-only" package is not a dependency, hence the convention.)
//
// the scores the engine returns are calculation, not interpretation. the
// wording in the UI is ours and needs an astrologer's sign-off.

const API_TIMEOUT_MS = 20_000;
const PLACES_LIMIT = 8;

/** recorded with any stored result, so scores stay comparable if rules change. */
export const CALCULATION_METHOD = "ashtakoota+porutham";
export const CALCULATION_VERSION = "1.0";

export class JathagamApiError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "JathagamApiError";
  }
}

export function isJathagamConfigured(): boolean {
  return Boolean(process.env.JATHAGAM_API_URL?.trim());
}

function baseUrl(): string {
  const url = process.env.JATHAGAM_API_URL?.trim();
  if (!url) {
    throw new JathagamApiError(
      "The astrology engine is not configured. Set JATHAGAM_API_URL to enable porutham matching."
    );
  }
  return url.replace(/\/+$/, "");
}

async function engineRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.JATHAGAM_API_KEY?.trim();
  // resolved before the try on purpose: a missing url is a configuration fault,
  // and the catch below would otherwise report it as a network failure.
  const url = `${baseUrl()}${path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(key ? { authorization: `Bearer ${key}` } : {}),
        ...init?.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
  } catch {
    // a timeout and a dns failure surface identically here, so the message
    // stays generic instead of guessing which one happened.
    throw new JathagamApiError("Could not reach the astrology engine. Please try again.");
  }

  if (!response.ok) {
    // the engine returns a fastapi error shape. its detail is more useful than
    // the bare status, but it can be long, so only the message is kept.
    let detail = "";
    try {
      const body = await response.json();
      if (Array.isArray(body?.detail)) {
        detail = body.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join("; ");
      } else if (typeof body?.detail === "string") {
        detail = body.detail;
      }
    } catch {
      detail = "";
    }
    throw new JathagamApiError(
      detail || `The astrology engine returned an error (${response.status}).`,
      response.status
    );
  }

  return (await response.json()) as T;
}

export type JathagamResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function jathagamFailure(error: unknown): { ok: false; error: string } {
  if (error instanceof JathagamApiError) return { ok: false, error: error.message };
  // an unexpected failure (a bug, or a changed response shape) is reported
  // plainly rather than swallowed, but never leaked as a stack trace.
  return { ok: false, error: "Something went wrong calculating the porutham. Please try again." };
}

/* ------------------------------------------------------------------ places */

export interface Place {
  place: string;
  displayName: string;
  latitude: number;
  longitude: number;
  /** offset from utc in hours, e.g. 5.5 for ist, -5 for est. */
  timezone: number;
  elevation: number;
  country: string;
  state?: string;
}

interface PlacesResponse {
  results?: Array<{
    place?: string;
    displayName?: string;
    latitude?: number;
    longitude?: number;
    timezone?: number;
    elevation?: number;
    country?: string;
    state?: string;
  }>;
}

type UsablePlace = NonNullable<PlacesResponse["results"]>[number] & {
  latitude: number;
  longitude: number;
  timezone: number;
};

/** raw place search. throws JathagamApiError; the action wraps it. */
export async function searchPlaces(query: string): Promise<Place[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const data = await engineRequest<PlacesResponse>(
    `/location/autocomplete?query=${encodeURIComponent(trimmed)}&limit=${PLACES_LIMIT}`
  );

  return (data.results ?? [])
    // a result without coordinates is useless: the match endpoint requires them,
    // so it is dropped here rather than offered and then rejected on submit.
    .filter(
      (r): r is UsablePlace =>
        typeof r.latitude === "number" &&
        typeof r.longitude === "number" &&
        typeof r.timezone === "number"
    )
    .map((r) => ({
      place: r.place ?? r.displayName ?? trimmed,
      displayName: r.displayName ?? r.place ?? trimmed,
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone,
      elevation: typeof r.elevation === "number" ? r.elevation : 0,
      country: r.country ?? "",
      state: r.state,
    }));
}

/* ------------------------------------------------------------------- match */

/**
 * Gender is intentionally absent: the engine takes only birth details, and the
 * groom/bride card already fixes the role. It is not part of the payload.
 */
export interface MatchPersonInput {
  name: string;
  date: string;
  time: string;
  place: Place;
}

export interface Koota {
  key: string;
  label: string;
  tamil: string;
  score: number;
  max: number;
  /** true when the engine marked the check as failing, not merely low. */
  failed: boolean;
  quality?: string;
  detail?: string;
}

export interface PersonChart {
  nakshatraNumber: number;
  nakshatraName: string;
  padaNumber: number;
  raasiNumber: number;
  raasiName: string;
  nadi: string;
  gana: string;
}

export interface Dosha {
  mars: number;
  sun: number;
  saturn: number;
  rahuKetu: number;
  total: number;
}

export interface MatchReport {
  boy: PersonChart;
  girl: PersonChart;
  ashtakoota: {
    kootas: Koota[];
    total: number;
    max: number;
    percentage: number;
    rating: string;
  };
  porutham: {
    checks: Koota[];
    matched: number;
    total: number;
    percentage: number;
    rating: string;
    minimumSatisfied: boolean;
  };
  boyDosha: Dosha;
  girlDosha: Dosha;
  beejaRasi: string;
  kshetraRasi: string;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function pick(text: string, aadi: RegExp, madhya: RegExp, antya: RegExp): string {
  if (aadi.test(text)) return "Aadi";
  if (madhya.test(text)) return "Madhya";
  if (antya.test(text)) return "Antya";
  return "";
}

const ASHTAKOOTA_LABELS: Record<string, { label: string; tamil: string }> = {
  varna_porutham: { label: "Varna", tamil: "வர்ண பொருத்தம்" },
  vasiya_porutham: { label: "Vashya", tamil: "வசிய பொருத்தம்" },
  gana_porutham: { label: "Gana", tamil: "கண பொருத்தம்" },
  dina_tara_porutham: { label: "Dina Tara", tamil: "தின தார பொருத்தம்" },
  yoni_porutham: { label: "Yoni", tamil: "யோனி பொருத்தம்" },
  raasi_adhipathi_porutham: { label: "Rasi Adhipathi", tamil: "ராசி அதிபதி பொருத்தம்" },
  raasi_bahut_porutham: { label: "Bhakoot", tamil: "பாகூட் பொருத்தம்" },
  naadi_porutham: { label: "Nadi", tamil: "நடி பொருத்தம்" },
};

const PORUTHAM_LABELS: Record<string, { label: string; tamil: string }> = {
  dina_porutham: { label: "Dina", tamil: "தினம் பொருத்தம்" },
  gana_porutham: { label: "Gana", tamil: "கணம் பொருத்தம்" },
  mahendra_porutham: { label: "Mahendra", tamil: "மகேந்திரம் பொருத்தம்" },
  sthree_dheerga_porutham: { label: "Stree Deergha", tamil: "ஸ்திரீ தீர்கம் பொருத்தம்" },
  yoni_porutham: { label: "Yoni", tamil: "யோனி பொருத்தம்" },
  raasi_porutham: { label: "Rasi", tamil: "ராசி பொருத்தம்" },
  raasi_adhipathi_porutham: { label: "Rasi Adhipathi", tamil: "ராசி அதிபதி பொருத்தம்" },
  vasiya_porutham: { label: "Vasiya", tamil: "வசியம் பொருத்தம்" },
  rajju_porutham: { label: "Rajju", tamil: "ரஜ்ஜு பொருத்தம்" },
  vedha_porutham: { label: "Vedha", tamil: "வேதம் பொருத்தம்" },
};

interface KootaSection {
  kootas: Koota[];
  boyGana: string;
  boyNadi: string;
  girlGana: string;
  girlNadi: string;
}

function readKootas(
  raw: Record<string, unknown> | undefined,
  labels: Record<string, { label: string; tamil: string }>
): Koota[] {
  const out: Koota[] = [];
  for (const [key, meta] of Object.entries(labels)) {
    const entry = raw?.[key] as Record<string, unknown> | undefined;
    if (!entry) continue;
    const max = num(entry.max_score);
    const score = num(entry.score);
    out.push({
      key,
      label: meta.label,
      tamil: meta.tamil,
      score,
      max,
      failed: max > 0 && score === 0,
      quality: typeof entry.quality === "string" ? entry.quality : undefined,
      detail: typeof entry.description === "string" ? entry.description : undefined,
    });
  }
  return out;
}

function readGana(text: string): string {
  if (/Rakshasa/i.test(text)) return "Rakshasa";
  if (/Manushya/i.test(text)) return "Manushya";
  if (/Deva/i.test(text)) return "Deva";
  return "";
}

/** nadi and gana only appear inside the match sections, not on the chart blocks. */
function readIdentity(eight: Record<string, unknown> | undefined): Omit<KootaSection, "kootas"> {
  const gana = (eight?.gana_porutham ?? {}) as Record<string, unknown>;
  const nadi = (eight?.naadi_porutham ?? {}) as Record<string, unknown>;
  return {
    boyGana: readGana(String(gana.boy_gana ?? "")),
    girlGana: readGana(String(gana.girl_gana ?? "")),
    boyNadi: pick(String(nadi.boy_nadi ?? ""), /aadi/i, /madhya/i, /antya/i),
    girlNadi: pick(String(nadi.girl_nadi ?? ""), /aadi/i, /madhya/i, /antya/i),
  };
}

function readPoruthams(raw: Record<string, unknown> | undefined): Koota[] {
  const out: Koota[] = [];
  for (const [key, meta] of Object.entries(PORUTHAM_LABELS)) {
    if (!(key in (raw ?? {}))) continue;
    const passed = raw![key] === true;
    out.push({ key, ...meta, score: passed ? 1 : 0, max: 1, failed: !passed });
  }
  return out;
}

function readDosha(raw: Record<string, unknown> | undefined): Dosha {
  return {
    mars: num(raw?.mars_dosha),
    sun: num(raw?.sun_dosha),
    saturn: num(raw?.saturn_dosha),
    rahuKetu: num(raw?.rahu_ketu_dosha),
    total: num(raw?.total_dosha),
  };
}

function toBirthPayload(person: MatchPersonInput) {
  // the engine wants HH:MM:SS. the time input gives HH:MM, and some browsers
  // give HH:MM:SS, so only the first two parts are read rather than appending
  // seconds to something that already has them.
  const [hh = "00", mm = "00"] = person.time.split(":");
  return {
    date: person.date,
    time: `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:00`,
    place: person.place.displayName || person.place.place,
    latitude: person.place.latitude,
    longitude: person.place.longitude,
    timezone: person.place.timezone,
    elevation: person.place.elevation,
  };
}

/** raw match call. throws JathagamApiError; the action wraps it. */
export async function marriageMatch(
  boy: MatchPersonInput,
  girl: MatchPersonInput
): Promise<MatchReport> {
  const data = await engineRequest<Record<string, unknown>>("/marriage-match", {
    method: "POST",
    body: JSON.stringify({
      boy_birth_details: toBirthPayload(boy),
      girl_birth_details: toBirthPayload(girl),
    }),
  });

  const north = (data.north_indian ?? {}) as Record<string, unknown>;
  const eight = (north.eight_koota_porutham ?? {}) as Record<string, unknown>;
  const northSummary = (north.overall_compatibility ?? {}) as Record<string, unknown>;
  const identity = readIdentity(eight);

  const south = (data.south_indian ?? {}) as Record<string, unknown>;
  const southSummary = (south.overall_compatibility ?? {}) as Record<string, unknown>;

  const boyChart = (data.boy ?? {}) as Record<string, unknown>;
  const girlChart = (data.girl ?? {}) as Record<string, unknown>;

  return {
    boy: {
      nakshatraNumber: num(boyChart.nakshatra_number),
      nakshatraName: String(boyChart.nakshatra_name ?? "Unknown"),
      padaNumber: num(boyChart.pada_number),
      raasiNumber: num(boyChart.raasi_number),
      raasiName: String(boyChart.raasi_name ?? "Unknown"),
      nadi: identity.boyNadi,
      gana: identity.boyGana,
    },
    girl: {
      nakshatraNumber: num(girlChart.nakshatra_number),
      nakshatraName: String(girlChart.nakshatra_name ?? "Unknown"),
      padaNumber: num(girlChart.pada_number),
      raasiNumber: num(girlChart.raasi_number),
      raasiName: String(girlChart.raasi_name ?? "Unknown"),
      nadi: identity.girlNadi,
      gana: identity.girlGana,
    },
    ashtakoota: {
      kootas: readKootas(eight, ASHTAKOOTA_LABELS),
      total: num(northSummary.total_score),
      max: num(northSummary.max_possible_score) || 36,
      percentage: num(northSummary.percentage),
      rating: String(northSummary.rating ?? ""),
    },
    porutham: {
      checks: readPoruthams(south.ten_porutham as Record<string, unknown>),
      matched: num(southSummary.matched_count),
      total: num(southSummary.total_porutham) || 10,
      percentage: num(southSummary.percentage),
      rating: String(southSummary.rating ?? ""),
      minimumSatisfied: southSummary.minimum_porutham_satisfied === true,
    },
    boyDosha: readDosha(data.boy_dosha_data as Record<string, unknown>),
    girlDosha: readDosha(data.girl_dosha_data as Record<string, unknown>),
    beejaRasi: String(data.beeja_rasi ?? ""),
    kshetraRasi: String(data.kshetra_rasi ?? ""),
  };
}
