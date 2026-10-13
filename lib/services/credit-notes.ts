import { db, type Tx } from "@/lib/db";
import { assertCanIssueCreditNote } from "@/lib/domain/credit-notes";
import { NotFoundError } from "@/lib/domain/errors";
import { assertCan, type Actor } from "@/lib/domain/permissions";
import { recordAudit } from "@/lib/services/audit";
import { applyBalanceChange, toInvoiceState } from "@/lib/services/invoices";
import { nextCreditNoteNumber } from "@/lib/services/numbering";
import type { IssueCreditNoteInput } from "@/lib/validation/credit-notes";

export async function issueCreditNote(actor: Actor, input: IssueCreditNoteInput, asOf = new Date()) {
  assertCan(actor, "credit_notes:issue");
  return db.$transaction((tx) => createCreditNoteInTx(tx, actor, input, asOf));
}

/**
 * Issues a credit note inside the caller's transaction: settles the invoice and audits it.
 * Callers check permissions themselves.
 */
export async function createCreditNoteInTx(
  tx: Tx,
  actor: Actor,
  input: IssueCreditNoteInput & { disputeId?: string },
  asOf: Date,
) {
  const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId } });
  if (!invoice) throw new NotFoundError("Invoice", input.invoiceId);
  assertCanIssueCreditNote(toInvoiceState(invoice), input.amountMinor);

  const creditNote = await tx.creditNote.create({
    data: {
      number: await nextCreditNoteNumber(tx),
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      currency: invoice.currency,
      amountMinor: input.amountMinor,
      reason: input.reason,
      issuedById: actor.id,
      issuedAt: asOf,
      disputeId: input.disputeId,
    },
  });
  await applyBalanceChange(tx, invoice.id, { creditedMinor: input.amountMinor }, {
    actor,
    asOf,
    cause: { type: "credit_note", id: creditNote.id },
  });
  await recordAudit(tx, {
    actor,
    entityType: "credit_note",
    entityId: creditNote.id,
    action: "credit_note.issued",
    before: null,
    after: {
      invoiceId: invoice.id,
      currency: creditNote.currency,
      amountMinor: creditNote.amountMinor,
      reason: creditNote.reason,
      ...(creditNote.disputeId ? { disputeId: creditNote.disputeId } : {}),
    },
  });
  return creditNote;
}
