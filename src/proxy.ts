import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);

  // Optimistic check only. A cookie is trivially forgeable, so this just avoids
  // rendering the admin shell for a signed-out visitor and saves a round trip.
  // The real gate is requireAdmin() in admin/(protected)/layout.tsx plus
  // assertAdmin() in every server action, and both validate the access token
  // against the auth server rather than trusting a cookie.
  const { pathname } = request.nextUrl;
  const isAdminRoute =
    pathname === "/admin" || pathname.startsWith("/admin/");

  if (isAdminRoute && pathname !== "/admin/login") {
    // @supabase/ssr names the cookie sb-<project-ref>-auth-token and splits it
    // into .0/.1 chunks when it is large, so match the shape rather than one
    // hardcoded name that would drift with the project ref.
    const hasSession = request.cookies
      .getAll()
      .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));

    if (!hasSession) {
      const login = request.nextUrl.clone();
      login.pathname = "/admin/login";
      login.search = "";
      return NextResponse.redirect(login);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
