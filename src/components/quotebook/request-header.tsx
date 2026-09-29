"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  Loader2,
  MapPin,
  RotateCcw,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusBadge } from "./status-badge";
import { PipelineProgress } from "./pipeline-progress";
import { errorMessage, formatMoney } from "@/lib/format";
import { useSessionToken } from "@/components/auth/auth-provider";

type LineItem = Doc<"lineItems">;

export function RequestHeader({
  request,
  lineItems,
  confirmedCount,
}: {
  request: Doc<"requests">;
  lineItems: LineItem[] | undefined;
  confirmedCount: number;
}) {
  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">
              {request.title}
            </h1>
            <p className="text-sm text-muted-foreground text-pretty">
              {request.rawText}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <StatusBadge status={request.status} />
            {/* "Waiting on replies" stops being the whole truth the moment one
                arrives. The status stays `collecting` because other suppliers
                may still answer, so the arrival is surfaced beside it rather
                than by overloading the status itself. */}
            {confirmedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success-bg px-2.5 py-0.5 text-xs font-medium text-success">
                {confirmedCount} quote{confirmedCount === 1 ? "" : "s"} in
              </span>
            )}
          </div>
        </div>

        <PipelineProgress status={request.status} />

        {request.status === "failed" && (
          <RetryRequest
            requestId={request._id}
            reason={request.failureReason ?? "This request failed."}
          />
        )}

        <dl className="grid gap-3 sm:grid-cols-3">
          <Fact icon={MapPin} label="Deliver to" value={request.deliverTo} />
          <Fact
            icon={CalendarClock}
            label="Delivery window"
            value={
              request.deliveryWindowDays !== undefined
                ? `${request.deliveryWindowDays} days`
                : "Not stated"
            }
            muted={request.deliveryWindowDays === undefined}
          />
          <Fact
            icon={Wallet}
            label="Budget ceiling"
            value={
              request.budgetMinor !== undefined
                ? formatMoney(request.budgetMinor, request.currency)
                : `Not stated (${request.currency})`
            }
            muted={request.budgetMinor === undefined}
          />
        </dl>

        {lineItems && lineItems.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Line items
            </h2>
            <ul className="divide-y rounded-lg border">
              {lineItems.map((item) => (
                <li
                  key={item._id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2.5"
                >
                  <span className="tabular text-sm font-semibold">
                    {item.quantity.toLocaleString()}
                    {item.unit ? ` ${item.unit}` : " ×"}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    {item.description}
                  </span>
                  {(() => {
                    // The extractor sometimes files a delivery or commercial
                    // fact under `specs`. Those already have their own cards
                    // above, and showing "deliveryLocation: Kampala" beside
                    // "cpu: i7" reads as a hardware specification, which it is
                    // not. Keep the chips to what describes the product.
                    const specs = Object.entries(item.specs ?? {}).filter(
                      ([key]) =>
                        !/^(delivery|deliver|location|destination|budget|currency|leadtime|lead_time|quantity)/i.test(
                          key,
                        ),
                    );
                    if (specs.length === 0) return null;

                    return (
                      <span className="flex flex-wrap gap-1">
                        {specs.map(([key, value]) => (
                          <span
                            key={key}
                            className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {key}: {value}
                          </span>
                        ))}
                      </span>
                    );
                  })()}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </dt>
      <dd
        className={
          muted
            ? "mt-0.5 text-sm text-muted-foreground"
            : "mt-0.5 text-sm font-medium"
        }
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * A failed request is recoverable, not a dead end. The reason is shown in full
 * — a rate limit and a search that found nothing need different responses from
 * the person reading it.
 */
function RetryRequest({
  requestId,
  reason,
}: {
  requestId: Id<"requests">;
  reason: string;
}) {
  const retry = useMutation(api.requests.retry);
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
      await retry({ token, requestId });
      toast.success("Retrying this request.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertTitle>This request stopped</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{reason}</p>
        {error && <p className="font-medium">{error}</p>}
        <Button variant="outline" size="sm" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <RotateCcw />}
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
