"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Dialog, FormError } from "@/components/ui/dialog";
import { apiRequest, errorMessage } from "@/lib/client/api";
import { CREDIT_NOTE_REASONS } from "@/lib/domain/credit-notes";
import { DISPUTE_REASONS } from "@/lib/domain/dispute-status";
import type { Capability } from "@/lib/domain/permissions";
import { humanize } from "@/lib/format";
import { asCurrency, parseMoney, toDecimalString } from "@/lib/money";

interface Props {
  invoiceId: string;
  customerId: string;
  currency: string;
  balanceMinor: number;
  isOpen: boolean;
  hasActiveDispute: boolean;
  actions: ("send" | "void")[];
  capabilities: Capability[];
}

export function InvoiceActions(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"credit" | "dispute" | null>(null);
  const can = (capability: Capability) => props.capabilities.includes(capability);

  async function transition(action: "send" | "void") {
    if (action === "void" && !window.confirm("Void this invoice? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest("POST", `/api/invoices/${props.invoiceId}/transitions`, { action });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {props.actions.includes("send") && can("invoices:send") ? (
          <button type="button" className="btn-primary" disabled={busy} onClick={() => transition("send")}>
            Send invoice
          </button>
        ) : null}
        {props.isOpen && can("payments:record") ? (
          <Link className="btn-primary" href={`/payments/new?customerId=${props.customerId}&invoiceId=${props.invoiceId}`}>
            Record payment
          </Link>
        ) : null}
        {props.isOpen && can("credit_notes:issue") ? (
          <button type="button" className="btn-secondary" onClick={() => setDialog("credit")}>
            Issue credit note
          </button>
        ) : null}
        {props.isOpen && !props.hasActiveDispute && can("disputes:open") ? (
          <button type="button" className="btn-secondary" onClick={() => setDialog("dispute")}>
            Open dispute
          </button>
        ) : null}
        {props.actions.includes("void") && can("invoices:void") ? (
          <button type="button" className="btn-danger" disabled={busy} onClick={() => transition("void")}>
            Void
          </button>
        ) : null}
      </div>
      <FormError message={error} />

      <Dialog open={dialog === "credit"} onClose={() => setDialog(null)} title="Issue credit note">
        <AmountReasonForm
          currency={props.currency}
          maxMinor={props.balanceMinor}
          reasons={CREDIT_NOTE_REASONS}
          submitLabel="Issue credit note"
          onCancel={() => setDialog(null)}
          onSubmit={async ({ amountMinor, reason }) => {
            await apiRequest("POST", "/api/credit-notes", { invoiceId: props.invoiceId, amountMinor, reason });
            setDialog(null);
            router.refresh();
          }}
        />
      </Dialog>

      <Dialog open={dialog === "dispute"} onClose={() => setDialog(null)} title="Open dispute">
        <AmountReasonForm
          currency={props.currency}
          maxMinor={props.balanceMinor}
          reasons={DISPUTE_REASONS}
          withDescription
          submitLabel="Open dispute"
          onCancel={() => setDialog(null)}
          onSubmit={async ({ amountMinor, reason, description }) => {
            await apiRequest("POST", "/api/disputes", { invoiceId: props.invoiceId, amountMinor, reason, description });
            setDialog(null);
            router.refresh();
          }}
        />
      </Dialog>
    </div>
  );
}

function AmountReasonForm({
  currency,
  maxMinor,
  reasons,
  withDescription,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  currency: string;
  maxMinor: number;
  reasons: readonly string[];
  withDescription?: boolean;
  submitLabel: string;
  onSubmit: (values: { amountMinor: number; reason: string; description: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const code = asCurrency(currency);
  const id = useId();
  const [amount, setAmount] = useState(toDecimalString(maxMinor, code));
  const [reason, setReason] = useState(reasons[0]);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit({ amountMinor: parseMoney(amount, code), reason, description });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <div>
        <label className="label" htmlFor={`${id}-amount`}>
          Amount ({currency}) · balance {toDecimalString(maxMinor, code)}
        </label>
        <input id={`${id}-amount`} className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor={`${id}-reason`}>
          Reason
        </label>
        <select id={`${id}-reason`} className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
          {reasons.map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </select>
      </div>
      {withDescription ? (
        <div>
          <label className="label" htmlFor={`${id}-description`}>
            What is the customer disputing?
          </label>
          <textarea
            id={`${id}-description`}
            className="input min-h-20"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      ) : null}
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
