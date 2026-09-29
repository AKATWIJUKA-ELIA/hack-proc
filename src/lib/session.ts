/**
 * Where the session token lives.
 *
 * The token is held in an httpOnly, SameSite=Lax cookie written by the route
 * handlers in `src/app/api/auth/`. httpOnly means page scripts cannot read it,
 * so an injected script cannot exfiltrate a login the way it could from
 * localStorage.
 *
 * The browser still needs the value to pass to Convex, which talks over a
 * websocket rather than HTTP and so never sends cookies. The resolution is
 * that `/api/auth/session` reads the cookie server-side and hands the token to
 * the client once, on load — deliberate, auditable, and not readable by
 * `document.cookie`.
 */
export const SESSION_COOKIE = "quotebook_session";

// Matches SESSION_TTL_MS in convex/auth.ts. The cookie must not outlive the
// session row, or the app spends a request discovering it is signed out.
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type PublicUser = {
  _id: string;
  email: string;
  name: string;
  organisation: string | null;
};
