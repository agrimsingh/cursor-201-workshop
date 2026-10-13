import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/domain/dates";
import {
  assertCanOpenDispute,
  availableDisputeActions,
  isActiveDispute,
  planDisputeResolution,
  transitionDispute,
} from "@/lib/domain/dispute-status";
import { DomainError } from "@/lib/domain/errors";
import type { InvoiceState } from "@/lib/domain/invoice-status";

const asOf = new Date("2026-06-30T10:00:00Z");
const openInvoice: InvoiceState = {
  status: "overdue",
  totalMinor: 50_000,
  amountPaidMinor: 10_000,
  amountCreditedMinor: 0,
  dueDate: addDays(asOf, -10),
};

describe("dispute state machine", () => {
  it("moves open → under_review → withdrawn", () => {
    expect(transitionDispute("open", "start_review")).toBe("under_review");
    expect(transitionDispute("under_review", "withdraw")).toBe("withdrawn");
    expect(transitionDispute("open", "withdraw")).toBe("withdrawn");
  });

  it("rejects transitions that are not in the table", () => {
    expect(() => transitionDispute("under_review", "start_review")).toThrow(DomainError);
    expect(() => transitionDispute("withdrawn", "withdraw")).toThrow(DomainError);
  });

  it("lists the available actions", () => {
    expect(availableDisputeActions("open")).toEqual(["start_review", "withdraw"]);
    expect(availableDisputeActions("withdrawn")).toEqual([]);
  });

  it("knows which statuses put an invoice on hold", () => {
    expect(isActiveDispute("open")).toBe(true);
    expect(isActiveDispute("under_review")).toBe(true);
    expect(isActiveDispute("withdrawn")).toBe(false);
  });
});

describe("resolving a dispute", () => {
  it("[resolve-dispute] resolves an open dispute", () => {
    expect(transitionDispute("open", "resolve")).toBe("resolved");
  });

  it("[resolve-dispute] resolves a dispute under review", () => {
    expect(transitionDispute("under_review", "resolve")).toBe("resolved");
  });

  it.each(["withdrawn", "resolved"] as const)("[resolve-dispute] cannot resolve a dispute that is %s", (status) => {
    let error: unknown;
    try {
      transitionDispute(status, "resolve");
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("[resolve-dispute] a resolved dispute is no longer active and has no further actions", () => {
    expect(isActiveDispute("resolved")).toBe(false);
    expect(availableDisputeActions("resolved")).toEqual([]);
    expect(() => transitionDispute("resolved", "withdraw")).toThrow(DomainError);
  });

  it("[resolve-dispute] resolve is not offered as a plain transition action", () => {
    expect(availableDisputeActions("open")).not.toContain("resolve");
    expect(availableDisputeActions("under_review")).not.toContain("resolve");
  });

  it("[resolve-dispute] accepted: credits the disputed amount when it is within the balance", () => {
    expect(planDisputeResolution({ resolution: "accepted", disputedMinor: 15_000, invoiceBalanceMinor: 40_000 })).toEqual({
      creditNoteMinor: 15_000,
    });
    expect(planDisputeResolution({ resolution: "accepted", disputedMinor: 40_000, invoiceBalanceMinor: 40_000 })).toEqual({
      creditNoteMinor: 40_000,
    });
  });

  it("[resolve-dispute] rejected: never issues a credit", () => {
    expect(planDisputeResolution({ resolution: "rejected", disputedMinor: 15_000, invoiceBalanceMinor: 40_000 })).toEqual({
      creditNoteMinor: 0,
    });
  });

  it("[resolve-dispute] accepted: caps the credit at the invoice balance when the disputed amount is larger", () => {
    expect(planDisputeResolution({ resolution: "accepted", disputedMinor: 50_000, invoiceBalanceMinor: 12_345 })).toEqual({
      creditNoteMinor: 12_345,
    });
  });

  it("[resolve-dispute] accepted: issues no credit when the balance is already zero", () => {
    expect(planDisputeResolution({ resolution: "accepted", disputedMinor: 15_000, invoiceBalanceMinor: 0 })).toEqual({
      creditNoteMinor: 0,
    });
    expect(planDisputeResolution({ resolution: "accepted", disputedMinor: 15_000, invoiceBalanceMinor: -100 })).toEqual({
      creditNoteMinor: 0,
    });
  });
});

describe("opening a dispute", () => {
  it("accepts an amount up to the open balance", () => {
    expect(() => assertCanOpenDispute(openInvoice, 40_000, [])).not.toThrow();
  });

  it("rejects amounts over the balance, closed invoices and duplicate disputes", () => {
    expect(() => assertCanOpenDispute(openInvoice, 40_001, [])).toThrow(/exceed/);
    expect(() => assertCanOpenDispute({ ...openInvoice, status: "paid" }, 100, [])).toThrow(/paid/);
    expect(() => assertCanOpenDispute({ ...openInvoice, status: "draft" }, 100, [])).toThrow(/draft/);
    expect(() => assertCanOpenDispute(openInvoice, 100, ["under_review"])).toThrow(/active dispute/);
    expect(() => assertCanOpenDispute(openInvoice, 100, ["withdrawn"])).not.toThrow();
  });
});
