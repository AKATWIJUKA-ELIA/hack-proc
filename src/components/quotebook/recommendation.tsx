"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { toast } from "sonner";
import { Award, Loader2, Scale, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { errorMessage, formatMoney } from "@/lib/format";
import { useSessionToken } from "@/components/auth/auth-provider";

/**
 * The decision and its reasoning — never a black box.
 *
 * The ranking itself is arithmetic done in the backend; the model only writes
 * the sentence. Every input behind the call is listed here, so the trade-off is
 * auditable rather than asserted.
 */
export function Recommendation({ requestId }: { requestId: Id<"requests"> }) {
  const token = useSessionToken();
  const args = token ? { token, requestId } : ("skip" as const);

  const recommendation = useQuery(api.recommendations.forRequest, args);
  const rows = useQuery(api.board.forRequest, args);
  const recommend = useMutation(api.recommendations.recommend);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (recommendation === undefined) return null;

  // Recommending with nothing priced would burn a model call comparing an
  // empty set. Disable it until there is something to compare.
  const priced = (rows ?? []).filter((row) => row.totalMinor !== null).length;
  const confirmed = (rows ?? []).filter(
    (row) => row.track === "confirmed",
  ).length;

  async function run() {
    setError(null);
    if (!token) {
      setError("Your session has expired. Sign in again to continue.");
      return;
    }
    setBusy(true);
    try {
      await recommend({ token, requestId });
      toast.info("Comparing quotes…", {
        description: "The recommendation appears here when it is ready.",
      });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (recommendation === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="size-4 text-muted-foreground" />
            Recommendation
          </CardTitle>
          <CardDescription>
            Ranked on total landed cost against your delivery window, warranty,
            and whether the price was confirmed by the supplier.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {priced === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Nothing to compare yet — no supplier has a price on the board.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {priced} priced quote{priced === 1 ? "" : "s"} ready to compare
              {confirmed === 0 &&
                " — all of them scraped web prices, so a recommendation now is indicative only"}
              .
            </p>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={run} disabled={busy || priced === 0}>
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Recommend a supplier
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-success/30 bg-success-bg/25">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="size-4 text-success" />
          Recommendation
        </CardTitle>
        <CardDescription>
          Chosen by arithmetic, explained in words. Both are shown.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-lg font-semibold tracking-tight">
            {recommendation.supplierName}
            {recommendation.totalMinor !== null &&
              recommendation.currency !== null && (
                <span className="ml-2 font-normal tabular text-muted-foreground">
                  {formatMoney(
                    recommendation.totalMinor,
                    recommendation.currency,
                  )}
                </span>
              )}
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            {recommendation.rationale}
          </p>
        </div>

        <Alert>
          <Scale />
          <AlertTitle>Trade-off accepted</AlertTitle>
          <AlertDescription>{recommendation.tradeoff}</AlertDescription>
        </Alert>

        <Accordion type="single" collapsible>
          <AccordionItem value="inputs" className="border-b-0">
            <AccordionTrigger className="text-sm">
              What this was decided on
            </AccordionTrigger>
            <AccordionContent>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {recommendation.inputs.map((input) => (
                  <div
                    key={input.label}
                    className="flex items-baseline justify-between gap-3 border-b border-dashed pb-1.5"
                  >
                    <dt className="text-xs text-muted-foreground">
                      {input.label}
                    </dt>
                    <dd className="text-right text-sm font-medium tabular">
                      {input.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button variant="outline" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Re-run with the latest quotes
        </Button>
      </CardContent>
    </Card>
  );
}
