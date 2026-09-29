"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { toast } from "sonner";
import {
  AlertTriangle,
  Eye,
  Loader2,
  Mail,
  MailCheck,
  RotateCcw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RfqStatusBadge, VerificationBadge } from "./status-badge";
import { errorMessage, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSessionToken } from "@/components/auth/auth-provider";

// Shown when a mutation is attempted after the session has lapsed.
const EXPIRED = "Your session has expired. Sign in again to continue.";

// Mirrors the cap enforced in the `approveAndSend` mutation. The server is the
// authority; this only lets the button explain itself before the click.
const MAX_RECIPIENTS = 5;

type Recipient = {
  _id: Id<"rfqs">;
  status: string;
  subject: string;
  body: string;
  chaseCount: number;
  sentAt?: number;
  repliedAt?: number;
  failureReason: string | null;
  supplierName: string;
  supplierDomain: string;
  email: string | null;
  verification: string;
};

/**
 * The one human checkpoint. The exact recipient list is on screen, capped at
 * five, and nothing leaves without a deliberate click.
 */
export function SendGate({ requestId }: { requestId: Id<"requests"> }) {
  const token = useSessionToken();
  const rfqs = useQuery(
    api.rfqs.listForRequest,
    token ? { token, requestId } : "skip",
  );
  const approveAndSend = useMutation(api.rfqs.approveAndSend);
  const [selected, setSelected] = useState<Set<Id<"rfqs">>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (rfqs === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Send gate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const drafts = rfqs.filter((rfq) => rfq.status === "draft");
  // "approved" means approved but never dispatched — stalled, not sent. It
  // belongs with the failures, because the recovery is identical.
  const stalled = rfqs.filter(
    (rfq) => rfq.status === "failed" || rfq.status === "approved",
  );
  const dispatched = rfqs.filter(
    (rfq) =>
      rfq.status !== "draft" &&
      rfq.status !== "failed" &&
      rfq.status !== "approved",
  );
  const reachable = drafts.filter((rfq) => rfq.email !== null);

  function toggle(rfqId: Id<"rfqs">) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(rfqId)) next.delete(rfqId);
      else if (next.size < MAX_RECIPIENTS) next.add(rfqId);
      return next;
    });
  }

  function selectAllReachable() {
    setSelected(
      new Set(reachable.slice(0, MAX_RECIPIENTS).map((rfq) => rfq._id)),
    );
  }

  async function send() {
    setError(null);
    if (!token) {
      setError(EXPIRED);
      return;
    }
    setBusy(true);
    const count = selected.size;
    try {
      await approveAndSend({ token, requestId, rfqIds: [...selected] });
      setSelected(new Set());
      toast.success(
        `${count} request${count === 1 ? "" : "s"} for quotation sent.`,
        { description: "Replies are read automatically as they arrive." },
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" />
          Send gate
        </CardTitle>
        <CardDescription>
          Real email to real businesses. Nothing sends without your click.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {drafts.length === 0 && dispatched.length === 0 && stalled.length === 0 && (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            No suppliers are linked to this request yet. Discovery adds them as
            it finds them.
          </p>
        )}

        {/* The exact dead end that used to strand a request: suppliers exist,
            none has an address, so there is nothing to approve. Say so, and
            offer the way out rather than showing an empty panel. */}
        {drafts.length > 0 && reachable.length === 0 && (
          <Alert>
            <AlertTriangle />
            <AlertDescription>
              None of these suppliers published an email address we could find.
              Add one below and the request for quotation becomes sendable.
            </AlertDescription>
          </Alert>
        )}

        {drafts.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">
                Ready to contact
                <span className="ml-2 font-normal text-muted-foreground">
                  {selected.size} of {MAX_RECIPIENTS} selected
                </span>
              </h3>
              {reachable.length > 1 && selected.size < reachable.length && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllReachable}
                  className="h-7 text-xs"
                >
                  Select {Math.min(reachable.length, MAX_RECIPIENTS)}
                </Button>
              )}
            </div>

            <ul className="space-y-2">
              {drafts.map((rfq) => (
                <RecipientRow
                  key={rfq._id}
                  rfq={rfq}
                  checked={selected.has(rfq._id)}
                  disabled={
                    rfq.email === null ||
                    (!selected.has(rfq._id) && selected.size >= MAX_RECIPIENTS)
                  }
                  onToggle={() => toggle(rfq._id)}
                />
              ))}
            </ul>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {reachable.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              onClick={send}
              disabled={busy || selected.size === 0}
            >
              {busy ? (
                <>
                  <Loader2 className="animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send />
                  {selected.size === 0
                    ? "Select a supplier to contact"
                    : `Approve and send ${selected.size} RFQ${
                        selected.size === 1 ? "" : "s"
                      }`}
                </>
              )}
            </Button>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-px size-4 shrink-0 text-success" />
              <span>
                You are approving these exact addresses. Read any draft first
                with “Preview email”.
              </span>
            </p>
          </div>
        )}

        {stalled.length > 0 && (
          <>
            <Separator />
            <FailedSends requestId={requestId} failed={stalled} />
          </>
        )}

        {dispatched.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <MailCheck className="size-4 text-muted-foreground" />
                Sent
              </h3>
              <ul className="space-y-1.5">
                {dispatched.map((rfq) => (
                  <li
                    key={rfq._id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{rfq.supplierName}</span>
                    <RfqStatusBadge status={rfq.status} />
                    {rfq.sentAt && (
                      <span className="text-xs text-muted-foreground">
                        {formatTime(rfq.sentAt)}
                      </span>
                    )}
                    {rfq.chaseCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        followed up {rfq.chaseCount}×
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Sends that errored before leaving. The approval is still on record, so the
 * way back is one button — not re-ticking the same boxes.
 */
function FailedSends({
  requestId,
  failed,
}: {
  requestId: Id<"requests">;
  failed: Recipient[];
}) {
  const retrySend = useMutation(api.rfqs.retrySend);
  const token = useSessionToken();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setError(null);
    if (!token) {
      setError(EXPIRED);
      return;
    }
    setBusy(true);
    try {
      const recovered = await retrySend({ token, requestId });
      toast.success(
        `Retrying ${recovered} send${recovered === 1 ? "" : "s"}.`,
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  // The same reason repeated on every row is noise; show it once.
  const reasons = [
    ...new Set(failed.map((rfq) => rfq.failureReason).filter(Boolean)),
  ] as string[];

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="size-4 text-destructive" />
        Did not send
      </h3>

      <Alert variant="destructive">
        <AlertDescription>
          {reasons.length === 1
            ? reasons[0]
            : `${failed.length} request${
                failed.length === 1 ? " was" : "s were"
              } approved but never left.`}
        </AlertDescription>
      </Alert>

      <ul className="space-y-1.5">
        {failed.map((rfq) => (
          <li
            key={rfq._id}
            className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <span className="font-medium">{rfq.supplierName}</span>
            {rfq.email && (
              <span className="font-mono text-xs text-muted-foreground">
                {rfq.email}
              </span>
            )}
            <RfqStatusBadge status={rfq.failureReason ? "failed" : "approved"} />
            {reasons.length > 1 && rfq.failureReason && (
              <span className="text-xs text-muted-foreground">
                {rfq.failureReason}
              </span>
            )}
          </li>
        ))}
      </ul>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button variant="outline" onClick={retry} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <RotateCcw />}
        Retry {failed.length} send{failed.length === 1 ? "" : "s"}
      </Button>
    </div>
  );
}

function RecipientRow({
  rfq,
  checked,
  disabled,
  onToggle,
}: {
  rfq: Recipient;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const addContact = useMutation(api.rfqs.addContact);
  const clearContact = useMutation(api.rfqs.clearContact);
  const token = useSessionToken();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError(EXPIRED);
      return;
    }
    setBusy(true);
    try {
      await addContact({ token, rfqId: rfq._id, email });
      setEmail("");
      toast.success(`Address added for ${rfq.supplierName}.`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const unreachable = rfq.email === null;

  return (
    <li
      className={cn(
        "rounded-lg border p-3 transition-colors",
        checked && "border-primary/40 bg-accent/40",
        unreachable && "border-dashed bg-muted/20",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Checkbox
          id={`select-${rfq._id}`}
          checked={checked}
          onCheckedChange={onToggle}
          disabled={disabled}
          aria-label={`Contact ${rfq.supplierName}`}
        />

        <Label
          htmlFor={`select-${rfq._id}`}
          className={cn(
            "min-w-0 flex-1 cursor-pointer flex-col items-start gap-0",
            disabled && "cursor-not-allowed",
          )}
        >
          <span className="font-medium">{rfq.supplierName}</span>
          {rfq.supplierDomain && (
            <span className="text-xs font-normal text-muted-foreground">
              {rfq.supplierDomain}
            </span>
          )}
        </Label>

        {rfq.email ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{rfq.email}</span>
            <VerificationBadge verification={rfq.verification} />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={!token}
              onClick={() => {
                if (token) void clearContact({ token, rfqId: rfq._id });
              }}
            >
              Change
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            No address found
          </span>
        )}

        <PreviewEmail rfq={rfq} />
      </div>

      {unreachable && (
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={add}>
          <Label htmlFor={`email-${rfq._id}`} className="sr-only">
            Email address for {rfq.supplierName}
          </Label>
          <Input
            id={`email-${rfq._id}`}
            type="email"
            placeholder={`sales@${rfq.supplierDomain || "supplier.com"}`}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="h-9 min-w-0 flex-1 font-mono text-xs"
          />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={busy || email.trim().length === 0}
          >
            {busy ? <Loader2 className="animate-spin" /> : null}
            Add address
          </Button>
        </form>
      )}

      {error && (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      )}
    </li>
  );
}

/**
 * The draft, verbatim. Approving an email you have not read is not really
 * approval, so the exact text that will be sent is one click away.
 */
function PreviewEmail({ rfq }: { rfq: Recipient }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          <Eye className="size-3" />
          Preview
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Email to {rfq.supplierName}</DialogTitle>
          <DialogDescription>
            This is exactly what will be sent
            {rfq.email ? ` to ${rfq.email}` : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Subject
            </p>
            <p className="mt-1 text-sm font-medium">{rfq.subject}</p>
          </div>
          <div className="rounded-lg border p-3">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {rfq.body}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
