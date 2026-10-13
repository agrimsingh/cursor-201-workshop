import { handle, ok, parseParams } from "@/lib/http/route";
import { getPayment } from "@/lib/services/payments";
import { idParamsSchema } from "@/lib/validation/common";

export const GET = handle<{ id: string }>(async (_request, context) => {
  const { id } = await parseParams(context, idParamsSchema);
  return ok(await getPayment(id));
});
