import { db, type Tx } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { ACTIVE_DISPUTE_STATUSES } from "@/lib/domain/dispute-status";
import { DomainError, NotFoundError } from "@/lib/domain/errors";
import {
  asInvoiceStatus,
  invoiceBalance,
  isPastDue,
  transitionInvoice,
  type InvoiceState,
  type InvoiceStatus,
} from "@/lib/domain/invoice-status";
import { assertCan, type Actor } from "@/lib/domain/permissions";
import { recordAudit, type AuditActor } from "@/lib/services/audit";
import { nextInvoiceNumber } from "@/lib/services/numbering";
import type { CreateInvoiceInput, InvoiceListQuery } from "@/lib/validation/invoices";

type InvoiceRow = {
  status: string;
  totalMinor: number;
  amountPaidMinor: number;
  amountCreditedMinor: number;
  balanceMinor: number;
  dueDate: Date;
};

export function toInvoiceState(invoice: InvoiceRow): InvoiceState {
  return {
    status: asInvoiceStatus(invoice.status),
    totalMinor: invoice.totalMinor,
    amountPaidMinor: invoice.amountPaidMinor,
    amountCreditedMinor: invoice.amountCreditedMinor,
    dueDate: invoice.dueDate,
  };
}

export function invoiceSnapshot(invoice: InvoiceRow) {
  return {
    status: invoice.status,
    totalMinor: invoice.totalMinor,
    amountPaidMinor: invoice.amountPaidMinor,
    amountCreditedMinor: invoice.amountCreditedMinor,
    balanceMinor: invoice.balanceMinor,
  };
}

export interface InvoiceListItem {
  id: string;
  number: string;
  customer: { id: string; name: string };
  currency: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  totalMinor: number;
  balanceMinor: number;
  inDispute: boolean;
}

function orderByFor(query: InvoiceListQuery): Prisma.InvoiceOrderByWithRelationInput[] {
  const primary: Prisma.InvoiceOrderByWithRelationInput =
    query.sort === "customer" ? { customer: { name: query.order } } : { [query.sort]: query.order };
  return [primary, { number: "asc" }];
}

export async function listInvoices(query: InvoiceListQuery) {
  const where: Prisma.InvoiceWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.currency ? { currency: query.currency } : {}),
    ...(query.q
      ? { OR: [{ number: { contains: query.q } }, { customer: { name: { contains: query.q } } }] }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.invoice.findMany({
      where,
      orderBy: orderByFor(query),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        customer: { select: { id: true, name: true } },
        disputes: { where: { status: { in: [...ACTIVE_DISPUTE_STATUSES] } }, select: { id: true } },
      },
    }),
    db.invoice.count({ where }),
  ]);
  const data: InvoiceListItem[] = rows.map((row) => ({
    id: row.id,
    number: row.number,
    customer: row.customer,
    currency: row.currency,
    status: asInvoiceStatus(row.status),
    issueDate: row.issueDate.toISOString(),
    dueDate: row.dueDate.toISOString(),
    totalMinor: row.totalMinor,
    balanceMinor: row.balanceMinor,
    inDispute: row.disputes.length > 0,
  }));
  return {
    data,
    meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
  };
}

export async function getInvoiceDetail(id: string) {
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      lines: { orderBy: { position: "asc" } },
      allocations: { include: { payment: true }, orderBy: { createdAt: "asc" } },
      creditNotes: { include: { issuedBy: { select: { name: true } } }, orderBy: { issuedAt: "asc" } },
      disputes: { include: { openedBy: { select: { name: true } } }, orderBy: { openedAt: "desc" } },
    },
  });
  if (!invoice) throw new NotFoundError("Invoice", id);
  return invoice;
}
export type InvoiceDetail = Awaited<ReturnType<typeof getInvoiceDetail>>;

