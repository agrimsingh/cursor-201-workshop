import { beforeEach, describe, expect, it } from "vitest";
import { GET as exportCollections } from "@/app/api/collections/export/route";
import { GET as getCollections } from "@/app/api/collections/route";
import type { CollectionsQueue } from "@/lib/domain/aging";
import { collectionsExportFilename } from "@/lib/collections-export";
import { db } from "@/lib/db";
import { callRoute, callRouteText, NOW, resetDatabase, viewer } from "./helpers";

beforeEach(resetDatabase);

async function queue() {
  const { body } = await callRoute<Record<string, never>, { data: CollectionsQueue }>(getCollections, {
    path: "/api/collections",
    query: { asOf: NOW.toISOString() },
  });
  return body.data;
}

describe("GET /api/collections/export", () => {
  it("returns CSV with a header and one row per queue item", async () => {
    const expected = await queue();
    const { status, text, headers } = await callRouteText(exportCollections, {
      path: "/api/collections/export",
      query: { asOf: NOW.toISOString() },
    });

    expect(status).toBe(200);
    expect(headers.get("content-type")).toContain("text/csv");
    expect(headers.get("content-disposition")).toBe(
      `attachment; filename="${collectionsExportFilename(NOW)}"`,
    );

    const rows = text.trimEnd().split("\n");
    expect(rows[0]).toBe("Customer,Invoice,Currency,Balance,Due date,Days late,Bucket,Next step");
    expect(rows.length).toBe(1 + expected.items.length);

    for (let i = 0; i < expected.items.length; i++) {
      expect(rows[i + 1]).toContain(expected.items[i].invoiceNumber);
    }
  });

  it("escapes formula-like customer names", async () => {
    const invoice = await db.invoice.findFirst({
      where: { status: "overdue", disputes: { none: {} } },
      include: { customer: true },
    });
    if (!invoice) throw new Error("No overdue invoice in seed data");

    await db.customer.update({
      where: { id: invoice.customerId },
      data: { name: "=HYPERLINK(\"evil\")" },
    });

    const { text } = await callRouteText(exportCollections, {
      path: "/api/collections/export",
      query: { asOf: NOW.toISOString() },
    });

    expect(text).toContain("'=HYPERLINK");
  });

  it("allows viewers to export", async () => {
    const { status } = await callRouteText(exportCollections, {
      path: "/api/collections/export",
      query: { asOf: NOW.toISOString() },
      as: viewer,
    });
    expect(status).toBe(200);
  });
});
