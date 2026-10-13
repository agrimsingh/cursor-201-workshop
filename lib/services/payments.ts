import { db } from "@/lib/db";
import { planAllocation, type AllocatableInvoice } from "@/lib/domain/allocation";
import { NotFoundError } from "@/lib/domain/errors";
import { OPEN_INVOICE_STATUSES } from "@/lib/domain/invoice-status";
import { assertCan, type Actor } from "@/lib/domain/permissions";
import { recordAudit } from "@/lib/services/audit";
import { applyBalanceChange, toInvoiceState } from "@/lib/services/invoices";
import type { RecordPaymentInput } from "@/lib/validation/payments";

export async function recordPayment(actor: Actor, input: RecordPaymentInput, asOf = new Date()) {
  assertCan(actor, "payments:record");
  const requestedIds = input.allocation.mode === "explicit" ? input.allocation.lines.map((line) => line.invoiceId) : [];

  return db.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) throw new NotFoundError("Customer", input.customerId);

    const rows = await tx.invoice.findMany({
      where: {
        OR: [{ customerId: customer.id, status: { in: [...OPEN_INVOICE_STATUSES] } }, { id: { in: requestedIds } }],
      },
    });
    const invoices: AllocatableInvoice[] = rows.map((row) => ({
      ...toInvoiceState(row),
      id: row.id,
      number: row.number,
      customerId: row.customerId,
      currency: row.currency,
      issueDate: row.issueDate,
    }));
    const plan = planAllocation(
      { customerId: customer.id, currency: input.currency, amountMinor: input.amountMinor },
      invoices,
      input.allocation.mode === "explicit" ? input.allocation.lines : undefined,
    );

    const payment = await tx.payment.create({
      data: {
        customerId: customer.id,
        currency: input.currency,
        amountMinor: input.amountMinor,
        unappliedMinor: plan.unappliedMinor,
        method: input.method,
        reference: input.reference,
        receivedAt: input.receivedAt,
        recordedById: actor.id,
        allocations: { create: plan.allocations },
      },
      include: { allocations: true },
    });

    for (const line of plan.allocations) {
      await applyBalanceChange(tx, line.invoiceId, { paidMinor: line.amountMinor }, {
        actor,
        asOf,
        cause: { type: "payment", id: payment.id },
      });
    }

    await recordAudit(tx, {
      actor,
      entityType: "payment",
      entityId: payment.id,
      action: "payment.recorded",
      before: null,
      after: {
        customerId: customer.id,
        currency: payment.currency,
        amountMinor: payment.amountMinor,
        unappliedMinor: payment.unappliedMinor,
        allocations: plan.allocations,
      },
    });
    return payment;
  });
}

export async function listPayments(query: { customerId?: string; page: number; pageSize: number }) {
  const where = query.customerId ? { customerId: query.customerId } : {};
  const [rows, total] = await Promise.all([
    db.payment.findMany({
      where,
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        customer: { select: { id: true, name: true } },
        recordedBy: { select: { name: true } },
        allocations: { include: { invoice: { select: { id: true, number: true } } } },
      },
    }),
    db.payment.count({ where }),
  ]);
  return {
    data: rows,
    meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
  };
}

export async function getPayment(id: string) {
  const payment = await db.payment.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true } },
      recordedBy: { select: { name: true } },
      allocations: { include: { invoice: { select: { id: true, number: true, status: true } } } },
    },
  });
  if (!payment) throw new NotFoundError("Payment", id);
  return payment;
}
