"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { PublicUser } from "@/lib/session";

type AuthState = {
  /** The session token, or null when signed out. Undefined while loading. */
  token: string | null | undefined;
  user: PublicUser | null | undefined;
  /** True until the cookie has been read and the user resolved. */
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Persist a freshly issued token and adopt it. */
  setToken: (token: string) => Promise<void>;
  /** Drop the cookie and the in-memory token. */
  clearToken: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // `undefined` = not yet read from the cookie, `null` = read and absent. The
  // distinction matters: rendering "signed out" during the read would flash
  // the sign-in page at someone who is in fact signed in.
  const [token, setTokenState] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        });
        const body: unknown = await response.json();
        const value = (body as { token?: unknown } | null)?.token;
        if (!cancelled) {
          setTokenState(typeof value === "string" ? value : null);
        }
      } catch {
        // A failed read is indistinguishable from having no session, and
        // treating it as signed-out is the safe direction to fail in.
        if (!cancelled) setTokenState(null);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Skip the query entirely until the token is known — passing `undefined`
  // would send an unauthenticated call on every page load.
  const user = useQuery(
    api.auth.me,
    token === undefined ? "skip" : { token: token ?? undefined },
  );

  const setToken = useCallback(async (next: string) => {
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: next }),
    });
    setTokenState(next);
  }, []);

  const clearToken = useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    setTokenState(null);
  }, []);

  const value = useMemo<AuthState>(() => {
    const isLoading = token === undefined || (token !== null && user === undefined);
    return {
      token: token ?? null,
      user: user ?? null,
      isLoading,
      isAuthenticated: !isLoading && user != null,
      setToken,
      clearToken,
    };
  }, [token, user, setToken, clearToken]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return context;
}

/**
 * The token, for components that only need to pass it to a Convex call.
 *
 * Returns `null` while loading or signed out, which callers turn into "skip"
 * so a query never fires without credentials.
 */
export function useSessionToken(): string | null {
  return useAuth().token ?? null;
}
