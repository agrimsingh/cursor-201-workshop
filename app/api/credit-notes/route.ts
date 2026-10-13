import { actorFromRequest } from "@/lib/auth/session";
import { created, handle, parseJson } from "@/lib/http/route";
import { issueCreditNote } from "@/lib/services/credit-notes";
import { issueCreditNoteSchema } from "@/lib/validation/credit-notes";

// POST /api/credit-notes  { "invoiceId", "amountMinor", "reason" }
export const POST = handle(async (request) => {
  const input = await parseJson(request, issueCreditNoteSchema);
  const actor = await actorFromRequest(request);
  return created(await issueCreditNote(actor, input));
});
