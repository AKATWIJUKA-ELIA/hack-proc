"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ExternalLink, Info, Search, Trophy } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TrackBadge } from "./status-badge";
import { formatAmount, formatMoney } from "@/lib/format";
import { BOARD_TRACK } from "@/lib/vocabulary";
import { cn } from "@/lib/utils";
import { useSessionToken } from "@/components/auth/auth-provider";

/**
 * The comparison board. A reactive Convex query, so a crawled row appearing —
 * or a confirmed reply upgrading it — happens here with no refresh. That live
 * change is the whole product.
 */
export function Board({ requestId }: { requestId: Id<"requests"> }) {
  const token = useSessionToken();
  const rows = useQuery(
    api.board.forRequest,
    token ? { token, requestId } : "skip",
  );

  if (rows === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comparison board</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const confirmed = rows.filter((row) => row.track === "confirmed").length;
  const priced = rows.filter((row) => row.totalMinor !== null);

  // The cheapest comparable price, so the leading row can be marked. USD
  // normalization is preferred because it is the only way two currencies can
  // honestly be compared; rows without it fall back to their own total.
  const cheapest = priced.reduce<number | null>((low, row) => {
    const cost = row.normalizedUsdMinor ?? row.totalMinor;
    if (cost === null) return low;
    return low === null || cost < low ? cost : low;
  }, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Comparison board
        </CardTitle>
        <CardDescription>
          {rows.length === 0
            ? "Rows appear here the moment a supplier is found."
            : `${rows.length} supplier${rows.length === 1 ? "" : "s"}` +
              (confirmed > 0
                ? ` · ${confirmed} confirmed by reply`
                : " · none confirmed yet")}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
            <Search className="size-6 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No suppliers yet. Discovery adds rows as it finds them.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[12rem]">Supplier</TableHead>
                    <TableHead>Price confidence</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">≈ USD</TableHead>
                    <TableHead className="text-right">Lead time</TableHead>
                    <TableHead className="text-right">Warranty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const cost = row.normalizedUsdMinor ?? row.totalMinor;
                    const leads =
                      cheapest !== null &&
                      cost !== null &&
                      cost === cheapest &&
                      row.totalMinor !== null;

                    return (
                      <TableRow
                        key={row.supplierId}
                        className={cn(leads && "bg-success-bg/40")}
                      >
                        <TableCell>
                          <div className="flex items-start gap-2">
                            {leads && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Trophy className="mt-0.5 size-3.5 shrink-0 cursor-help text-success" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  Lowest comparable price on the board.
                                </TooltipContent>
                              </Tooltip>
                            )}
                            <div className="min-w-0">
                              <div className="font-medium leading-tight">
                                {row.supplierName}
                              </div>
                              {row.supplierDomain && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <span className="truncate">
                                    {row.supplierDomain}
                                  </span>
                                  {row.websiteUrl && (
                                    <a
                                      href={row.websiteUrl}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                      className="shrink-0 hover:text-foreground"
                                      aria-label={`Open ${row.supplierName} website`}
                                    >
                                      <ExternalLink className="size-3" />
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <TrackBadge track={row.track} />
                        </TableCell>

                        <TableCell className="text-right tabular">
                          {row.totalMinor !== null && row.currency !== null ? (
                            <span className="font-medium">
                              <span className="text-xs text-muted-foreground">
                                {row.currency}{" "}
                              </span>
                              {formatAmount(row.totalMinor, row.currency)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell className="text-right tabular">
                          {row.normalizedUsdMinor !== null ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help underline decoration-dotted underline-offset-4">
                                  {formatMoney(row.normalizedUsdMinor, "USD")}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                {row.fxRate !== null && row.fxRateAt !== null
                                  ? `Converted at ${row.fxRate} ${row.currency}/USD from ${
                                      row.fxSource ?? "an unnamed source"
                                    }, snapshotted ${new Date(
                                      row.fxRateAt,
                                    ).toLocaleString()}. The rate is stored with the quote, so this figure cannot drift.`
                                  : "No exchange-rate snapshot was recorded for this quote."}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell className="text-right tabular">
                          {row.leadTimeDays !== null ? (
                            `${row.leadTimeDays} days`
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell className="text-right tabular">
                          {row.warrantyMonths !== null ? (
                            `${row.warrantyMonths} mo`
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Only explain the labels actually present. A key describing
                "Awaiting reply" under a board with no awaiting rows reads as a
                live status rather than a definition. */}
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Info className="size-3.5" />
                What these labels mean
              </p>
              <dl className="grid gap-2 sm:grid-cols-2">
                {Object.entries(BOARD_TRACK)
                  .filter(([track]) => rows.some((row) => row.track === track))
                  .map(([track, entry]) => (
                    <div key={track} className="flex items-start gap-2">
                      <dt className="shrink-0">
                        <TrackBadge track={track} />
                      </dt>
                      <dd className="text-xs leading-relaxed text-muted-foreground">
                        {entry.hint}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
