"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ResolveDisputeDialog } from "@/components/disputes/resolve-dispute-dialog";
import { FormError } from "@/components/ui/dialog";
import { apiRequest, errorMessage } from "@/lib/client/api";
import type { DisputeEvent } from "@/lib/domain/dispute-status";

const LABELS: Record<DisputeEvent, string> = {
  start_review: "Start review",
  withdraw: "Mark withdrawn",
};

export function DisputeActions({
  disputeId,
  actions,
  resolve,
}: {
  disputeId: string;
  actions: DisputeEvent[];
  resolve: { currency: string; creditMinor: number } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  async function run(action: DisputeEvent) {
    setBusy(true);
    setError(null);
    try {
      await apiRequest("POST", `/api/disputes/${disputeId}/transitions`, { action });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (actions.length === 0 && !resolve) return null;
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {resolve ? (
          <button type="button" className="btn-primary" disabled={busy} onClick={() => setResolving(true)}>
            Resolve dispute
          </button>
        ) : null}
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            className={action === "withdraw" ? "btn-secondary" : "btn-primary"}
            disabled={busy}
            onClick={() => run(action)}
          >
            {LABELS[action]}
          </button>
        ))}
      </div>
      <FormError message={error} />
      {resolve ? (
        <ResolveDisputeDialog
          open={resolving}
          onClose={() => setResolving(false)}
          disputeId={disputeId}
          currency={resolve.currency}
          creditMinor={resolve.creditMinor}
        />
      ) : null}
    </div>
  );
}
