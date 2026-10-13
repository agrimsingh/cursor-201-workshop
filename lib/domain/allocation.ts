import { DomainError } from "@/lib/domain/errors";
import { invoiceBalance, isOpenInvoice, type InvoiceStatus } from "@/lib/domain/invoice-status";

// Allocating a payment across invoices.
//
// - Explicit: the caller lists invoice ids and amounts. Every line is validated.
// - Automatic: oldest due date first until the payment runs out.
// Whatever is not allocated stays on the payment as unapplied customer credit.

export interface AllocatableInvoice {
  id: string;
  number: string;
  customerId: string;
  currency: string;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  totalMinor: number;
  amountPaidMinor: number;
  amountCreditedMinor: number;
}

export interface AllocationLine {
  invoiceId: string;
  amountMinor: number;
}

export interface AllocationPlan {
  allocations: AllocationLine[];
  allocatedMinor: number;
  unappliedMinor: number;
}

export interface PaymentToAllocate {
  customerId: string;
  currency: string;
  amountMinor: number;
}

function assertPositiveMinor(amountMinor: number, label: string): void {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new DomainError("BUSINESS_RULE", `${label} must be a positive number of minor units`, { amountMinor });
  }
}

function assertAllocatable(payment: PaymentToAllocate, invoice: AllocatableInvoice): void {
  if (invoice.customerId !== payment.customerId) {
    throw new DomainError("BUSINESS_RULE", `Invoice ${invoice.number} belongs to a different customer`, {
      invoiceId: invoice.id,
    });
  }
  if (invoice.currency !== payment.currency) {
    throw new DomainError(
      "CURRENCY_MISMATCH",
      `Invoice ${invoice.number} is in ${invoice.currency} but the payment is in ${payment.currency}`,
      { invoiceId: invoice.id },
    );
  }
  if (!isOpenInvoice(invoice.status)) {
    throw new DomainError("BUSINESS_RULE", `Invoice ${invoice.number} is ${invoice.status} and cannot take payments`, {
      invoiceId: invoice.id,
      status: invoice.status,
    });
  }
}

export function byOldestDue(a: AllocatableInvoice, b: AllocatableInvoice): number {
  return (
    a.dueDate.getTime() - b.dueDate.getTime() ||
    a.issueDate.getTime() - b.issueDate.getTime() ||
    a.number.localeCompare(b.number)
  );
}

export function planAllocation(
  payment: PaymentToAllocate,
  invoices: readonly AllocatableInvoice[],
  requested?: readonly AllocationLine[],
): AllocationPlan {
  assertPositiveMinor(payment.amountMinor, "Payment amount");
  const allocations = requested ? planExplicit(payment, invoices, requested) : planOldestFirst(payment, invoices);
  const allocatedMinor = allocations.reduce((sum, line) => sum + line.amountMinor, 0);
  if (allocatedMinor > payment.amountMinor) {
    throw new DomainError("OVER_ALLOCATION", "Allocations exceed the payment amount", {
      allocatedMinor,
      paymentMinor: payment.amountMinor,
    });
  }
  return { allocations, allocatedMinor, unappliedMinor: payment.amountMinor - allocatedMinor };
}

function planExplicit(
  payment: PaymentToAllocate,
  invoices: readonly AllocatableInvoice[],
  requested: readonly AllocationLine[],
): AllocationLine[] {
  const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const seen = new Set<string>();
  return requested.map((line) => {
    if (seen.has(line.invoiceId)) {
      throw new DomainError("BUSINESS_RULE", "Each invoice can appear only once in an allocation", {
        invoiceId: line.invoiceId,
      });
    }
    seen.add(line.invoiceId);
    const invoice = byId.get(line.invoiceId);
    if (!invoice) throw new DomainError("NOT_FOUND", `Invoice ${line.invoiceId} was not found`, { invoiceId: line.invoiceId });
    assertAllocatable(payment, invoice);
    assertPositiveMinor(line.amountMinor, "Allocation amount");
    const balance = invoiceBalance(invoice);
    if (line.amountMinor > balance) {
      throw new DomainError("OVER_ALLOCATION", `Allocation exceeds the balance of invoice ${invoice.number}`, {
        invoiceId: invoice.id,
        amountMinor: line.amountMinor,
        balanceMinor: balance,
      });
    }
    return { invoiceId: invoice.id, amountMinor: line.amountMinor };
  });
}

function planOldestFirst(payment: PaymentToAllocate, invoices: readonly AllocatableInvoice[]): AllocationLine[] {
  let remaining = payment.amountMinor;
  const allocations: AllocationLine[] = [];
  const candidates = invoices
    .filter(
      (invoice) =>
        invoice.customerId === payment.customerId &&
        invoice.currency === payment.currency &&
        isOpenInvoice(invoice.status) &&
        invoiceBalance(invoice) > 0,
    )
    .sort(byOldestDue);
  for (const invoice of candidates) {
    if (remaining === 0) break;
    const amountMinor = Math.min(remaining, invoiceBalance(invoice));
    allocations.push({ invoiceId: invoice.id, amountMinor });
    remaining -= amountMinor;
  }
  return allocations;
}
