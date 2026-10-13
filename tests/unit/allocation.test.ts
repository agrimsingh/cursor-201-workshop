import { describe, expect, it } from "vitest";
import { planAllocation, type AllocatableInvoice } from "@/lib/domain/allocation";
import { DomainError } from "@/lib/domain/errors";

function inv(id: string, dueDate: string, totalMinor: number, overrides: Partial<AllocatableInvoice> = {}): AllocatableInvoice {
  return {
    id,
    number: `INV-${id}`,
    customerId: "cus_1",
    currency: "AUD",
    status: "sent",
    issueDate: new Date("2026-01-01"),
    dueDate: new Date(dueDate),
    totalMinor,
    amountPaidMinor: 0,
    amountCreditedMinor: 0,
    ...overrides,
  };
}

const payment = { customerId: "cus_1", currency: "AUD", amountMinor: 25_000 };
const invoices = [
  inv("c", "2026-03-01", 30_000),
  inv("a", "2026-01-15", 10_000, { amountPaidMinor: 2_000, status: "partially_paid" }),
  inv("b", "2026-02-01", 12_000, { status: "overdue" }),
];

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof DomainError ? error.code : "not-a-domain-error";
  }
  return undefined;
}

describe("planAllocation (oldest first)", () => {
  it("pays the oldest due invoices first and stops when the money runs out", () => {
    const plan = planAllocation(payment, invoices);
    expect(plan.allocations).toEqual([
      { invoiceId: "a", amountMinor: 8_000 },
      { invoiceId: "b", amountMinor: 12_000 },
      { invoiceId: "c", amountMinor: 5_000 },
    ]);
    expect(plan.unappliedMinor).toBe(0);
  });

  it("holds the remainder as unapplied credit", () => {
    const plan = planAllocation({ ...payment, amountMinor: 60_000 }, invoices);
    expect(plan.allocatedMinor).toBe(50_000);
    expect(plan.unappliedMinor).toBe(10_000);
  });

  it("skips other customers, other currencies and closed invoices", () => {
    const plan = planAllocation(payment, [
      inv("x", "2025-01-01", 5_000, { customerId: "cus_2" }),
      inv("y", "2025-01-01", 5_000, { currency: "USD" }),
      inv("z", "2025-01-01", 5_000, { status: "paid" }),
      inv("d", "2025-01-01", 5_000, { status: "draft" }),
    ]);
    expect(plan.allocations).toEqual([]);
    expect(plan.unappliedMinor).toBe(25_000);
  });
});

describe("planAllocation (explicit)", () => {
  it("uses exactly the requested lines", () => {
    const plan = planAllocation(payment, invoices, [
      { invoiceId: "c", amountMinor: 20_000 },
      { invoiceId: "b", amountMinor: 1_000 },
    ]);
    expect(plan.allocatedMinor).toBe(21_000);
    expect(plan.unappliedMinor).toBe(4_000);
  });

  it("validates every line", () => {
    expect(codeOf(() => planAllocation(payment, invoices, [{ invoiceId: "a", amountMinor: 8_001 }]))).toBe("OVER_ALLOCATION");
    expect(codeOf(() => planAllocation(payment, invoices, [{ invoiceId: "c", amountMinor: 26_000 }]))).toBe("OVER_ALLOCATION");
    expect(codeOf(() => planAllocation(payment, invoices, [{ invoiceId: "nope", amountMinor: 1 }]))).toBe("NOT_FOUND");
    expect(codeOf(() => planAllocation(payment, invoices, [{ invoiceId: "a", amountMinor: 0 }]))).toBe("BUSINESS_RULE");
    expect(codeOf(() => planAllocation(payment, invoices, [{ invoiceId: "a", amountMinor: 1.5 }]))).toBe("BUSINESS_RULE");
    expect(
      codeOf(() =>
        planAllocation(payment, invoices, [
          { invoiceId: "a", amountMinor: 1 },
          { invoiceId: "a", amountMinor: 1 },
        ]),
      ),
    ).toBe("BUSINESS_RULE");
    expect(codeOf(() => planAllocation(payment, [inv("u", "2026-01-01", 100, { currency: "USD" })], [{ invoiceId: "u", amountMinor: 1 }]))).toBe(
      "CURRENCY_MISMATCH",
    );
    expect(codeOf(() => planAllocation(payment, [inv("v", "2026-01-01", 100, { status: "void" })], [{ invoiceId: "v", amountMinor: 1 }]))).toBe(
      "BUSINESS_RULE",
    );
  });

  it("rejects non-positive payments", () => {
    expect(codeOf(() => planAllocation({ ...payment, amountMinor: 0 }, invoices))).toBe("BUSINESS_RULE");
  });
});
