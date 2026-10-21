import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  // optimistic check only. a cookie is trivially forgeable, so this just avoids
  // rendering the admin shell for a signed-out visitor and saves a round trip.
  // the real gate is requireAdmin() in the admin layout plus assertAdmin() in
  // every server action, both of which hash the token and check the sessions
  // table rather than trusting the cookie.
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  if (isAdminRoute && pathname !== "/admin/login" && !request.cookies.has(SESSION_COOKIE)) {
    const login = request.nextUrl.clone();
    login.pathname = "/admin/login";
    login.search = "";
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|favicon.png|apple-touch-icon.png|sitemap.xml|robots.txt).*)"],
};
