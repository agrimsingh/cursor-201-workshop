import { z } from "zod";
import { DISPUTE_REASONS, DISPUTE_RESOLUTIONS, DISPUTE_REVIEW_EVENTS, DISPUTE_STATUSES } from "@/lib/domain/dispute-status";
import { idSchema, pageSchema, pageSizeSchema, positiveMinorSchema } from "@/lib/validation/common";

export const openDisputeSchema = z.object({
  invoiceId: idSchema,
  amountMinor: positiveMinorSchema,
  reason: z.enum(DISPUTE_REASONS),
  description: z.string().trim().min(5).max(1000),
});
export type OpenDisputeInput = z.infer<typeof openDisputeSchema>;

// `resolve` needs a resolution and a note, so it has its own endpoint and is not accepted here.
export const disputeTransitionSchema = z.object({
  action: z.enum(DISPUTE_REVIEW_EVENTS),
});

export const disputeListQuerySchema = z.object({
  status: z.enum(DISPUTE_STATUSES).optional(),
  page: pageSchema,
  pageSize: pageSizeSchema,
});

export const resolveDisputeSchema = z.object({
  resolution: z.enum(DISPUTE_RESOLUTIONS),
  note: z.string().trim().min(5).max(1000),
});
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;
