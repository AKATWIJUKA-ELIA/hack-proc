"use client";

import { cn } from "@/lib/utils";
import { REQUEST_STATUS, BOARD_TRACK, VERIFICATION } from "@/lib/vocabulary";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const TONE: Record<string, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  busy: "bg-track-web-bg text-track-web border-track-web/25",
  action: "bg-warning-bg text-warning border-warning/25",
  good: "bg-success-bg text-success border-success/25",
  bad: "bg-destructive/10 text-destructive border-destructive/25",
};

function Pill({
  className,
  children,
  dot,
  pulse,
}: {
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 shrink-0 rounded-full bg-current",
            pulse && "animate-live",
          )}
        />
      )}
      {children}
    </span>
  );
}

/** The request's place in the pipeline, in the buyer's words. */
export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const entry = REQUEST_STATUS[status] ?? {
    label: status.replace(/_/g, " "),
    hint: "",
    tone: "neutral" as const,
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Pill
          dot
          pulse={entry.tone === "busy"}
          className={cn(TONE[entry.tone], "cursor-help", className)}
        >
          {entry.label}
        </Pill>
      </TooltipTrigger>
      {entry.hint && (
        <TooltipContent className="max-w-xs">{entry.hint}</TooltipContent>
      )}
    </Tooltip>
  );
}

const TRACK_TONE: Record<string, string> = {
  confirmed: "bg-track-confirmed-bg text-track-confirmed border-track-confirmed/25",
  "web price": "bg-track-web-bg text-track-web border-track-web/25",
  awaiting: "bg-track-awaiting-bg text-track-awaiting border-track-awaiting/25",
  "no price": "bg-track-none-bg text-track-none border-track-none/25",
};

/**
 * How much a price on the board is worth. This is the single most important
 * distinction in the app — a scraped listing and a supplier's own written
 * quote must never look alike.
 */
export function TrackBadge({
  track,
  className,
}: {
  track: string;
  className?: string;
}) {
  const entry = BOARD_TRACK[track] ?? { label: track, hint: "" };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Pill
          dot
          pulse={track === "awaiting"}
          className={cn(TRACK_TONE[track], "cursor-help", className)}
        >
          {entry.label}
        </Pill>
      </TooltipTrigger>
      {entry.hint && (
        <TooltipContent className="max-w-xs">{entry.hint}</TooltipContent>
      )}
    </Tooltip>
  );
}

const VERIFICATION_TONE: Record<string, string> = {
  unverified: "bg-muted text-muted-foreground border-border",
  mx_valid: "bg-success-bg text-success border-success/25",
  mx_invalid: "bg-destructive/10 text-destructive border-destructive/25",
  bounced: "bg-destructive/10 text-destructive border-destructive/25",
};

/** Whether an address we found will actually accept mail. */
export function VerificationBadge({
  verification,
  className,
}: {
  verification: string;
  className?: string;
}) {
  const entry = VERIFICATION[verification] ?? {
    label: verification.replace(/_/g, " "),
    hint: "",
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Pill
          className={cn(
            VERIFICATION_TONE[verification] ?? VERIFICATION_TONE.unverified,
            "cursor-help",
            className,
          )}
        >
          {entry.label}
        </Pill>
      </TooltipTrigger>
      {entry.hint && (
        <TooltipContent className="max-w-xs">{entry.hint}</TooltipContent>
      )}
    </Tooltip>
  );
}

const RFQ_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  approved: "bg-track-web-bg text-track-web border-track-web/25",
  sent: "bg-track-web-bg text-track-web border-track-web/25",
  replied: "bg-success-bg text-success border-success/25",
  bounced: "bg-destructive/10 text-destructive border-destructive/25",
  cancelled: "bg-muted text-muted-foreground border-border",
  failed: "bg-destructive/10 text-destructive border-destructive/25",
};

export function RfqStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Pill className={cn(RFQ_TONE[status] ?? RFQ_TONE.draft, className)}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Pill>
  );
}
