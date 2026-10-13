import { describe, expect, it } from "vitest";
import {
  buildStatement,
  type StatementCreditNote,
  type StatementInvoice,
  type StatementPayment,
} from "@/lib/domain/statement";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

function invoice(number: string, issued: string, totalMinor: number, overrides: Partial<StatementInvoice> = {}): StatementInvoice {
  return { id: `inv_${number}`, number, currency: "AUD", status: "sent", issueDate: day(issued), totalMinor, ...overrides };
}

function payment(id: string, received: string, amountMinor: number, overrides: Partial<StatementPayment> = {}): StatementPayment {
  return { id, currency: "AUD", amountMinor, method: "bank_transfer", reference: null, receivedAt: day(received), ...overrides };
}

function creditNote(number: string, issued: string, amountMinor: number, overrides: Partial<StatementCreditNote> = {}): StatementCreditNote {
  return {
    id: `cn_${number}`,
    number,
    currency: "AUD",
    amountMinor,
    issuedAt: day(issued),
    invoiceNumber: "INV-1",
    invoiceStatus: "partially_paid",
    ...overrides,
  };
}

describe("buildStatement", () => {
  it("sorts lines by date and keeps a running balance", () => {
    const statement = buildStatement({
      currency: "AUD",
      invoices: [invoice("INV-2", "2026-03-01", 50_000), invoice("INV-1", "2026-01-01", 100_000, { status: "paid" })],
      payments: [payment("pay_1", "2026-02-01", 100_000, { reference: "EFT-1" })],
      creditNotes: [creditNote("CN-1", "2026-03-10", 5_000, { invoiceNumber: "INV-2" })],
    });

    expect(statement.lines.map((line) => [line.kind, line.reference, line.debitMinor, line.creditMinor, line.balanceMinor])).toEqual([
      ["invoice", "INV-1", 100_000, 0, 100_000],
      ["payment", "EFT-1", 0, 100_000, 0],
      ["invoice", "INV-2", 50_000, 0, 50_000],
      ["credit_note", "CN-1", 0, 5_000, 45_000],
    ]);
    expect(statement).toMatchObject({ totalDebitsMinor: 150_000, totalCreditsMinor: 105_000, closingBalanceMinor: 45_000 });
    expect(statement.lines[3].description).toBe("Credit note CN-1 on INV-2");
  });

  it("leaves out drafts, voided invoices and credit notes against them", () => {
    const statement = buildStatement({
      currency: "AUD",
      invoices: [
        invoice("INV-1", "2026-01-01", 10_000, { status: "draft" }),
        invoice("INV-2", "2026-01-02", 20_000, { status: "void" }),
        invoice("INV-3", "2026-01-03", 30_000, { status: "overdue" }),
      ],
      payments: [],
      creditNotes: [creditNote("CN-1", "2026-01-04", 1_000, { invoiceStatus: "void" })],
    });
    expect(statement.lines.map((line) => line.reference)).toEqual(["INV-3"]);
    expect(statement.closingBalanceMinor).toBe(30_000);
  });

  it("only includes records in the requested currency", () => {
    const statement = buildStatement({
      currency: "USD",
      invoices: [invoice("INV-1", "2026-01-01", 10_000), invoice("INV-2", "2026-01-02", 7_000, { currency: "USD" })],
      payments: [payment("pay_1", "2026-01-03", 10_000), payment("pay_2", "2026-01-04", 2_000, { currency: "USD" })],
      creditNotes: [creditNote("CN-1", "2026-01-05", 500)],
    });
    expect(statement.lines.map((line) => line.id)).toEqual(["inv_INV-2", "pay_2"]);
    expect(statement.closingBalanceMinor).toBe(5_000);
  });

  it("counts the full payment, so unapplied credit makes the balance negative", () => {
    const statement = buildStatement({
      currency: "AUD",
      invoices: [invoice("INV-1", "2026-01-01", 10_000, { status: "paid" })],
      payments: [payment("pay_1", "2026-01-10", 12_500)],
      creditNotes: [],
    });
    expect(statement.closingBalanceMinor).toBe(-2_500);
    expect(statement.lines.at(-1)?.description).toBe("Payment by bank transfer");
  });

  it("puts invoices before credits on the same day, then orders by reference", () => {
    const statement = buildStatement({
      currency: "AUD",
      invoices: [invoice("INV-2", "2026-01-01", 2_000), invoice("INV-1", "2026-01-01", 1_000)],
      payments: [payment("pay_1", "2026-01-01", 3_000)],
      creditNotes: [],
    });
    expect(statement.lines.map((line) => [line.id, line.balanceMinor])).toEqual([
      ["inv_INV-1", 1_000],
      ["inv_INV-2", 3_000],
      ["pay_1", 0],
    ]);
  });

  it("returns an empty statement with a zero balance when there is nothing to show", () => {
    expect(buildStatement({ currency: "JPY", invoices: [], payments: [], creditNotes: [] })).toEqual({
      lines: [],
      totalDebitsMinor: 0,
      totalCreditsMinor: 0,
      closingBalanceMinor: 0,
    });
  });
});
