import type { Tx } from "@/lib/db";

/** Next document number such as INV-2026-0042 or CN-0007. Call inside the creating transaction. */
export async function nextInvoiceNumber(tx: Tx, issueDate: Date): Promise<string> {
  const prefix = `INV-${issueDate.getUTCFullYear()}-`;
  const last = await tx.invoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const sequence = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

export async function nextCreditNoteNumber(tx: Tx): Promise<string> {
  const last = await tx.creditNote.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  const sequence = last ? Number(last.number.slice("CN-".length)) + 1 : 1;
  return `CN-${String(sequence).padStart(4, "0")}`;
}
