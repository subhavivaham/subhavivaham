const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const legacyAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Supabase now issues "publishable" keys; the older anon key still works, so
// accept either name and let the env file decide which one is present.
export const supabaseKey = publishableKey || legacyAnonKey;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

/**
 * The database is the only source of truth. There is no mock mode and no
 * `NEXT_PUBLIC_DATA_MODE` switch: a mode flag meant a deployment could quietly
 * fall back to bundled seed data — or to nothing at all — and render empty
 * pages that looked like a database problem. Reads now depend on the
 * credentials alone, so the only way to get an empty page is a missing key,
 * which this module reports loudly.
 *
 * `NEXT_PUBLIC_*` values are inlined when the app is built, so changing them
 * requires a rebuild, not just a restart.
 */
if (typeof window === "undefined" && !isSupabaseConfigured) {
  console.warn(
    "[data] NEXT_PUBLIC_SUPABASE_URL and a publishable/anon key are not both set. Public pages will render empty until they are, and then the app must be rebuilt."
  );
}
