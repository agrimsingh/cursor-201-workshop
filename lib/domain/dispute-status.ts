import { DomainError } from "@/lib/domain/errors";
import { invoiceBalance, isOpenInvoice, type InvoiceState } from "@/lib/domain/invoice-status";

// Dispute lifecycle.
//
//   open ──start_review──▶ under_review
//     │                        │
//     └────────withdraw────────┴──▶ withdrawn
//
// Resolving a dispute is not built yet: see .cursor/plans/resolve-dispute.md.

export const DISPUTE_STATUSES = ["open", "under_review", "withdrawn"] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const DISPUTE_EVENTS = ["start_review", "withdraw"] as const;
export type DisputeEvent = (typeof DISPUTE_EVENTS)[number];

export const DISPUTE_REASONS = ["pricing", "duplicate", "not_received", "quality", "other"] as const;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];

/** While a dispute is active its invoice is on hold and leaves the collections queue. */
export const ACTIVE_DISPUTE_STATUSES: readonly DisputeStatus[] = ["open", "under_review"];

const TRANSITIONS: Record<DisputeStatus, Partial<Record<DisputeEvent, DisputeStatus>>> = {
  open: { start_review: "under_review", withdraw: "withdrawn" },
  under_review: { withdraw: "withdrawn" },
  withdrawn: {},
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

export function availableDisputeActions(status: DisputeStatus): DisputeEvent[] {
  return DISPUTE_EVENTS.filter((event) => canTransitionDispute(status, event));
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
