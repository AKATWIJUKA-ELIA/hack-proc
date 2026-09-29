import { NextResponse, type NextRequest } from "next/server";

/**
 * Deliberately duplicated from `@/lib/session` rather than imported.
 *
 * Middleware runs in the Edge runtime, which forbids code generation from
 * strings. Importing the shared module pulls its whole dependency graph into
 * the Edge bundle, and something in there evaluates a string at module load —
 * the middleware then dies with "Code generation from strings disallowed" and
 * every request 500s. A one-line constant is cheaper than that coupling.
 *
 * Keep in sync with SESSION_COOKIE in `src/lib/session.ts`.
 */
const SESSION_COOKIE = "quotebook_session";

/**
 * Cheap routing on cookie presence only.
 *
 * Middleware cannot validate the token — that needs a Convex round trip, which
 * would put a network call in front of every navigation. It therefore answers
 * one question: is there a session cookie at all? A forged or expired cookie
 * gets past this and is then refused by the backend, which is the real
 * boundary. What this buys is that signed-out visitors land on the sign-in
 * page directly rather than loading the app and being bounced by `AuthGate`.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isAuthPage = pathname === "/sign-in" || pathname === "/sign-up";

  if (!hasSession && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  if (hasSession && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next internals, the auth API (which must stay
    // reachable to read and clear the cookie), and static files.
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
