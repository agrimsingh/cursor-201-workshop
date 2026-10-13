import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/domain/dates";
import {
  assertCanOpenDispute,
  availableDisputeActions,
  isActiveDispute,
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
