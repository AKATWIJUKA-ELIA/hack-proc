import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import {
  hashPassword,
  verifyPassword,
  generateToken,
  hashToken,
} from "./lib/passwords";

/**
 * Custom email-and-password authentication.
 *
 * There is no external identity provider, so `ctx.auth.getUserIdentity()` is
 * always null here and plays no part. Instead the client holds an opaque
 * session token in an httpOnly cookie and passes it with every call; each
 * function resolves it server-side through `requireUser` below.
 *
 * The rule that matters: a caller may present a *session token*, never a user
 * id. The token is 256 bits of unguessable randomness that the server issued
 * and can revoke. A user id is neither secret nor revocable, so accepting one
 * as an authorization argument would let any caller act as anyone.
 */

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days.
const MIN_PASSWORD_LENGTH = 10;

const vSessionToken = v.string();

/** What the client is allowed to know about the signed-in user. */
const vPublicUser = v.object({
  _id: v.id("users"),
  email: v.string(),
  name: v.string(),
  organisation: v.union(v.string(), v.null()),
});

type PublicUser = {
  _id: Id<"users">;
  email: string;
  name: string;
  organisation: string | null;
};

function toPublicUser(user: Doc<"users">): PublicUser {
  // Explicit projection, not a spread-and-delete. A field added to the users
  // table later (a reset token, a TOTP secret) must not reach the client just
  // because nobody remembered to exclude it.
  return {
    _id: user._id,
    email: user.email,
    name: user.name,
    organisation: user.organisation ?? null,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Deliberately permissive. Real addresses defeat strict regexes far more often
// than strict regexes catch real typos; the shape check below only rejects
// input that could not be an address at all.
const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Resolve a session token to its user and session row, or null.
 *
 * Used by every authenticated function. Hashing is async while `withIndex`
 * takes a synchronous callback, so the digest is computed first and the lookup
 * is a plain equality on the result. An expired session is treated exactly as
 * an absent one — the row is left for the nightly sweep, since a query cannot
 * write anyway.
 */
export async function resolveSession(
  ctx: QueryCtx,
  token: string | undefined,
): Promise<{ user: Doc<"users">; session: Doc<"sessions"> } | null> {
  if (!token) return null;

  const tokenHash = await hashToken(token);
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();

  if (!session) return null;
  if (session.expiresAt < Date.now()) return null;

  const user = await ctx.db.get("users", session.userId);
  if (!user) return null;

  return { user, session };
}

/** Signed-in user or a thrown error. The guard every private function uses. */
export async function requireUser(
  ctx: QueryCtx,
  token: string | undefined,
): Promise<Doc<"users">> {
  const resolved = await resolveSession(ctx, token);
  if (!resolved) {
    throw new ConvexError("Not signed in. Sign in and try again.");
  }
  return resolved.user;
}

/**
 * Load a request the caller owns, or refuse.
 *
 * "Not found" and "not yours" deliberately produce the same message: telling a
 * stranger that a request id exists but belongs to someone else is itself a
 * disclosure. A request with no owner at all is legacy data from before
 * authentication and is refused too — it is nobody's, so it is not the
 * caller's.
 */
export async function requireOwnedRequest(
  ctx: QueryCtx,
  token: string | undefined,
  requestId: Id<"requests">,
): Promise<{ user: Doc<"users">; request: Doc<"requests"> }> {
  const user = await requireUser(ctx, token);
  const request = await ctx.db.get("requests", requestId);

  if (!request || request.userId !== user._id) {
    throw new ConvexError("That request was not found.");
  }

  return { user, request };
}

export const signUp = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    organisation: v.optional(v.string()),
  },
  returns: v.object({ token: v.string(), user: vPublicUser }),
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const name = args.name.trim();

    if (!EMAIL_SHAPE.test(email)) {
      throw new ConvexError("That does not look like an email address.");
    }
    if (name.length < 2) {
      throw new ConvexError("Please give the name you go by at work.");
    }
    if (args.password.length < MIN_PASSWORD_LENGTH) {
      throw new ConvexError(
        `Use at least ${MIN_PASSWORD_LENGTH} characters. A short phrase you will remember beats a short password you will not.`,
      );
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing) {
      throw new ConvexError("An account already exists for that address. Sign in instead.");
    }

    const userId = await ctx.db.insert("users", {
      email,
      name,
      organisation: args.organisation?.trim() || undefined,
      passwordHash: await hashPassword(args.password),
    });

    const token = await issueSession(ctx, userId);
    const user = await ctx.db.get("users", userId);
    if (!user) throw new ConvexError("Account creation failed. Try again.");

    return { token, user: toPublicUser(user) };
  },
});

