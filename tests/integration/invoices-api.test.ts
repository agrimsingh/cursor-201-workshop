import { beforeEach, describe, expect, it } from "vitest";
import { GET as listInvoices, POST as createInvoice } from "@/app/api/invoices/route";
import { POST as markOverdue } from "@/app/api/invoices/mark-overdue/route";
import { POST as transition } from "@/app/api/invoices/[id]/transitions/route";
import { GET as getInvoice } from "@/app/api/invoices/[id]/route";
import { toInvoiceSearchParams } from "@/lib/client/invoice-list-params";
import { db } from "@/lib/db";
import type { ApiErrorBody } from "@/lib/http/errors";
import type { InvoiceListItem } from "@/lib/services/invoices";
import { admin, agent, auditFor, callRoute, findInvoice, resetDatabase, viewer } from "./helpers";

type ListBody = { data: InvoiceListItem[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };

beforeEach(resetDatabase);

describe("GET /api/invoices", () => {
  it("paginates server-side", async () => {
    const total = await db.invoice.count();
    const { status, body } = await callRoute<Record<string, never>, ListBody>(listInvoices, {
      path: "/api/invoices",
      query: { pageSize: "10", page: "2" },
    });
    expect(status).toBe(200);
    expect(body.data).toHaveLength(10);
    expect(body.meta).toEqual({ page: 2, pageSize: 10, total, totalPages: Math.ceil(total / 10) });
  });

  it("sorts by balance, largest first", async () => {
    const { body } = await callRoute<Record<string, never>, ListBody>(listInvoices, {
      path: "/api/invoices",
      query: { sort: "balanceMinor", order: "desc", pageSize: "100" },
    });
    const balances = body.data.map((invoice) => invoice.balanceMinor);
    expect(balances).toEqual([...balances].sort((a, b) => b - a));
  });

  it("filters by ?status=", async () => {
    const overdue = await db.invoice.count({ where: { status: "overdue" } });
    const { body } = await callRoute<Record<string, never>, ListBody>(listInvoices, {
      path: "/api/invoices",
      query: { status: "overdue", pageSize: "100" },
    });
    expect(overdue).toBeGreaterThan(0);
    expect(body.meta.total).toBe(overdue);
    expect(body.data.every((invoice) => invoice.status === "overdue")).toBe(true);
  });

  it("[filter-bug] honours the status filter sent by the invoices page", async () => {
    // Build the query string exactly the way the invoices list UI does.
    const query = toInvoiceSearchParams({ status: "overdue" });
    const overdue = await db.invoice.count({ where: { status: "overdue" } });
    const { body } = await callRoute<Record<string, never>, ListBody>(listInvoices, {
      path: "/api/invoices",
      query,
    });
    expect(body.data.map((invoice) => invoice.status)).not.toContain("paid");
    expect(body.meta.total).toBe(overdue);
  });

  it("filters by currency and search text", async () => {
    const { body } = await callRoute<Record<string, never>, ListBody>(listInvoices, {
      path: "/api/invoices",
      query: { currency: "GBP", q: "Thames", pageSize: "100" },
    });
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((invoice) => invoice.currency === "GBP" && invoice.customer.name.includes("Thames"))).toBe(true);
  });

  it("rejects an unknown status with the standard error shape", async () => {
    const { status, body } = await callRoute<Record<string, never>, ApiErrorBody>(listInvoices, {
      path: "/api/invoices",
      query: { status: "lost" },
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.details).toEqual([expect.objectContaining({ path: "status" })]);
  });
});

describe("POST /api/invoices", () => {
  it("creates a draft with the total computed from integer line amounts", async () => {
    const { status, body } = await callRoute<Record<string, never>, { data: { status: string; totalMinor: number; number: string } }>(
      createInvoice,
      {
        method: "POST",
        path: "/api/invoices",
        body: {
          customerId: "cus_kookaburra",
          currency: "AUD",
          issueDate: "2026-06-30",
          dueDate: "2026-07-30",
          lines: [
            { description: "Template set", quantity: 3, unitPriceMinor: 12_550 },
            { description: "Rush fee", quantity: 1, unitPriceMinor: 9_999 },
          ],
        },
      },
    );
    expect(status).toBe(201);
    expect(body.data).toMatchObject({ status: "draft", totalMinor: 3 * 12_550 + 9_999 });
    expect(body.data.number).toMatch(/^INV-2026-\d{4}$/);
  });

  it("rejects fractional minor units", async () => {
    const { status, body } = await callRoute<Record<string, never>, ApiErrorBody>(createInvoice, {
      method: "POST",
      path: "/api/invoices",
      body: {
        customerId: "cus_kookaburra",
        currency: "AUD",
        issueDate: "2026-06-30",
        dueDate: "2026-07-30",
        lines: [{ description: "Float", quantity: 1, unitPriceMinor: 10.5 }],
      },
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("does not let viewers create invoices", async () => {
    const { status, body } = await callRoute<Record<string, never>, ApiErrorBody>(createInvoice, {
      method: "POST",
      path: "/api/invoices",
      as: viewer,
      body: {
        customerId: "cus_kookaburra",
        currency: "AUD",
        issueDate: "2026-06-30",
        dueDate: "2026-07-30",
        lines: [{ description: "Thing", quantity: 1, unitPriceMinor: 100 }],
      },
    });
    expect(status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});

describe("invoice transitions", () => {
  it("sends a draft and records who did it", async () => {
    const draft = await findInvoice({ status: "draft" });
    const { status, body } = await callRoute<{ id: string }, { data: { status: string } }>(transition, {
      method: "POST",
      path: `/api/invoices/${draft.id}/transitions`,
      params: { id: draft.id },
      body: { action: "send" },
    });
    expect(status).toBe(200);
    expect(body.data.status).toBe("sent");
    const entries = await auditFor(draft.id);
    const sent = entries.find((entry) => entry.action === "invoice.sent");
    expect(sent).toMatchObject({ actorId: agent.id, actorLabel: "Marcus Lee (agent)" });
    expect(JSON.parse(sent!.before!)).toMatchObject({ status: "draft" });
    expect(JSON.parse(sent!.after!)).toMatchObject({ status: "sent" });
  });

  it("refuses to void a paid invoice", async () => {
    const paid = await findInvoice({ status: "paid" });
    const { status, body } = await callRoute<{ id: string }, ApiErrorBody>(transition, {
      method: "POST",
      path: `/api/invoices/${paid.id}/transitions`,
      params: { id: paid.id },
      as: admin,
      body: { action: "void" },
    });
    expect(status).toBe(409);
    expect(body.error.code).toBe("INVALID_TRANSITION");
  });

  it("only lets admins void", async () => {
    const draft = await findInvoice({ status: "draft" });
    const asAgent = await callRoute<{ id: string }, ApiErrorBody>(transition, {
      method: "POST",
      path: `/api/invoices/${draft.id}/transitions`,
      params: { id: draft.id },
      body: { action: "void" },
    });
    expect(asAgent.status).toBe(403);
    const asAdmin = await callRoute<{ id: string }, { data: { status: string } }>(transition, {
      method: "POST",
      path: `/api/invoices/${draft.id}/transitions`,
      params: { id: draft.id },
      as: admin,
      body: { action: "void" },
    });
    expect(asAdmin.body.data.status).toBe("void");
  });

  it("returns 404 for an unknown invoice", async () => {
    const { status, body } = await callRoute<{ id: string }, ApiErrorBody>(getInvoice, {
      path: "/api/invoices/nope",
      params: { id: "nope" },
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("marks sent invoices overdue once they pass their due date", async () => {
    const sent = await db.invoice.findFirst({ where: { status: "sent" }, orderBy: { dueDate: "desc" } });
    const asOf = new Date(sent!.dueDate.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const { body } = await callRoute<Record<string, never>, { data: { invoiceIds: string[] } }>(markOverdue, {
      method: "POST",
      path: "/api/invoices/mark-overdue",
      body: { asOf },
    });
    expect(body.data.invoiceIds).toContain(sent!.id);
    expect((await db.invoice.findUnique({ where: { id: sent!.id } }))!.status).toBe("overdue");
  });
});
