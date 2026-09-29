"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RequestHeader } from "./request-header";
import { Board } from "./board";
import { ReviewQueue } from "./review-queue";
import { SendGate } from "./send-gate";
import { Recommendation } from "./recommendation";
import { Timeline } from "./timeline";
import { useSessionToken } from "@/components/auth/auth-provider";

export function RequestDetail({ requestId }: { requestId: string }) {
  // The route parameter is a string; Convex ids are branded strings. An id that
  // does not exist comes back as `null` from the query below, which is the same
  // handling a deleted request needs — so one code path covers both.
  const id = requestId as Id<"requests">;
  const token = useSessionToken();
  const args = token ? { token, requestId: id } : ("skip" as const);

  const request = useQuery(api.requests.get, args);
  const lineItems = useQuery(api.requests.lineItems, args);
  // The same subscription the board uses. Convex dedupes identical queries, so
  // reading it here for the header's count costs nothing extra.
  const rows = useQuery(api.board.forRequest, args);

  if (request === undefined) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6">
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (request === null) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FileQuestion className="size-8 text-muted-foreground/50" />
            <div>
              <p className="font-medium">That request no longer exists</p>
              <p className="text-sm text-muted-foreground">
                It may have been removed, or the link may be wrong.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft />
                Start a new request
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const confirmedCount = (rows ?? []).filter(
    (row) => row.track === "confirmed",
  ).length;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6 lg:py-8">
      <RequestHeader
        request={request}
        lineItems={lineItems}
        confirmedCount={confirmedCount}
      />

      <Board requestId={id} />

      {/* Held replies sit directly under the board: they are the reason a row
          still reads "awaiting" when a supplier has in fact written back. */}
      <ReviewQueue requestId={id} />

      <SendGate requestId={id} />
      <Recommendation requestId={id} />
      <Timeline requestId={id} />
    </div>
  );
}
