import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from "@/lib/data/mode";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  if (!isSupabaseConfigured || !supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_DATA_MODE=supabase, NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. The app runs on mock data until then."
    );
  }
  client = createBrowserClient(supabaseUrl, supabaseKey);
  return client;
}

export { isSupabaseConfigured };