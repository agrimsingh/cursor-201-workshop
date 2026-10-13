import { beforeEach, describe, expect, it } from "vitest";
import { GET as getCollections } from "@/app/api/collections/route";
import { POST as openDispute } from "@/app/api/disputes/route";
import { POST as transition } from "@/app/api/disputes/[id]/transitions/route";
import { db } from "@/lib/db";
import type { CollectionsQueue } from "@/lib/domain/aging";
import type { ApiErrorBody } from "@/lib/http/errors";
import { auditFor, callRoute, NOW, resetDatabase, viewer } from "./helpers";

beforeEach(resetDatabase);

async function overdueInvoiceWithoutDispute() {
  const invoice = await db.invoice.findFirst({
    where: { status: "overdue", disputes: { none: {} } },
    orderBy: { dueDate: "asc" },
  });
  if (!invoice) throw new Error("No overdue invoice without a dispute in the seed data");
  return invoice;
}

async function queue() {
  const { body } = await callRoute<Record<string, never>, { data: CollectionsQueue }>(getCollections, {
    path: "/api/collections",
    query: { asOf: NOW.toISOString() },
  });
  return body.data;
}

describe("disputes", () => {
  it("opening a dispute puts the invoice on hold and out of the collections queue", async () => {
    const invoice = await overdueInvoiceWithoutDispute();
    expect((await queue()).items.map((item) => item.invoiceId)).toContain(invoice.id);

    const { status, body } = await callRoute<Record<string, never>, { data: { id: string; status: string } }>(openDispute, {
      method: "POST",
      path: "/api/disputes",
      body: { invoiceId: invoice.id, amountMinor: invoice.balanceMinor, reason: "quality", description: "Wrong colours on the poster run" },
    });
    expect(status).toBe(201);
    expect(body.data.status).toBe("open");

    const after = await queue();
    expect(after.items.map((item) => item.invoiceId)).not.toContain(invoice.id);
    const [entry] = await auditFor(body.data.id);
    expect(entry).toMatchObject({ action: "dispute.opened", entityType: "dispute" });
  });

  it("allows only one active dispute per invoice", async () => {
    const invoice = await overdueInvoiceWithoutDispute();
    const request = {
      method: "POST" as const,
      path: "/api/disputes",
      body: { invoiceId: invoice.id, amountMinor: 100, reason: "pricing", description: "Rate looks wrong" },
    };
    expect((await callRoute(openDispute, request)).status).toBe(201);
    const second = await callRoute<Record<string, never>, ApiErrorBody>(openDispute, request);
    expect(second.status).toBe(422);
    expect(second.body.error.code).toBe("BUSINESS_RULE");
  });

  it("cannot dispute more than the balance", async () => {
    const invoice = await overdueInvoiceWithoutDispute();
    const { status } = await callRoute(openDispute, {
      method: "POST",
      path: "/api/disputes",
      body: { invoiceId: invoice.id, amountMinor: invoice.balanceMinor + 1, reason: "pricing", description: "Too much" },
    });
    expect(status).toBe(422);
  });

  it("moves through review and withdrawal, and rejects invalid transitions", async () => {
    const dispute = (await db.dispute.findFirst({ where: { status: "open" } }))!;
    const call = (action: string) =>
      callRoute<{ id: string }, { data: { status: string } } & Partial<ApiErrorBody>>(transition, {
        method: "POST",
        path: `/api/disputes/${dispute.id}/transitions`,
        params: { id: dispute.id },
        body: { action },
      });
    expect((await call("start_review")).body.data.status).toBe("under_review");
    expect((await call("withdraw")).body.data.status).toBe("withdrawn");
    const again = await call("withdraw");
    expect(again.status).toBe(409);
    expect(again.body.error?.code).toBe("INVALID_TRANSITION");
    expect((await auditFor(dispute.id)).map((entry) => entry.action)).toEqual(
      expect.arrayContaining(["dispute.review_started", "dispute.withdrawn"]),
    );
  });

  it("does not let viewers open disputes", async () => {
    const invoice = await overdueInvoiceWithoutDispute();
    const { status } = await callRoute(openDispute, {
      method: "POST",
      path: "/api/disputes",
      as: viewer,
      body: { invoiceId: invoice.id, amountMinor: 100, reason: "pricing", description: "Rate looks wrong" },
    });
    expect(status).toBe(403);
  });
});
