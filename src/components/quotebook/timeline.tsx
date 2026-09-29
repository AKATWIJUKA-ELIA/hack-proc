"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Activity } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSessionToken } from "@/components/auth/auth-provider";

// The audit trail speaks in event kinds; a dot colour is the fastest way to
// read "this went wrong" without parsing every line.
function toneFor(kind: string): string {
  if (kind.includes("failed") || kind.includes("cancelled")) {
    return "bg-destructive";
  }
  if (kind.includes("confirmed") || kind.includes("recommendation")) {
    return "bg-success";
  }
  if (kind.includes("review") || kind.includes("unauthenticated")) {
    return "bg-warning";
  }
  return "bg-muted-foreground/40";
}

/**
 * A compact read of the `events` audit trail. It narrates the pipeline while
 * someone watches it run, which is what earns it a place on the page.
 */
export function Timeline({ requestId }: { requestId: Id<"requests"> }) {
  const token = useSessionToken();
  const events = useQuery(
    api.requests.timeline,
    token ? { token, requestId } : "skip",
  );

  if (events === undefined || events.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" />
          Activity
        </CardTitle>
        <CardDescription>
          Every step this request has taken, newest first.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ol className="relative space-y-3 border-l pl-5">
          {events.map((event) => (
            <li key={event._id} className="relative">
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -left-[1.4rem] top-1.5 size-2 rounded-full ring-4 ring-card",
                  toneFor(event.kind),
                )}
              />
              <p className="text-sm leading-snug">{event.message}</p>
              <p className="mt-0.5 text-xs tabular text-muted-foreground">
                {formatTime(event._creationTime)}
              </p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
