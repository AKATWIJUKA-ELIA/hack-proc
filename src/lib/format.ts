import { ConvexError } from "convex/values";

// Display-side mirror of convex/lib/money.ts. Keep the exponent table in sync
// with the backend — a mismatch shows a price 100x off in the one place a
// procurement officer is actually looking.
const EXPONENTS: Record<string, number> = {
  UGX: 0,
  KES: 2,
  TZS: 2,
  RWF: 0,
  USD: 2,
  EUR: 2,
  GBP: 2,
  AED: 2,
  ZAR: 2,
};

export function formatMoney(minor: number, currency: string): string {
  const exponent = EXPONENTS[currency.toUpperCase()] ?? 2;
  const major = minor / 10 ** exponent;
  return `${currency} ${major.toLocaleString(undefined, {
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  })}`;
}

/** Amount only, for table cells where the currency sits in its own column. */
export function formatAmount(minor: number, currency: string): string {
  const exponent = EXPONENTS[currency.toUpperCase()] ?? 2;
  return (minor / 10 ** exponent).toLocaleString(undefined, {
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  });
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "3 minutes ago" — the sidebar reads better in elapsed time than clock time. */
export function formatRelative(ms: number): string {
  const seconds = Math.round((Date.now() - ms) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * The sentence a backend function wrote for the person reading the screen.
 *
 * Convex deliberately redacts plain `Error` messages on production
 * deployments — a client sees only "[Request ID: …] Server Error" — so every
 * user-facing refusal in `convex/` is thrown as a `ConvexError`, whose `data`
 * payload is delivered intact. This reads that payload, falls back to the dev
 * server's "Uncaught …" framing, and refuses to show the raw redacted string.
 */
export function errorMessage(caught: unknown): string {
  const fallback = "Something went wrong. Please try again.";

  if (caught instanceof ConvexError) {
    // Messages are thrown as strings throughout `convex/`; an object payload
    // would be a programming change, so it degrades rather than rendering
    // "[object Object]" at someone.
    return typeof caught.data === "string" ? caught.data : fallback;
  }

  if (caught instanceof Error) {
    // `npx convex dev` surfaces the real throw with this framing.
    const match = caught.message.match(/Uncaught \w*Error:\s*(.+?)(?:\n|$)/);
    if (match) return match[1].trim();

    // The redacted production form carries nothing worth showing.
    if (/\[Request ID: .*\]\s*Server Error/.test(caught.message)) {
      return fallback;
    }
    return caught.message;
  }

  return fallback;
}
