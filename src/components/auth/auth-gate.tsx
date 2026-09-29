"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "./auth-provider";

/**
 * Keeps the app's pages for signed-in users.
 *
 * This is a convenience, not the security boundary. Every Convex function
 * enforces ownership server-side, so a visitor who bypasses this renders an
 * empty shell and gets refused by the backend — which is where it counts.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/sign-in");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="sr-only">Loading your account…</span>
      </div>
    );
  }

  // The redirect above is already in flight; rendering nothing avoids showing
  // a flash of the app to someone who is about to be sent to sign in.
  if (!isAuthenticated) return null;

  return <>{children}</>;
}
