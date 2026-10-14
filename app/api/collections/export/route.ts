import { NextResponse } from "next/server";
import { collectionsExportFilename, collectionsQueueToCsv } from "@/lib/collections-export";
import { handle, parseQuery } from "@/lib/http/route";
import { collectionsQueue } from "@/lib/services/reports";
import { asOfQuerySchema } from "@/lib/validation/misc";

// GET /api/collections/export?asOf=2026-10-13  -> CSV download of the collections queue
export const GET = handle(async (request) => {
  const { asOf } = parseQuery(request, asOfQuerySchema);
  const at = asOf ?? new Date();
  const queue = await collectionsQueue(at);
  const csv = collectionsQueueToCsv(queue);
  const filename = collectionsExportFilename(at);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
