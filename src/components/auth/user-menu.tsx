"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { LogOut, ShieldCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "./auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

export function UserMenu() {
  const { user, token, clearToken } = useAuth();
  const signOut = useMutation(api.auth.signOut);
  const signOutEverywhere = useMutation(api.auth.signOutEverywhere);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  async function leave(everywhere: boolean) {
    setBusy(true);
    try {
      // Revoke server-side first. Clearing only the cookie would leave a live
      // session row that anyone holding the token could keep using.
      if (token) {
        if (everywhere) await signOutEverywhere({ token });
        else await signOut({ token });
      }
    } catch {
      // Even if revocation fails, the local session must still be dropped —
      // otherwise the button appears to do nothing.
    } finally {
      // Clear local state and stop. The redirect belongs to `AuthGate`, which
      // is already watching `isAuthenticated`.
      //
      // Navigating from here as well raced it: two `router.replace` calls
      // fired in the same tick from a dynamic route (`/requests/[id]`)
      // cancelled each other, leaving the cookie cleared and the page blank
      // but the URL unchanged — signed out and stranded.
      await clearToken();
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent/60 disabled:opacity-60"
        disabled={busy}
      >
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"
        >
          {initials(user.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-tight">
            {user.name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {user.organisation ?? user.email}
          </span>
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ThemeToggle />
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void leave(false)} disabled={busy}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void leave(true)} disabled={busy}>
          <ShieldCheck />
          Sign out everywhere
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
