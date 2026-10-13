import { actorFromRequest } from "@/lib/auth/session";
import { handle, ok, parseJson } from "@/lib/http/route";
import { markOverdueInvoices } from "@/lib/services/invoices";
import { markOverdueSchema } from "@/lib/validation/invoices";

// POST /api/invoices/mark-overdue  { "asOf"?: "2026-10-13" }
// Runs the overdue sweep on demand (normally a nightly job).
export const POST = handle(async (request) => {
  const { asOf } = await parseJson(request, markOverdueSchema);
  const actor = await actorFromRequest(request);
  return ok(await markOverdueInvoices(actor, asOf));
});
