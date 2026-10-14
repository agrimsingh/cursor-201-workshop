import { describe, expect, it } from "vitest";
import { collectionsQueueToCsv } from "@/lib/collections-export";
import type { CollectionsQueue } from "@/lib/domain/aging";

describe("collectionsQueueToCsv", () => {
  it("writes balances as decimal strings, not floats", () => {
    const queue: CollectionsQueue = {
      asOf: "2026-10-13T00:00:00.000Z",
      onHoldCount: 0,
      items: [
        {
          invoiceId: "inv_1",
          invoiceNumber: "INV-001",
          customerId: "cus_1",
          customerName: "Acme",
          currency: "AUD",
          balanceMinor: 123_450,
          dueDate: "2026-09-01T00:00:00.000Z",
          daysPastDue: 42,
          bucket: "31-60",
          suggestedAction: "call_customer",
        },
      ],
    };

    const csv = collectionsQueueToCsv(queue);
    expect(csv).toContain("1234.50");
    expect(csv).not.toMatch(/1234\.5[^0-9]/);
    expect(csv.split("\n")[1]).toMatch(/^Acme,INV-001,AUD,1234\.50,2026-09-01,42,/);
  });
});
