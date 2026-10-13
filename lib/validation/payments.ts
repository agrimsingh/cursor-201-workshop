import { z } from "zod";
import { currencySchema, dateSchema, idSchema, optionalQueryString, pageSchema, pageSizeSchema, positiveMinorSchema } from "@/lib/validation/common";

export const PAYMENT_METHODS = ["bank_transfer", "card", "cheque"] as const;

export const recordPaymentSchema = z.object({
  customerId: idSchema,
  currency: currencySchema,
  amountMinor: positiveMinorSchema,
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(100).optional(),
  receivedAt: dateSchema,
  allocation: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("oldest_first") }),
    z.object({
      mode: z.literal("explicit"),
      lines: z
        .array(z.object({ invoiceId: idSchema, amountMinor: positiveMinorSchema }))
        .min(1)
        .max(50),
    }),
  ]),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const paymentListQuerySchema = z.object({
  customerId: optionalQueryString,
  page: pageSchema,
  pageSize: pageSizeSchema,
});
