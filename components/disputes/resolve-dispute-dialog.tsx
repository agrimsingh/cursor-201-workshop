"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Dialog, FormError } from "@/components/ui/dialog";
import { apiRequest, errorMessage } from "@/lib/client/api";
import type { DisputeResolution } from "@/lib/domain/dispute-status";
import { formatMoney } from "@/lib/money";

export function ResolveDisputeDialog({
  open,
  onClose,
  disputeId,
  currency,
  creditMinor,
}: {
  open: boolean;
  onClose: () => void;
  disputeId: string;
  currency: string;
  creditMinor: number;
}) {
  const router = useRouter();
  const id = useId();
  const [resolution, setResolution] = useState<DisputeResolution | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!resolution) return;
    setError(null);
    setBusy(true);
    try {
      await apiRequest("POST", `/api/disputes/${disputeId}/resolve`, { resolution, note });
      onClose();
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const options: { value: DisputeResolution; label: string; help: string }[] = [
    {
      value: "accepted",
      label: `Accept: credit ${formatMoney(creditMinor, currency)}`,
      help:
        creditMinor > 0
          ? "Issues a credit note for this amount and settles the invoice."
          : "The invoice has no balance left, so no credit note is issued.",
    },
    {
      value: "rejected",
      label: "Reject: invoice stands",
      help: "No money moves. The invoice goes back into the collections queue.",
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} title="Resolve dispute">
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <fieldset className="flex flex-col gap-2">
          <legend className="label">Outcome</legend>
          {options.map((option) => (
            <div key={option.value} className="flex items-start gap-2 text-sm">
              <input
                id={`${id}-${option.value}`}
                type="radio"
                name={`${id}-resolution`}
                value={option.value}
                checked={resolution === option.value}
                onChange={() => setResolution(option.value)}
                aria-describedby={`${id}-${option.value}-help`}
                required
                className="mt-1"
              />
              <div>
                <label htmlFor={`${id}-${option.value}`} className="font-medium">
                  {option.label}
                </label>
                <p id={`${id}-${option.value}-help`} className="text-xs text-slate-500">
                  {option.help}
                </p>
              </div>
            </div>
          ))}
        </fieldset>
        <div>
          <label className="label" htmlFor={`${id}-note`}>
            Resolution note
          </label>
          <textarea
            id={`${id}-note`}
            className="input min-h-20"
            required
            minLength={5}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            Resolve
          </button>
        </div>
      </form>
    </Dialog>
  );
}
