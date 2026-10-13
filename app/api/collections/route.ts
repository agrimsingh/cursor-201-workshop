import { handle, ok, parseQuery } from "@/lib/http/route";
import { collectionsQueue } from "@/lib/services/reports";
import { asOfQuerySchema } from "@/lib/validation/misc";

// GET /api/collections?asOf=2026-10-13  -> past-due invoices to chase, most overdue first
export const GET = handle(async (request) => {
  const { asOf } = parseQuery(request, asOfQuerySchema);
  return ok(await collectionsQueue(asOf));
});
