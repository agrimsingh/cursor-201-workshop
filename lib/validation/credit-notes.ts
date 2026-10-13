import { z } from "zod";
import { CREDIT_NOTE_REASONS } from "@/lib/domain/credit-notes";
import { idSchema, positiveMinorSchema } from "@/lib/validation/common";

export const issueCreditNoteSchema = z.object({
  invoiceId: idSchema,
  amountMinor: positiveMinorSchema,
  reason: z.enum(CREDIT_NOTE_REASONS),
});
export type IssueCreditNoteInput = z.infer<typeof issueCreditNoteSchema>;
