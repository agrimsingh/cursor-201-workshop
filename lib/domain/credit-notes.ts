import { DomainError } from "@/lib/domain/errors";
import { invoiceBalance, isOpenInvoice, type InvoiceState } from "@/lib/domain/invoice-status";

export const CREDIT_NOTE_REASONS = ["pricing_error", "goodwill", "returned_goods", "dispute_settlement", "other"] as const;
export type CreditNoteReason = (typeof CREDIT_NOTE_REASONS)[number];

/** A credit note reduces what the customer owes on one invoice. It can never exceed the balance. */
export function assertCanIssueCreditNote(invoice: InvoiceState, amountMinor: number): void {
  if (!isOpenInvoice(invoice.status)) {
    throw new DomainError("BUSINESS_RULE", `Cannot credit an invoice that is ${invoice.status}`, {
      status: invoice.status,
    });
  }
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new DomainError("BUSINESS_RULE", "Credit note amount must be a positive number of minor units", {
      amountMinor,
    });
  }
  const balance = invoiceBalance(invoice);
  if (amountMinor > balance) {
    throw new DomainError("OVER_ALLOCATION", "Credit note exceeds the invoice balance", {
      amountMinor,
      balanceMinor: balance,
    });
  }
}
