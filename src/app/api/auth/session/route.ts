import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/session";

// Reads a cookie, so it must never be statically rendered or cached.
export const dynamic = "force-dynamic";

/**
 * Hand the browser its own session token.
 *
 * The cookie is httpOnly, so client code cannot read it — but the Convex
 * client needs the token to authenticate its websocket calls. This endpoint is
 * the one controlled place that crosses that gap, on a same-origin request the
 * browser makes on load.
 */
export async function GET() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value ?? null;
  return NextResponse.json({ token });
}

/** Store a token issued by `auth.signIn` / `auth.signUp`. */
export async function POST(request: Request) {
  let token: unknown;
  try {
    const body: unknown = await request.json();
    token = (body as Record<string, unknown> | null)?.token;
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  // The token is opaque to this route — it is only ever validated by Convex —
  // but a non-string or absurd value should not reach a Set-Cookie header.
  if (typeof token !== "string" || token.length < 16 || token.length > 512) {
    return NextResponse.json({ error: "Invalid token." }, { status: 400 });
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Plain HTTP on localhost would drop a Secure cookie, and the dev login
    // would silently never persist.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ ok: true });
}

/** Clear the cookie on sign out. */
export async function DELETE() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
