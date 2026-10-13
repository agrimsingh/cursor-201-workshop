import { actorFromRequest } from "@/lib/auth/session";
import { handle, ok, parseJson, parseParams } from "@/lib/http/route";
import { transitionInvoiceStatus } from "@/lib/services/invoices";
import { idParamsSchema } from "@/lib/validation/common";
import { invoiceTransitionSchema } from "@/lib/validation/invoices";

// POST /api/invoices/:id/transitions  { "action": "send" | "void" }
export const POST = handle<{ id: string }>(async (request, context) => {
  const { id } = await parseParams(context, idParamsSchema);
  const { action } = await parseJson(request, invoiceTransitionSchema);
  const actor = await actorFromRequest(request);
  return ok(await transitionInvoiceStatus(actor, id, action));
});
