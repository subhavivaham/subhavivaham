import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from "@/lib/data/mode";

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next({ request });
  if (!isSupabaseConfigured || !supabaseUrl || !supabaseKey) return response;

  // No auth cookie means an anonymous visitor: there is no session to refresh
  // and nothing getUser() could tell us, because it would come back exactly as
  // "no user". This used to run on every public page anyway, so every ordinary
  // page view paid for a network round trip to the auth server before its own
  // data was even read. Skipping it is what makes the public pages fast.
  //
  // @supabase/ssr names the cookie sb-<project-ref>-auth-token and splits it
  // into .0/.1 chunks when it is large, so match the shape rather than one
  // hardcoded name that would drift with the project ref.
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
  if (!hasAuthCookie) return response;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value }) => response.cookies.set(name, value));
      },
    },
  });

  try {
    await supabase.auth.getUser();
  } catch {
    // never let an auth round trip take the page down: fall through and serve
    // the request as an anonymous visitor
  }

  return response;
}