export async function createInvoice(actor: Actor, input: CreateInvoiceInput) {
  assertCan(actor, "invoices:create");
  if (input.dueDate < input.issueDate) {
    throw new DomainError("BUSINESS_RULE", "The due date cannot be before the issue date");
  }
  const lines = input.lines.map((line, position) => ({
    position,
    description: line.description,
    quantity: line.quantity,
    unitPriceMinor: line.unitPriceMinor,
    amountMinor: line.quantity * line.unitPriceMinor,
  }));
  const totalMinor = lines.reduce((sum, line) => sum + line.amountMinor, 0);
  if (!Number.isSafeInteger(totalMinor) || totalMinor > 2_000_000_000) {
    throw new DomainError("BUSINESS_RULE", "The invoice total is too large");
  }

  return db.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) throw new NotFoundError("Customer", input.customerId);
    const invoice = await tx.invoice.create({
      data: {
        number: await nextInvoiceNumber(tx, input.issueDate),
        customerId: customer.id,
        currency: input.currency,
        status: "draft",
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        memo: input.memo,
        totalMinor,
        balanceMinor: totalMinor,
        lines: { create: lines },
      },
    });
    await recordAudit(tx, {
      actor,
      entityType: "invoice",
      entityId: invoice.id,
      action: "invoice.created",
      before: null,
      after: invoiceSnapshot(invoice),
    });
    return invoice;
  });
}

export async function transitionInvoiceStatus(actor: Actor, id: string, action: "send" | "void", asOf = new Date()) {
  assertCan(actor, action === "send" ? "invoices:send" : "invoices:void");
  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundError("Invoice", id);
    const status = transitionInvoice(toInvoiceState(invoice), action, asOf);
    const updated = await tx.invoice.update({
      where: { id },
      data: {
        status,
        ...(action === "send" ? { sentAt: asOf } : { voidedAt: asOf, balanceMinor: 0 }),
      },
    });
    await recordAudit(tx, {
      actor,
      entityType: "invoice",
      entityId: id,
      action: action === "send" ? "invoice.sent" : "invoice.voided",
      before: invoiceSnapshot(invoice),
      after: invoiceSnapshot(updated),
    });
    return updated;
  });
}

/** The nightly sweep: flag sent / partially paid invoices whose due date has passed. */
export async function markOverdueInvoices(actor: AuditActor, asOf = new Date()) {
  if (actor !== "system") assertCan(actor, "invoices:mark_overdue");
  return db.$transaction(async (tx) => {
    const candidates = await tx.invoice.findMany({
      where: { status: { in: ["sent", "partially_paid"] }, dueDate: { lt: asOf }, balanceMinor: { gt: 0 } },
    });
    const updatedIds: string[] = [];
    for (const invoice of candidates) {
      if (!isPastDue(invoice.dueDate, asOf)) continue;
      const status = transitionInvoice(toInvoiceState(invoice), "mark_overdue", asOf);
      const updated = await tx.invoice.update({ where: { id: invoice.id }, data: { status } });
      await recordAudit(tx, {
        actor,
        entityType: "invoice",
        entityId: invoice.id,
        action: "invoice.marked_overdue",
        before: invoiceSnapshot(invoice),
        after: invoiceSnapshot(updated),
        at: asOf,
      });
      updatedIds.push(invoice.id);
    }
    return { count: updatedIds.length, invoiceIds: updatedIds };
  });
}

/**
 * Applies a payment allocation or credit note to an invoice and moves it through the
 * state machine ("settle"). Must run inside the caller's transaction.
 */
export async function applyBalanceChange(
  tx: Tx,
  invoiceId: string,
  change: { paidMinor?: number; creditedMinor?: number },
  context: { actor: Actor; asOf: Date; cause: { type: "payment" | "credit_note"; id: string } },
) {
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new NotFoundError("Invoice", invoiceId);
  const next = {
    ...toInvoiceState(invoice),
    amountPaidMinor: invoice.amountPaidMinor + (change.paidMinor ?? 0),
    amountCreditedMinor: invoice.amountCreditedMinor + (change.creditedMinor ?? 0),
  };
  const status = transitionInvoice(next, "settle", context.asOf);
  const balanceMinor = invoiceBalance(next);
  const updated = await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      status,
      amountPaidMinor: next.amountPaidMinor,
      amountCreditedMinor: next.amountCreditedMinor,
      balanceMinor,
      paidAt: status === "paid" ? context.asOf : null,
    },
  });
  await recordAudit(tx, {
    actor: context.actor,
    entityType: "invoice",
    entityId: invoiceId,
    action: "invoice.settled",
    before: invoiceSnapshot(invoice),
    after: { ...invoiceSnapshot(updated), cause: context.cause },
  });
  return updated;
}
