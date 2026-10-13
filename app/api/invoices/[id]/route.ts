import { handle, ok, parseParams } from "@/lib/http/route";
import { getInvoiceDetail } from "@/lib/services/invoices";
import { idParamsSchema } from "@/lib/validation/common";

export const GET = handle<{ id: string }>(async (_request, context) => {
  const { id } = await parseParams(context, idParamsSchema);
  return ok(await getInvoiceDetail(id));
});
