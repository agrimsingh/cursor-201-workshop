import { actorFromRequest } from "@/lib/auth/session";
import { created, handle, okList, parseJson, parseQuery } from "@/lib/http/route";
import { listDisputes, openDispute } from "@/lib/services/disputes";
import { disputeListQuerySchema, openDisputeSchema } from "@/lib/validation/disputes";

export const GET = handle(async (request) => {
  const query = parseQuery(request, disputeListQuerySchema);
  const { data, meta } = await listDisputes(query);
  return okList(data, meta);
});

// POST /api/disputes opens a dispute against an invoice.
export const POST = handle(async (request) => {
  const input = await parseJson(request, openDisputeSchema);
  const actor = await actorFromRequest(request);
  return created(await openDispute(actor, input));
});
