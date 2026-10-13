import { beforeEach, describe, expect, it } from "vitest";
import { POST as recordPayment } from "@/app/api/payments/route";
import { POST as issueCreditNote } from "@/app/api/credit-notes/route";
import { db } from "@/lib/db";
import type { ApiErrorBody } from "@/lib/http/errors";
import { admin, auditFor, callRoute, resetDatabase, viewer } from "./helpers";

beforeEach(resetDatabase);

async function openInvoice(customerId: string) {
  const invoice = await db.invoice.findFirst({
    where: { customerId, status: { in: ["sent", "partially_paid", "overdue"] } },
    orderBy: { dueDate: "asc" },
  });
  if (!invoice) throw new Error(`No open invoice for ${customerId}`);
  return invoice;
}

function payment(overrides: Record<string, unknown>) {
  return {
    customerId: "cus_kookaburra",
    currency: "AUD",
    amountMinor: 10_000,
    method: "bank_transfer",
    receivedAt: "2026-06-30",
    allocation: { mode: "oldest_first" },
    ...overrides,
  };
}

describe("POST /api/payments", () => {
  it("applies a partial payment and keeps the invoice open", async () => {
    const invoice = await openInvoice("cus_kookaburra");
    const { status } = await callRoute(recordPayment, {
      method: "POST",
      path: "/api/payments",
      body: payment({ amountMinor: 10_000, allocation: { mode: "explicit", lines: [{ invoiceId: invoice.id, amountMinor: 10_000 }] } }),
    });
    expect(status).toBe(201);
    const updated = (await db.invoice.findUnique({ where: { id: invoice.id } }))!;
    expect(updated.amountPaidMinor).toBe(invoice.amountPaidMinor + 10_000);
    expect(updated.balanceMinor).toBe(invoice.balanceMinor - 10_000);
    expect(["partially_paid", "overdue"]).toContain(updated.status);
    expect((await auditFor(invoice.id)).at(-1)?.action).toBe("invoice.settled");
  });

  it("settles invoices oldest first and holds the remainder as credit", async () => {
    const open = await db.invoice.findMany({
      where: { customerId: "cus_southern", status: { in: ["sent", "partially_paid", "overdue"] } },
      orderBy: { dueDate: "asc" },
    });
    const owed = open.reduce((sum, invoice) => sum + invoice.balanceMinor, 0);
    const { status, body } = await callRoute<Record<string, never>, { data: { id: string; unappliedMinor: number } }>(
      recordPayment,
      { method: "POST", path: "/api/payments", body: payment({ customerId: "cus_southern", amountMinor: owed + 5_000 }) },
    );
    expect(status).toBe(201);
    expect(body.data.unappliedMinor).toBe(5_000);
    const after = await db.invoice.findMany({ where: { id: { in: open.map((invoice) => invoice.id) } } });
    expect(after.every((invoice) => invoice.status === "paid" && invoice.balanceMinor === 0)).toBe(true);
    const allocations = await db.paymentAllocation.findMany({ where: { paymentId: body.data.id } });
    expect(allocations.reduce((sum, a) => sum + a.amountMinor, 0)).toBe(owed);
    const recorded = (await auditFor(body.data.id)).find((entry) => entry.action === "payment.recorded");
    expect(JSON.parse(recorded!.after!)).toMatchObject({ unappliedMinor: 5_000 });
  });

  it("rejects a payment in a different currency and writes nothing", async () => {
    const invoice = await openInvoice("cus_kookaburra");
    const before = await db.payment.count();
    const { status, body } = await callRoute<Record<string, never>, ApiErrorBody>(recordPayment, {
      method: "POST",
      path: "/api/payments",
      body: payment({ currency: "USD", allocation: { mode: "explicit", lines: [{ invoiceId: invoice.id, amountMinor: 100 }] } }),
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe("CURRENCY_MISMATCH");
    expect(await db.payment.count()).toBe(before);
  });

  it("rejects allocations larger than the invoice balance", async () => {
    const invoice = await openInvoice("cus_kookaburra");
    const amountMinor = invoice.balanceMinor + 1;
    const { status, body } = await callRoute<Record<string, never>, ApiErrorBody>(recordPayment, {
      method: "POST",
      path: "/api/payments",
      body: payment({ amountMinor, allocation: { mode: "explicit", lines: [{ invoiceId: invoice.id, amountMinor }] } }),
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe("OVER_ALLOCATION");
  });

  it("does not let viewers record payments", async () => {
    const { status } = await callRoute(recordPayment, { method: "POST", path: "/api/payments", as: viewer, body: payment({}) });
    expect(status).toBe(403);
  });
});

describe("POST /api/credit-notes", () => {
  it("credits the full balance and settles the invoice", async () => {
    const invoice = await openInvoice("cus_pinnacle");
    const { status } = await callRoute(issueCreditNote, {
      method: "POST",
      path: "/api/credit-notes",
      as: admin,
      body: { invoiceId: invoice.id, amountMinor: invoice.balanceMinor, reason: "goodwill" },
    });
    expect(status).toBe(201);
    const updated = (await db.invoice.findUnique({ where: { id: invoice.id } }))!;
    expect(updated).toMatchObject({ status: "paid", balanceMinor: 0, amountCreditedMinor: invoice.amountCreditedMinor + invoice.balanceMinor });
  });

  it("cannot exceed the balance", async () => {
    const invoice = await openInvoice("cus_pinnacle");
    const { status, body } = await callRoute<Record<string, never>, ApiErrorBody>(issueCreditNote, {
      method: "POST",
      path: "/api/credit-notes",
      as: admin,
      body: { invoiceId: invoice.id, amountMinor: invoice.balanceMinor + 1, reason: "goodwill" },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe("OVER_ALLOCATION");
  });

  it("is admin only", async () => {
    const invoice = await openInvoice("cus_pinnacle");
    const { status } = await callRoute(issueCreditNote, {
      method: "POST",
      path: "/api/credit-notes",
      body: { invoiceId: invoice.id, amountMinor: 100, reason: "goodwill" },
    });
    expect(status).toBe(403);
  });
});
