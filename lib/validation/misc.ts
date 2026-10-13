import { z } from "zod";
import { AUDIT_ENTITY_TYPES } from "@/lib/domain/audit";
import { dateSchema, idSchema, optionalQueryString, pageSchema, pageSizeSchema } from "@/lib/validation/common";

export const switchUserSchema = z.object({ userId: idSchema });

export const asOfQuerySchema = z.object({ asOf: dateSchema.optional() });

export const auditListQuerySchema = z.object({
  entityType: z.enum(AUDIT_ENTITY_TYPES).optional(),
  entityId: optionalQueryString,
  page: pageSchema,
  pageSize: pageSizeSchema.default(50),
});
