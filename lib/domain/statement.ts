import type { InvoiceStatus } from "@/lib/domain/invoice-status";
import { sumMinor } from "@/lib/money";

// Customer statement: every invoice (debit), payment and credit note (credits) in one
// currency, in date order, with a running balance. Amounts are integer minor units.

/** Invoices that appear on a statement: sent or later. Drafts and voided invoices never do. */
export const STATEMENT_INVOICE_STATUSES: readonly InvoiceStatus[] = ["sent", "partially_paid", "overdue", "paid"];

export const STATEMENT_LINE_KINDS = ["invoice", "credit_note", "payment"] as const;
export type StatementLineKind = (typeof STATEMENT_LINE_KINDS)[number];

export interface StatementInvoice {
  id: string;
  number: string;
  currency: string;
  status: InvoiceStatus;
  issueDate: Date;
  totalMinor: number;
}

export interface StatementPayment {
  id: string;
  currency: string;
  amountMinor: number;
  method: string;
  reference: string | null;
  receivedAt: Date;
}

export interface StatementCreditNote {
  id: string;
  number: string;
  currency: string;
  amountMinor: number;
  issuedAt: Date;
  invoiceNumber: string;
  invoiceStatus: InvoiceStatus;
}

export interface StatementLine {
  date: Date;
  kind: StatementLineKind;
  id: string;
  reference: string | null;
  description: string;
  debitMinor: number;
  creditMinor: number;
  balanceMinor: number;
}

export interface StatementTotals {
  lines: StatementLine[];
  totalDebitsMinor: number;
  totalCreditsMinor: number;
  closingBalanceMinor: number;
}

export interface StatementInput {
  currency: string;
  invoices: readonly StatementInvoice[];
  payments: readonly StatementPayment[];
  creditNotes: readonly StatementCreditNote[];
}

const KIND_ORDER: Record<StatementLineKind, number> = { invoice: 0, credit_note: 1, payment: 2 };

function isStatementInvoice(status: InvoiceStatus): boolean {
  return STATEMENT_INVOICE_STATUSES.includes(status);
}

/**
 * Builds the statement lines and balances. Lines are sorted by date; on the same day
 * invoices come before credits so the running balance doesn't dip below what was billed.
 * A payment counts in full (including any unapplied credit). Credit notes against
 * invoices that are not on the statement (draft or void) are left out too.
 */
export function buildStatement(input: StatementInput): StatementTotals {
  const { currency } = input;
  const unsorted: Omit<StatementLine, "balanceMinor">[] = [
    ...input.invoices
      .filter((invoice) => invoice.currency === currency && isStatementInvoice(invoice.status))
      .map((invoice) => ({
        date: invoice.issueDate,
        kind: "invoice" as const,
        id: invoice.id,
        reference: invoice.number,
        description: `Invoice ${invoice.number}`,
        debitMinor: invoice.totalMinor,
        creditMinor: 0,
      })),
    ...input.creditNotes
      .filter((note) => note.currency === currency && isStatementInvoice(note.invoiceStatus))
      .map((note) => ({
        date: note.issuedAt,
        kind: "credit_note" as const,
        id: note.id,
        reference: note.number,
        description: `Credit note ${note.number} on ${note.invoiceNumber}`,
        debitMinor: 0,
        creditMinor: note.amountMinor,
      })),
    ...input.payments
      .filter((payment) => payment.currency === currency)
      .map((payment) => ({
        date: payment.receivedAt,
        kind: "payment" as const,
        id: payment.id,
        reference: payment.reference,
        description: `Payment by ${payment.method.replace(/_/g, " ")}`,
        debitMinor: 0,
        creditMinor: payment.amountMinor,
      })),
  ];

  unsorted.sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      (a.reference ?? "").localeCompare(b.reference ?? "") ||
      a.id.localeCompare(b.id),
  );

  let balanceMinor = 0;
  const lines = unsorted.map((line) => {
    balanceMinor += line.debitMinor - line.creditMinor;
    return { ...line, balanceMinor };
  });

  const totalDebitsMinor = sumMinor(lines.map((line) => line.debitMinor));
  const totalCreditsMinor = sumMinor(lines.map((line) => line.creditMinor));
  return { lines, totalDebitsMinor, totalCreditsMinor, closingBalanceMinor: totalDebitsMinor - totalCreditsMinor };
}
