import { actorFromRequest } from "@/lib/auth/session";
import { handle, ok, parseJson, parseParams } from "@/lib/http/route";
import { resolveDispute } from "@/lib/services/disputes";
import { idParamsSchema } from "@/lib/validation/common";
import { resolveDisputeSchema } from "@/lib/validation/disputes";

// POST /api/disputes/:id/resolve  { "resolution": "accepted" | "rejected", "note": "..." }
export const POST = handle<{ id: string }>(async (request, context) => {
  const { id } = await parseParams(context, idParamsSchema);
  const input = await parseJson(request, resolveDisputeSchema);
  const actor = await actorFromRequest(request);
  return ok(await resolveDispute(actor, id, input));
});
