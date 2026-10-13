import { actorFromRequest } from "@/lib/auth/session";
import { created, handle, okList, parseJson, parseQuery } from "@/lib/http/route";
import { listPayments, recordPayment } from "@/lib/services/payments";
import { paymentListQuerySchema, recordPaymentSchema } from "@/lib/validation/payments";

export const GET = handle(async (request) => {
  const query = parseQuery(request, paymentListQuerySchema);
  const { data, meta } = await listPayments(query);
  return okList(data, meta);
});

// POST /api/payments records a payment and allocates it across invoices.
export const POST = handle(async (request) => {
  const input = await parseJson(request, recordPaymentSchema);
  const actor = await actorFromRequest(request);
  return created(await recordPayment(actor, input));
});
