import { db } from "@/lib/db";
import { asDisputeStatus, assertCanOpenDispute, transitionDispute, type DisputeEvent, type DisputeStatus } from "@/lib/domain/dispute-status";
import { NotFoundError } from "@/lib/domain/errors";
import { assertCan, type Actor } from "@/lib/domain/permissions";
import { recordAudit } from "@/lib/services/audit";
import { toInvoiceState } from "@/lib/services/invoices";
import type { OpenDisputeInput } from "@/lib/validation/disputes";

const AUDIT_ACTION_BY_EVENT = {
  start_review: "dispute.review_started",
  withdraw: "dispute.withdrawn",
} as const satisfies Record<DisputeEvent, string>;

function disputeSnapshot(dispute: { status: string; amountMinor: number; currency: string; reason: string }) {
  return { status: dispute.status, amountMinor: dispute.amountMinor, currency: dispute.currency, reason: dispute.reason };
}

export async function openDispute(actor: Actor, input: OpenDisputeInput) {
  assertCan(actor, "disputes:open");
  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: input.invoiceId },
      include: { disputes: { select: { status: true } } },
    });
    if (!invoice) throw new NotFoundError("Invoice", input.invoiceId);
    assertCanOpenDispute(
      toInvoiceState(invoice),
      input.amountMinor,
      invoice.disputes.map((dispute) => dispute.status),
    );
    const dispute = await tx.dispute.create({
      data: {
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        status: "open",
        reason: input.reason,
        description: input.description,
        currency: invoice.currency,
        amountMinor: input.amountMinor,
        openedById: actor.id,
      },
    });
    await recordAudit(tx, {
      actor,
      entityType: "dispute",
      entityId: dispute.id,
      action: "dispute.opened",
      before: null,
      after: { ...disputeSnapshot(dispute), invoiceId: invoice.id },
    });
    return dispute;
  });
}

export async function transitionDisputeStatus(actor: Actor, id: string, event: DisputeEvent) {
  assertCan(actor, "disputes:review");
  return db.$transaction(async (tx) => {
    const dispute = await tx.dispute.findUnique({ where: { id } });
    if (!dispute) throw new NotFoundError("Dispute", id);
    const status = transitionDispute(asDisputeStatus(dispute.status), event);
    const updated = await tx.dispute.update({ where: { id }, data: { status } });
    await recordAudit(tx, {
      actor,
      entityType: "dispute",
      entityId: id,
      action: AUDIT_ACTION_BY_EVENT[event],
      before: disputeSnapshot(dispute),
      after: disputeSnapshot(updated),
    });
    return updated;
  });
}

export async function listDisputes(query: { status?: DisputeStatus; page: number; pageSize: number }) {
  const where = query.status ? { status: query.status } : {};
  const [rows, total] = await Promise.all([
    db.dispute.findMany({
      where,
      orderBy: [{ openedAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        customer: { select: { id: true, name: true } },
        invoice: { select: { id: true, number: true } },
        openedBy: { select: { name: true } },
      },
    }),
    db.dispute.count({ where }),
  ]);
  return {
    data: rows,
    meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
  };
}

export async function getDisputeDetail(id: string) {
  const dispute = await db.dispute.findUnique({
    where: { id },
    include: {
      customer: true,
      invoice: true,
      openedBy: { select: { name: true } },
    },
  });
  if (!dispute) throw new NotFoundError("Dispute", id);
  return dispute;
}
export type DisputeDetail = Awaited<ReturnType<typeof getDisputeDetail>>;
