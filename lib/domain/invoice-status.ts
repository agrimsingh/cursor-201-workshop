import { daysBetween } from "@/lib/domain/dates";
import { DomainError } from "@/lib/domain/errors";

// Invoice lifecycle.
//
//   draft ──send──▶ sent ──settle──▶ partially_paid ──settle──▶ paid
//     │              │  ╲                 │                      ▲
//     │              │   mark_overdue     mark_overdue            │
//     │              │        ▼           ▼                       │
//     └──void──▶ void ◀─void── overdue ───────────settle──────────┘
//
// "settle" is raised after a payment allocation or credit note changes the balance;
// the target status is derived from the new balance and the due date.

export const INVOICE_STATUSES = ["draft", "sent", "partially_paid", "paid", "overdue", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_EVENTS = ["send", "void", "mark_overdue", "settle"] as const;
export type InvoiceEvent = (typeof INVOICE_EVENTS)[number];

export interface InvoiceState {
  status: InvoiceStatus;
  totalMinor: number;
  amountPaidMinor: number;
  amountCreditedMinor: number;
  dueDate: Date;
}

const ALLOWED_EVENTS: Record<InvoiceStatus, readonly InvoiceEvent[]> = {
  draft: ["send", "void"],
  sent: ["settle", "mark_overdue", "void"],
  partially_paid: ["settle", "mark_overdue"],
  overdue: ["settle", "void"],
  paid: [],
  void: [],
};

/** Statuses that can still receive payments, credit notes and disputes. */
export const OPEN_INVOICE_STATUSES: readonly InvoiceStatus[] = ["sent", "partially_paid", "overdue"];

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return (INVOICE_STATUSES as readonly string[]).includes(value);
}

export function asInvoiceStatus(value: string): InvoiceStatus {
  if (!isInvoiceStatus(value)) throw new DomainError("BUSINESS_RULE", `Unknown invoice status "${value}"`);
  return value;
}

export function isOpenInvoice(status: InvoiceStatus): boolean {
  return OPEN_INVOICE_STATUSES.includes(status);
}

export function invoiceBalance(state: Pick<InvoiceState, "totalMinor" | "amountPaidMinor" | "amountCreditedMinor">): number {
  return state.totalMinor - state.amountPaidMinor - state.amountCreditedMinor;
}

export function isPastDue(dueDate: Date, asOf: Date): boolean {
  return daysBetween(dueDate, asOf) > 0;
}

function settledStatus(state: InvoiceState, asOf: Date): InvoiceStatus {
  const balance = invoiceBalance(state);
  if (balance < 0) {
    throw new DomainError("OVER_ALLOCATION", "Payments and credits exceed the invoice total", {
      totalMinor: state.totalMinor,
      balanceMinor: balance,
    });
  }
  if (balance === 0) return "paid";
  if (isPastDue(state.dueDate, asOf)) return "overdue";
  if (state.amountPaidMinor > 0 || state.amountCreditedMinor > 0) return "partially_paid";
  return "sent";
}

function assertGuards(state: InvoiceState, event: InvoiceEvent, asOf: Date): void {
  switch (event) {
    case "send":
      if (state.totalMinor <= 0) {
        throw new DomainError("BUSINESS_RULE", "An invoice must have a positive total before it is sent");
      }
      return;
    case "void":
      if (state.amountPaidMinor > 0) {
        throw new DomainError("BUSINESS_RULE", "Invoices with payments applied cannot be voided", {
          amountPaidMinor: state.amountPaidMinor,
        });
      }
      return;
    case "mark_overdue":
      if (!isPastDue(state.dueDate, asOf)) {
        throw new DomainError("BUSINESS_RULE", "Only invoices past their due date can be marked overdue");
      }
      if (invoiceBalance(state) <= 0) {
        throw new DomainError("BUSINESS_RULE", "Invoices with no balance cannot be overdue");
      }
      return;
    case "settle":
      return;
  }
}

export function canTransition(status: InvoiceStatus, event: InvoiceEvent): boolean {
  return ALLOWED_EVENTS[status].includes(event);
}

/** Returns the next status, or throws a DomainError if the event is not allowed. */
export function transitionInvoice(state: InvoiceState, event: InvoiceEvent, asOf: Date): InvoiceStatus {
  if (!canTransition(state.status, event)) {
    throw new DomainError("INVALID_TRANSITION", `Cannot ${event.replace("_", " ")} an invoice that is ${state.status}`, {
      from: state.status,
      event,
    });
  }
  assertGuards(state, event, asOf);
  switch (event) {
    case "send":
      return isPastDue(state.dueDate, asOf) ? "overdue" : "sent";
    case "void":
      return "void";
    case "mark_overdue":
      return "overdue";
    case "settle":
      return settledStatus(state, asOf);
  }
}

/** User-triggered actions the UI should offer for an invoice in this state. */
export function availableInvoiceActions(state: InvoiceState, asOf: Date): ("send" | "void")[] {
  return (["send", "void"] as const).filter((event) => {
    if (!canTransition(state.status, event)) return false;
    try {
      assertGuards(state, event, asOf);
      return true;
    } catch {
      return false;
    }
  });
}
