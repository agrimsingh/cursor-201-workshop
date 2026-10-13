import { handle, ok, parseParams, parseQuery } from "@/lib/http/route";
import { getCustomerStatement } from "@/lib/services/customers";
import { idParamsSchema } from "@/lib/validation/common";
import { customerStatementQuerySchema } from "@/lib/validation/customers";

// GET /api/customers/cus_kookaburra/statement?currency=AUD
export const GET = handle<{ id: string }>(async (request, context) => {
  const { id } = await parseParams(context, idParamsSchema);
  const query = parseQuery(request, customerStatementQuerySchema);
  return ok(await getCustomerStatement(id, query));
});
