"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { FileText, Plus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatRelative } from "@/lib/format";
import { REQUEST_STATUS } from "@/lib/vocabulary";
import { cn } from "@/lib/utils";
import { useSessionToken } from "@/components/auth/auth-provider";
import { UserMenu } from "@/components/auth/user-menu";
import { Separator } from "@/components/ui/separator";

const DOT_TONE: Record<string, string> = {
  neutral: "bg-muted-foreground",
  busy: "bg-track-web",
  action: "bg-warning",
  good: "bg-success",
  bad: "bg-destructive",
};

/**
 * Request history. Procurement is repeat work — the same buyer sources the
 * same categories month after month — so past requests are navigation, not an
 * archive.
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const token = useSessionToken();
  // No token means no session, and an unauthenticated call would only be
  // refused — so the subscription does not open until there is one.
  const requests = useQuery(
    api.requests.list,
    token ? { token, limit: 30 } : "skip",
  );
  const params = useParams<{ requestId?: string }>();
  const pathname = usePathname();

  const selectedId = params?.requestId;
  const onNewRequest = pathname === "/";

  return (
    <div className="flex h-full flex-col gap-4 border-r bg-card/50 p-3">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/60"
      >
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
        >
          Q
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-tight">
            Quotebook
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            procurement, answered
          </span>
        </span>
      </Link>

      <Button asChild className="w-full" disabled={onNewRequest}>
        <Link href="/" onClick={onNavigate}>
          <Plus />
          New request
        </Link>
      </Button>

      <nav aria-label="Request history" className="flex min-h-0 flex-1 flex-col">
        <h2 className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          History
        </h2>

        <ScrollArea className="min-h-0 flex-1">
          {requests === undefined ? (
            <ul className="space-y-1.5 pr-2" aria-busy="true">
              {[0, 1, 2, 3, 4].map((index) => (
                <li key={index}>
                  <Skeleton className="h-14 w-full rounded-lg" />
                </li>
              ))}
            </ul>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
              <FileText className="size-6 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">
                No requests yet. Your first one appears here.
              </p>
            </div>
          ) : (
            <ul className="space-y-1 pr-2">
              {requests.map((request) => {
                const active = request._id === selectedId;
                const tone =
                  REQUEST_STATUS[request.status]?.tone ?? "neutral";

                return (
                  <li key={request._id}>
                    <Link
                      href={`/requests/${request._id}`}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block rounded-lg border border-transparent px-2.5 py-2 transition-colors",
                        active
                          ? "border-border bg-accent"
                          : "hover:bg-accent/50",
                      )}
                    >
                      <span className="line-clamp-2 text-sm leading-snug">
                        {request.title}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            DOT_TONE[tone],
                            tone === "busy" && "animate-live",
                          )}
                        />
                        <span className="text-xs text-muted-foreground">
                          {formatRelative(request._creationTime)}
                        </span>
                        {/* A supplier actually answered this one. Without the
                            badge, finding the request with a real reply means
                            opening every row in the list. */}
                        {request.confirmedQuotes > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-1.5 py-px text-[10px] font-medium text-success">
                            <Receipt className="size-2.5" />
                            {request.confirmedQuotes}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </nav>

      {/* `mt-auto` pins the account block to the bottom without the footer
          riding up over it when the history list is short. */}
      <div className="mt-auto space-y-2">
        <Separator />
        <UserMenu />
        <p className="px-2 pb-1 text-[11px] text-muted-foreground">
          Convex All Gas Hackathon
        </p>
      </div>
    </div>
  );
}
