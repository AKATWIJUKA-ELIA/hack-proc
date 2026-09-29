"use client";

import { ReactNode, useMemo } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { AuthProvider } from "@/components/auth/auth-provider";

/**
 * The Convex client, created once on the browser.
 *
 * `NEXT_PUBLIC_CONVEX_URL` is inlined at build time. If it is missing the app
 * cannot reach its backend at all, so this says so plainly instead of throwing
 * an opaque websocket error on every query.
 */
export function Providers({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;

  const client = useMemo(
    () => (url ? new ConvexReactClient(url) : null),
    [url],
  );

  if (!client) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center p-6">
        <div className="rounded-xl border border-destructive/40 bg-card p-6">
          <h2 className="text-lg font-semibold">Backend not configured</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This build has no{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              NEXT_PUBLIC_CONVEX_URL
            </code>
            , so it cannot reach its Convex deployment. Add it to{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              .env.local
            </code>{" "}
            and restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  // AuthProvider sits inside ConvexProvider because it runs a Convex query
  // (`auth.me`) to resolve the session token into a user.
  return (
    <ConvexProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </ConvexProvider>
  );
}
