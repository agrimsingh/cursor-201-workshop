import { z } from "zod";
import { currencySchema } from "@/lib/validation/common";

/** Query string accepted by GET /api/customers/:id/statement. Defaults to the customer's billing currency. */
export const customerStatementQuerySchema = z.object({
  currency: currencySchema.optional(),
});
export type CustomerStatementQuery = z.infer<typeof customerStatementQuerySchema>;
