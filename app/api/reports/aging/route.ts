import { handle, ok, parseQuery } from "@/lib/http/route";
import { agingReport } from "@/lib/services/reports";
import { asOfQuerySchema } from "@/lib/validation/misc";

// GET /api/reports/aging?asOf=2026-10-13
export const GET = handle(async (request) => {
  const { asOf } = parseQuery(request, asOfQuerySchema);
  return ok(await agingReport(asOf));
});
