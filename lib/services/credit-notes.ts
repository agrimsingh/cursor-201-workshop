import { db } from "@/lib/db";
import { assertCanIssueCreditNote } from "@/lib/domain/credit-notes";
import { NotFoundError } from "@/lib/domain/errors";
import { assertCan, type Actor } from "@/lib/domain/permissions";
import { recordAudit } from "@/lib/services/audit";
import { applyBalanceChange, toInvoiceState } from "@/lib/services/invoices";
import { nextCreditNoteNumber } from "@/lib/services/numbering";
import type { IssueCreditNoteInput } from "@/lib/validation/credit-notes";

export async function issueCreditNote(actor: Actor, input: IssueCreditNoteInput, asOf = new Date()) {
  assertCan(actor, "credit_notes:issue");
  return db.$transaction(async (tx) => {
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
      after: { invoiceId: invoice.id, currency: creditNote.currency, amountMinor: creditNote.amountMinor, reason: creditNote.reason },
    });
    return creditNote;
  });
}
