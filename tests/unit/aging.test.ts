import { describe, expect, it } from "vitest";
import { agingBucket, buildAgingReport, buildCollectionsQueue, daysPastDue, type AgingInput } from "@/lib/domain/aging";
import { addDays } from "@/lib/domain/dates";

const asOf = new Date("2026-06-30T23:30:00Z");

function input(id: string, daysLate: number, balanceMinor: number, overrides: Partial<AgingInput> = {}): AgingInput {
  return {
    invoiceId: id,
    invoiceNumber: `INV-${id}`,
    customerId: "cus_1",
    customerName: "Acme",
    currency: "AUD",
    status: daysLate > 0 ? "overdue" : "sent",
    dueDate: addDays(new Date("2026-06-30T00:00:00Z"), -daysLate),
    balanceMinor,
    onHold: false,
    ...overrides,
  };
}

describe("aging buckets", () => {
  it.each([
    [-5, "current"],
    [0, "current"],
    [1, "0-30"],
    [30, "0-30"],
    [31, "31-60"],
    [60, "31-60"],
    [61, "61-90"],
    [90, "61-90"],
    [91, "90+"],
    [400, "90+"],
  ] as const)("%i days past due is %s", (days, bucket) => {
    expect(agingBucket(days)).toBe(bucket);
  });

  it("counts whole UTC days regardless of time of day", () => {
    expect(daysPastDue(new Date("2026-06-29T00:00:00Z"), new Date("2026-06-30T00:01:00Z"))).toBe(1);
    expect(daysPastDue(new Date("2026-06-29T00:00:00Z"), new Date("2026-06-30T23:59:00Z"))).toBe(1);
  });
});

describe("buildAgingReport", () => {
  const inputs = [
    input("1", -3, 1_000),
    input("2", 10, 2_000),
    input("3", 45, 3_000, { onHold: true }),
    input("4", 75, 4_000, { customerId: "cus_2", customerName: "Zed" }),
    input("5", 120, 5_000, { currency: "USD" }),
    input("6", 20, 9_999, { status: "paid", balanceMinor: 0 }),
    input("7", 20, 7_000, { status: "draft" }),
  ];
  const report = buildAgingReport(inputs, asOf);

  it("totals each currency separately", () => {
    expect(report.currencies.map((c) => c.currency)).toEqual(["AUD", "USD"]);
    const aud = report.currencies[0];
    expect(aud.buckets).toEqual({ current: 1_000, "0-30": 2_000, "31-60": 3_000, "61-90": 4_000, "90+": 0 });
    expect(aud.totalMinor).toBe(10_000);
    expect(aud.pastDueMinor).toBe(9_000);
    expect(aud.onHoldMinor).toBe(3_000);
    expect(report.currencies[1].buckets["90+"]).toBe(5_000);
  });

  it("ignores paid, void and draft invoices", () => {
    expect(report.currencies.reduce((sum, c) => sum + c.totalMinor, 0)).toBe(15_000);
  });

  it("ranks customers by their oldest overdue invoice", () => {
    expect(report.customers.map((c) => [c.customerName, c.currency, c.oldestDaysPastDue])).toEqual([
      ["Acme", "USD", 120],
      ["Zed", "AUD", 75],
      ["Acme", "AUD", 45],
    ]);
  });
});

describe("buildCollectionsQueue", () => {
  const queue = buildCollectionsQueue(
    [input("1", -3, 1_000), input("2", 10, 2_000), input("3", 45, 3_000, { onHold: true }), input("4", 95, 4_000)],
    asOf,
  );

  it("lists past-due invoices, most overdue first, with a suggested next step", () => {
    expect(queue.items.map((item) => [item.invoiceId, item.bucket, item.suggestedAction])).toEqual([
      ["4", "90+", "escalate"],
      ["2", "0-30", "send_reminder"],
    ]);
  });

  it("holds disputed invoices out of the queue", () => {
    expect(queue.onHoldCount).toBe(1);
  });
});
