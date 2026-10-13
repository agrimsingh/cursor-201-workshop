import { beforeAll, describe, expect, it } from "vitest";
import { GET as getStatement } from "@/app/api/customers/[id]/statement/route";
import { POST as recordPayment } from "@/app/api/payments/route";
import { db } from "@/lib/db";
import type { StatementLine } from "@/lib/domain/statement";
import type { ApiErrorBody } from "@/lib/http/errors";
import { callRoute, resetDatabase, viewer } from "./helpers";

interface Statement {
  customer: { id: string; name: string };
  currency: string;
  lines: (Omit<StatementLine, "date"> & { date: string })[];
  totalDebitsMinor: number;
  totalCreditsMinor: number;
  closingBalanceMinor: number;
}

beforeAll(resetDatabase);

function statement(id: string, query?: Record<string, string>, as = viewer) {
  return callRoute<{ id: string }, { data: Statement }>(getStatement, {
    path: `/api/customers/${id}/statement`,
    params: { id },
    query,
    as,
  });
}

async function openBalance(customerId: string, currency: string) {
  const { _sum } = await db.invoice.aggregate({
    where: { customerId, currency, status: { in: ["sent", "partially_paid", "overdue"] } },
    _sum: { balanceMinor: true },
  });
  return _sum.balanceMinor ?? 0;
}

describe("GET /api/customers/:id/statement", () => {
  it("lists invoices, payments and credit notes with a running balance, in the billing currency by default", async () => {
    const { status, body } = await statement("cus_kookaburra");
    expect(status).toBe(200);
    const { data } = body;
    expect(data.customer).toEqual({ id: "cus_kookaburra", name: "Kookaburra Coffee Co." });
    expect(data.currency).toBe("AUD");

    const [invoices, payments, creditNotes] = await Promise.all([
      db.invoice.count({ where: { customerId: "cus_kookaburra" } }),
      db.payment.count({ where: { customerId: "cus_kookaburra" } }),
      db.creditNote.count({ where: { customerId: "cus_kookaburra" } }),
    ]);
    const kinds = data.lines.map((line) => line.kind);
    expect(kinds.filter((kind) => kind === "invoice")).toHaveLength(invoices);
    expect(kinds.filter((kind) => kind === "payment")).toHaveLength(payments);
    expect(kinds.filter((kind) => kind === "credit_note")).toHaveLength(creditNotes);

    const dates = data.lines.map((line) => Date.parse(line.date));
    expect(dates).toEqual([...dates].sort((a, b) => a - b));

    let running = 0;
    for (const line of data.lines) {
      expect(Number.isInteger(line.debitMinor) && Number.isInteger(line.creditMinor)).toBe(true);
      running += line.debitMinor - line.creditMinor;
      expect(line.balanceMinor).toBe(running);
    }

    const debits = data.lines.reduce((sum, line) => sum + line.debitMinor, 0);
    const credits = data.lines.reduce((sum, line) => sum + line.creditMinor, 0);
    expect(data.totalDebitsMinor).toBe(debits);
    expect(data.totalCreditsMinor).toBe(credits);
    expect(data.closingBalanceMinor).toBe(debits - credits);
    expect(data.closingBalanceMinor).toBe(running);
    expect(data.closingBalanceMinor).toBe(await openBalance("cus_kookaburra", "AUD"));
  });

  it("never shows draft or voided invoices", async () => {
    for (const customerId of ["cus_harbourside", "cus_bondi"]) {
      const hidden = await db.invoice.findMany({ where: { customerId, status: { in: ["draft", "void"] } } });
      expect(hidden.length).toBeGreaterThan(0);
      const { body } = await statement(customerId);
      const ids = body.data.lines.map((line) => line.id);
      for (const invoice of hidden) expect(ids).not.toContain(invoice.id);
      expect(body.data.closingBalanceMinor).toBe(await openBalance(customerId, body.data.currency));
    }
  });

  it("credits the full payment, so unapplied credit reduces the closing balance", async () => {
    const unapplied = await db.payment.aggregate({ where: { customerId: "cus_moorland" }, _sum: { unappliedMinor: true } });
    expect(unapplied._sum.unappliedMinor).toBeGreaterThan(0);
    const { body } = await statement("cus_moorland");
    expect(body.data.currency).toBe("GBP");
    expect(body.data.closingBalanceMinor).toBe((await openBalance("cus_moorland", "GBP")) - unapplied._sum.unappliedMinor!);
  });

  it("returns an empty statement for a supported currency the customer has no records in", async () => {
    const { status, body } = await statement("cus_kookaburra", { currency: "JPY" });
    expect(status).toBe(200);
    expect(body.data).toMatchObject({ currency: "JPY", lines: [], closingBalanceMinor: 0 });
  });

  it("rejects an unsupported currency with a 400", async () => {
    const { status, body } = await callRoute<{ id: string }, ApiErrorBody>(getStatement, {
      path: "/api/customers/cus_kookaburra/statement",
      params: { id: "cus_kookaburra" },
      query: { currency: "XYZ" },
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.details).toEqual([expect.objectContaining({ path: "currency" })]);
  });

  it("returns 404 for an unknown customer", async () => {
    const { status, body } = await callRoute<{ id: string }, ApiErrorBody>(getStatement, {
      path: "/api/customers/cus_nobody/statement",
      params: { id: "cus_nobody" },
    });
    expect(status).toBe(404);
    expect(body.error).toMatchObject({ code: "NOT_FOUND", message: "Customer cus_nobody was not found" });
  });

  it("lets viewers read it", async () => {
    const { status } = await statement("cus_atlas", undefined, viewer);
    expect(status).toBe(200);
  });

  it("only includes records in the requested currency", async () => {
    const before = (await statement("cus_kookaburra")).body.data;
    const paid = await callRoute(recordPayment, {
      method: "POST",
      path: "/api/payments",
      body: {
        customerId: "cus_kookaburra",
        currency: "USD",
        amountMinor: 12_345,
        method: "card",
        reference: "USD-ONE-OFF",
        receivedAt: new Date().toISOString(),
        allocation: { mode: "oldest_first" },
      },
    });
    expect(paid.status).toBe(201);

    const usd = (await statement("cus_kookaburra", { currency: "USD" })).body.data;
    expect(usd.lines.map((line) => [line.kind, line.reference, line.creditMinor])).toEqual([["payment", "USD-ONE-OFF", 12_345]]);
    expect(usd.closingBalanceMinor).toBe(-12_345);
    expect((await statement("cus_kookaburra", { currency: "AUD" })).body.data).toEqual(before);
  });
});
