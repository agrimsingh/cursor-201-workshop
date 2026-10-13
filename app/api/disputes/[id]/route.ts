import { handle, ok, parseParams } from "@/lib/http/route";
import { getDisputeDetail } from "@/lib/services/disputes";
import { idParamsSchema } from "@/lib/validation/common";

export const GET = handle<{ id: string }>(async (_request, context) => {
  const { id } = await parseParams(context, idParamsSchema);
  return ok(await getDisputeDetail(id));
});
