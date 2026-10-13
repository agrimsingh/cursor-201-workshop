"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/ui/dialog";
import { apiRequest, errorMessage } from "@/lib/client/api";
import type { DisputeReviewEvent } from "@/lib/domain/dispute-status";

const LABELS: Record<DisputeReviewEvent, string> = {
  start_review: "Start review",
  withdraw: "Mark withdrawn",
};

export function DisputeActions({ disputeId, actions }: { disputeId: string; actions: DisputeReviewEvent[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: DisputeReviewEvent) {
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

  if (actions.length === 0) return null;
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
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
    </div>
  );
}
