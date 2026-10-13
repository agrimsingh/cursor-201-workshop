import { z } from "zod";
import { DISPUTE_EVENTS, DISPUTE_REASONS, DISPUTE_STATUSES } from "@/lib/domain/dispute-status";
import { idSchema, pageSchema, pageSizeSchema, positiveMinorSchema } from "@/lib/validation/common";

export const openDisputeSchema = z.object({
  invoiceId: idSchema,
  amountMinor: positiveMinorSchema,
  reason: z.enum(DISPUTE_REASONS),
  description: z.string().trim().min(5).max(1000),
});
export type OpenDisputeInput = z.infer<typeof openDisputeSchema>;

export const disputeTransitionSchema = z.object({
  action: z.enum(DISPUTE_EVENTS),
});

export const disputeListQuerySchema = z.object({
  status: z.enum(DISPUTE_STATUSES).optional(),
  page: pageSchema,
  pageSize: pageSizeSchema,
});
