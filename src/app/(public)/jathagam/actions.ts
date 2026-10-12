"use server";

// the two calls the jathagam form makes. they wrap the server-only engine client
// in features/jathagam/service.ts so the browser never sees the engine's base
// url or token, and so a thrown engine error becomes a message we can render
// instead of an unhandled rejection.
import {
  isJathagamConfigured,
  jathagamFailure,
  marriageMatch,
  searchPlaces,
  type JathagamResult,
  type MatchPersonInput,
  type MatchReport,
  type Place,
} from "@/features/jathagam/service";

const NOT_CONFIGURED = "The astrology engine is not configured.";

export async function findPlacesAction(query: string): Promise<JathagamResult<Place[]>> {
  if (!isJathagamConfigured()) return { ok: false, error: NOT_CONFIGURED };
  try {
    return { ok: true, data: await searchPlaces(query) };
  } catch (error) {
    return jathagamFailure(error);
  }
}

export async function marriageMatchAction(
  boy: MatchPersonInput,
  girl: MatchPersonInput
): Promise<JathagamResult<MatchReport>> {
  if (!isJathagamConfigured()) return { ok: false, error: NOT_CONFIGURED };
  try {
    return { ok: true, data: await marriageMatch(boy, girl) };
  } catch (error) {
    return jathagamFailure(error);
  }
}
