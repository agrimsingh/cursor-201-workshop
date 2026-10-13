import { DomainError } from "@/lib/domain/errors";
import { invoiceBalance, isOpenInvoice, type InvoiceState } from "@/lib/domain/invoice-status";

// Dispute lifecycle.
//
//   open ──start_review──▶ under_review
//     │                        │
//     ├────────withdraw────────┴──▶ withdrawn
//     │                        │
//     └────────resolve─────────┴──▶ resolved   (admin only: accepted or rejected)
//
// `resolve` goes through POST /api/disputes/:id/resolve, never POST /transitions.

export const DISPUTE_STATUSES = ["open", "under_review", "withdrawn", "resolved"] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const DISPUTE_EVENTS = ["start_review", "withdraw", "resolve"] as const;
export type DisputeEvent = (typeof DISPUTE_EVENTS)[number];

/** Events raised from the dispute page's action buttons via POST /api/disputes/:id/transitions. */
export type DisputeReviewEvent = Exclude<DisputeEvent, "resolve">;

export const DISPUTE_RESOLUTIONS = ["accepted", "rejected"] as const;
export type DisputeResolution = (typeof DISPUTE_RESOLUTIONS)[number];

export const DISPUTE_REASONS = ["pricing", "duplicate", "not_received", "quality", "other"] as const;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];

/** While a dispute is active its invoice is on hold and leaves the collections queue. */
export const ACTIVE_DISPUTE_STATUSES: readonly DisputeStatus[] = ["open", "under_review"];

const TRANSITIONS: Record<DisputeStatus, Partial<Record<DisputeEvent, DisputeStatus>>> = {
  open: { start_review: "under_review", withdraw: "withdrawn", resolve: "resolved" },
  under_review: { withdraw: "withdrawn", resolve: "resolved" },
  withdrawn: {},
  resolved: {},
};

export function isDisputeStatus(value: string): value is DisputeStatus {
  return (DISPUTE_STATUSES as readonly string[]).includes(value);
}

export function asDisputeStatus(value: string): DisputeStatus {
  if (!isDisputeStatus(value)) throw new DomainError("BUSINESS_RULE", `Unknown dispute status "${value}"`);
  return value;
}

export function isActiveDispute(status: string): boolean {
  return (ACTIVE_DISPUTE_STATUSES as readonly string[]).includes(status);
}

export function canTransitionDispute(status: DisputeStatus, event: DisputeEvent): boolean {
  return TRANSITIONS[status][event] !== undefined;
}

export function transitionDispute(status: DisputeStatus, event: DisputeEvent): DisputeStatus {
  const next = TRANSITIONS[status][event];
  if (!next) {
    throw new DomainError("INVALID_TRANSITION", `Cannot ${event.replace("_", " ")} a dispute that is ${status.replace("_", " ")}`, {
      from: status,
      event,
    });
  }
  return next;
}

/** The review actions offered as buttons. Resolving has its own dialog, so it is not listed. */
export function availableDisputeActions(status: DisputeStatus): DisputeReviewEvent[] {
  return DISPUTE_EVENTS.filter(
    (event): event is DisputeReviewEvent => event !== "resolve" && canTransitionDispute(status, event),
  );
}

/**
 * How much to credit when a dispute is resolved. Accepting credits the disputed amount,
 * capped at what is still owed (nothing if the invoice is already settled); rejecting credits nothing.
 */
export function planDisputeResolution(input: {
  resolution: DisputeResolution;
  disputedMinor: number;
  invoiceBalanceMinor: number;
}): { creditNoteMinor: number } {
  if (input.resolution === "rejected" || input.invoiceBalanceMinor <= 0) return { creditNoteMinor: 0 };
  return { creditNoteMinor: Math.max(0, Math.min(input.disputedMinor, input.invoiceBalanceMinor)) };
}

/** Guards for opening a new dispute against an invoice. */
export function assertCanOpenDispute(
  invoice: InvoiceState,
  amountMinor: number,
  existingDisputeStatuses: readonly string[],
): void {
  if (!isOpenInvoice(invoice.status)) {
    throw new DomainError("BUSINESS_RULE", `Cannot dispute an invoice that is ${invoice.status}`, {
      status: invoice.status,
    });
  }
  if (existingDisputeStatuses.some(isActiveDispute)) {
    throw new DomainError("BUSINESS_RULE", "This invoice already has an active dispute");
  }
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new DomainError("BUSINESS_RULE", "The disputed amount must be a positive number of minor units");
  }
  const balance = invoiceBalance(invoice);
  if (amountMinor > balance) {
    throw new DomainError("BUSINESS_RULE", "The disputed amount cannot exceed the invoice balance", {
      amountMinor,
      balanceMinor: balance,
    });
  }
}
