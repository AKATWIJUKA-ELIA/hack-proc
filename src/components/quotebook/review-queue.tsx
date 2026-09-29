"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { toast } from "sonner";
import { Inbox, Loader2, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { errorMessage, formatTime } from "@/lib/format";
import { useSessionToken } from "@/components/auth/auth-provider";

type HeldReply = {
  _id: Id<"inboundParses">;
  reason: string;
  fromAddress: string | null;
  preview: string;
  supplierName: string;
  receivedAt: number;
};

/**
 * Replies that arrived but did not become quotes.
 *
 * Without this the messy path is invisible: a supplier replies, the board still
 * reads "awaiting", and nothing on screen explains why. Handling the awkward
 * reply in the open is the point — the alternative is silently dropping it.
 */
export function ReviewQueue({ requestId }: { requestId: Id<"requests"> }) {
  const token = useSessionToken();
  const held = useQuery(
    api.inbound.reviewQueueForRequest,
    token ? { token, requestId } : "skip",
  );

  if (held === undefined || held.length === 0) return null;

  return (
    <Card className="border-warning/40 bg-warning-bg/25">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="size-4 text-warning" />
          Needs your review
        </CardTitle>
        <CardDescription>
          {held.length} repl{held.length === 1 ? "y" : "ies"} arrived but could
          not be turned into a quote automatically.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ul className="space-y-3">
          {held.map((item) => (
            <ReviewItem key={item._id} item={item} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ReviewItem({ item }: { item: HeldReply }) {
  const release = useMutation(api.inbound.releaseForParsing);
  const token = useSessionToken();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    if (!token) {
      setError("Your session has expired. Sign in again to continue.");
      return;
    }
    setBusy(true);
    try {
      await release({ token, parseId: item._id });
      toast.success("Reading the message for a price…");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-medium">{item.supplierName}</span>
        {item.fromAddress && (
          <span className="font-mono text-xs text-muted-foreground">
            {item.fromAddress}
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {formatTime(item.receivedAt)}
        </span>
      </div>

      <Alert className="mt-2">
        <ShieldQuestion />
        <AlertDescription>{item.reason}</AlertDescription>
      </Alert>

      {item.preview && (
        <Accordion type="single" collapsible className="mt-1">
          <AccordionItem value="body" className="border-b-0">
            <AccordionTrigger className="py-2 text-xs">
              Read the message
            </AccordionTrigger>
            <AccordionContent>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                {item.preview}
              </pre>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        variant="secondary"
        size="sm"
        onClick={run}
        disabled={busy}
        className="mt-2"
      >
        {busy ? <Loader2 className="animate-spin" /> : null}
        I trust this sender — read it for a price
      </Button>
    </li>
  );
}
