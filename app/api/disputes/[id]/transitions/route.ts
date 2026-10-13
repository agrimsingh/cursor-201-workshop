import { actorFromRequest } from "@/lib/auth/session";
import { handle, ok, parseJson, parseParams } from "@/lib/http/route";
import { transitionDisputeStatus } from "@/lib/services/disputes";
import { idParamsSchema } from "@/lib/validation/common";
import { disputeTransitionSchema } from "@/lib/validation/disputes";

// POST /api/disputes/:id/transitions  { "action": "start_review" | "withdraw" }
export const POST = handle<{ id: string }>(async (request, context) => {
  const { id } = await parseParams(context, idParamsSchema);
  const { action } = await parseJson(request, disputeTransitionSchema);
  const actor = await actorFromRequest(request);
  return ok(await transitionDisputeStatus(actor, id, action));
});
