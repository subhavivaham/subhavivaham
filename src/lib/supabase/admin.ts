// The service-role client. It bypasses row level security, so this module is
// reachable from server code only and every caller has to establish who is
// asking before it reads or writes anything.
//
// Like member-dal.ts, this reaches next/headers through nothing at all - it is a
// plain key client - which means the protection against a client-component import
// is the absence of any accidental client usage plus the explicit guard below.
// `server-only` would state that as a build error instead of a comment, but the
// package is not a dependency of this project and adding it for one import is
// heavier than the alternative below.
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/data/mode";

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isServiceRoleConfigured = Boolean(supabaseUrl && serviceRoleKey);

// The publishable key is safe in the bundle; this one is not. If the environment
// ever names it NEXT_PUBLIC_*, it has already been inlined into the client
// bundle by the time this runs on the server, so refuse rather than send a
// credential that is no longer secret.
if (typeof window === "undefined" && process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY is set. That key bypasses RLS and is inlined into the client bundle at build time. Remove it and use SUPABASE_SERVICE_ROLE_KEY."
  );
}

let client: SupabaseClient | null = null;

/**
 * Returns the service-role client, or null when the key is not configured.
 *
 * Null is a supported state, not an error: the webhook endpoint arrives with no
 * member session, so it is the only caller that *needs* this client, and it
 * degrades to logging when the key is absent. Callers that can fall back to a
 * session-scoped client should take one.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isServiceRoleConfigured || !supabaseUrl || !serviceRoleKey) return null;
  if (!client) {
    client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