export const signIn = mutation({
  args: { email: v.string(), password: v.string() },
  returns: v.object({ token: v.string(), user: vPublicUser }),
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    // One message for both "no such account" and "wrong password". Telling the
    // difference turns this endpoint into a directory of who has an account.
    const failure = "Email or password is incorrect.";
    if (!user) {
      // Still spend the hashing time. Returning instantly when the address is
      // unknown makes account existence measurable with a stopwatch.
      await hashPassword(args.password);
      throw new ConvexError(failure);
    }

    const ok = await verifyPassword(args.password, user.passwordHash);
    if (!ok) throw new ConvexError(failure);

    const token = await issueSession(ctx, user._id);
    return { token, user: toPublicUser(user) };
  },
});

async function issueSession(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<string> {
  const token = generateToken();
  await ctx.db.insert("sessions", {
    userId,
    tokenHash: await hashToken(token),
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

export const signOut = mutation({
  args: { token: vSessionToken },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tokenHash = await hashToken(args.token);
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();

    // Signing out of an already-dead session is a success, not an error — the
    // caller wanted to be signed out and they are.
    if (session) await ctx.db.delete("sessions", session._id);
    return null;
  },
});

/** Sign out everywhere. The response to a password that may have leaked. */
export const signOutEverywhere = mutation({
  args: { token: vSessionToken },
  returns: v.number(),
  handler: async (ctx, args): Promise<number> => {
    const user = await requireUser(ctx, args.token);

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(200);

    for (const session of sessions) {
      await ctx.db.delete("sessions", session._id);
    }
    return sessions.length;
  },
});

/**
 * The current user, or null.
 *
 * Returns null rather than throwing for an absent or expired token: a signed
 * out visitor is an ordinary state, and the sign-in page subscribes to this to
 * know when it can redirect.
 */
export const me = query({
  args: { token: v.optional(vSessionToken) },
  returns: v.union(v.null(), vPublicUser),
  handler: async (ctx, args): Promise<PublicUser | null> => {
    const resolved = await resolveSession(ctx, args.token);
    return resolved ? toPublicUser(resolved.user) : null;
  },
});

export const changePassword = mutation({
  args: {
    token: vSessionToken,
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const resolved = await resolveSession(ctx, args.token);
    if (!resolved) throw new ConvexError("Not signed in. Sign in and try again.");

    const ok = await verifyPassword(
      args.currentPassword,
      resolved.user.passwordHash,
    );
    if (!ok) throw new ConvexError("Your current password is incorrect.");

    if (args.newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new ConvexError(
        `Use at least ${MIN_PASSWORD_LENGTH} characters for the new password.`,
      );
    }

    await ctx.db.patch("users", resolved.user._id, {
      passwordHash: await hashPassword(args.newPassword),
    });

    // Every other session dies with the old password. The one making the
    // change survives, so the person is not logged out of the tab they are in.
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", resolved.user._id))
      .take(200);

    for (const session of sessions) {
      if (session._id === resolved.session._id) continue;
      await ctx.db.delete("sessions", session._id);
    }
    return null;
  },
});

/** Nightly sweep of expired sessions. Wired up in convex/crons.ts. */
export const purgeExpiredSessions = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx): Promise<number> => {
    const expired = await ctx.db
      .query("sessions")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", Date.now()))
      .take(500);

    for (const session of expired) {
      await ctx.db.delete("sessions", session._id);
    }
    return expired.length;
  },
});
