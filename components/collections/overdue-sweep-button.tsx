"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest, errorMessage } from "@/lib/client/api";

/** Runs the overdue sweep now instead of waiting for the nightly job. */
export function OverdueSweepButton() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex items-center gap-3">
      {message ? <span className="text-sm text-slate-500">{message}</span> : null}
      <button
        type="button"
        className="btn-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const result = await apiRequest<{ count: number }>("POST", "/api/invoices/mark-overdue", {});
            setMessage(result.count === 0 ? "Everything is up to date" : `${result.count} invoice(s) marked overdue`);
            router.refresh();
          } catch (error) {
            setMessage(errorMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        Run overdue sweep
      </button>
    </div>
  );
}
