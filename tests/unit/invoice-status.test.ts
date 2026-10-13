import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/domain/dates";
import { DomainError } from "@/lib/domain/errors";
import {
  availableInvoiceActions,
  canTransition,
  INVOICE_EVENTS,
  INVOICE_STATUSES,
  invoiceBalance,
  transitionInvoice,
  type InvoiceState,
} from "@/lib/domain/invoice-status";

const asOf = new Date("2026-06-30T10:00:00Z");

function invoice(overrides: Partial<InvoiceState> = {}): InvoiceState {
  return {
    status: "sent",
    totalMinor: 100_000,
    amountPaidMinor: 0,
    amountCreditedMinor: 0,
    dueDate: addDays(asOf, 10),
    ...overrides,
  };
}

function expectDomainError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`Expected DomainError ${code}`);
}

describe("invoice state machine", () => {
  it("allows exactly the documented transitions", () => {
    const allowed = Object.fromEntries(
      INVOICE_STATUSES.map((status) => [status, INVOICE_EVENTS.filter((event) => canTransition(status, event))]),
    );
    expect(allowed).toEqual({
      draft: ["send", "void"],
      sent: ["void", "mark_overdue", "settle"],
      partially_paid: ["mark_overdue", "settle"],
      paid: [],
      overdue: ["void", "settle"],
      void: [],
    });
  });

  it("sends a draft, or makes it overdue straight away if already past due", () => {
    expect(transitionInvoice(invoice({ status: "draft" }), "send", asOf)).toBe("sent");
    expect(transitionInvoice(invoice({ status: "draft", dueDate: addDays(asOf, -1) }), "send", asOf)).toBe("overdue");
  });

  it("will not send a zero-value invoice", () => {
    expectDomainError(() => transitionInvoice(invoice({ status: "draft", totalMinor: 0 }), "send", asOf), "BUSINESS_RULE");
  });

  it("derives the settled status from balance and due date", () => {
    expect(transitionInvoice(invoice({ amountPaidMinor: 40_000 }), "settle", asOf)).toBe("partially_paid");
    expect(transitionInvoice(invoice({ amountCreditedMinor: 100_000 }), "settle", asOf)).toBe("paid");
    expect(transitionInvoice(invoice({ amountPaidMinor: 60_000, amountCreditedMinor: 40_000 }), "settle", asOf)).toBe("paid");
    expect(
      transitionInvoice(invoice({ status: "overdue", amountPaidMinor: 10_000, dueDate: addDays(asOf, -5) }), "settle", asOf),
    ).toBe("overdue");
  });

  it("never lets payments and credits exceed the total", () => {
    expectDomainError(() => transitionInvoice(invoice({ amountPaidMinor: 100_001 }), "settle", asOf), "OVER_ALLOCATION");
  });

  it("only marks invoices overdue after the due date", () => {
    expectDomainError(() => transitionInvoice(invoice(), "mark_overdue", asOf), "BUSINESS_RULE");
    expectDomainError(() => transitionInvoice(invoice({ dueDate: asOf }), "mark_overdue", asOf), "BUSINESS_RULE");
    expect(transitionInvoice(invoice({ dueDate: addDays(asOf, -1) }), "mark_overdue", asOf)).toBe("overdue");
  });

  it("refuses to void once money has been applied", () => {
    expectDomainError(
      () => transitionInvoice(invoice({ status: "overdue", amountPaidMinor: 1, dueDate: addDays(asOf, -3) }), "void", asOf),
      "BUSINESS_RULE",
    );
    expect(transitionInvoice(invoice({ amountCreditedMinor: 5_000 }), "void", asOf)).toBe("void");
  });

  it("treats paid and void as terminal", () => {
    for (const status of ["paid", "void"] as const) {
      for (const event of INVOICE_EVENTS) {
        expectDomainError(() => transitionInvoice(invoice({ status }), event, asOf), "INVALID_TRANSITION");
      }
    }
  });

  it("offers only actions that would succeed", () => {
    expect(availableInvoiceActions(invoice({ status: "draft" }), asOf)).toEqual(["send", "void"]);
    expect(availableInvoiceActions(invoice({ status: "partially_paid", amountPaidMinor: 1 }), asOf)).toEqual([]);
    expect(availableInvoiceActions(invoice({ status: "sent" }), asOf)).toEqual(["void"]);
  });

  it("computes the balance", () => {
    expect(invoiceBalance({ totalMinor: 1_000, amountPaidMinor: 250, amountCreditedMinor: 100 })).toBe(650);
  });
});
