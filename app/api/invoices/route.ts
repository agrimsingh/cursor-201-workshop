import { actorFromRequest } from "@/lib/auth/session";
import { created, handle, okList, parseJson, parseQuery } from "@/lib/http/route";
import { createInvoice, listInvoices } from "@/lib/services/invoices";
import { createInvoiceSchema, invoiceListQuerySchema } from "@/lib/validation/invoices";

// GET /api/invoices?status=overdue&currency=AUD&q=kook&sort=dueDate&order=asc&page=1&pageSize=20
export const GET = handle(async (request) => {
  const query = parseQuery(request, invoiceListQuerySchema);
  const { data, meta } = await listInvoices(query);
  return okList(data, meta);
});

// POST /api/invoices creates a draft invoice.
export const POST = handle(async (request) => {
  const input = await parseJson(request, createInvoiceSchema);
  const actor = await actorFromRequest(request);
  return created(await createInvoice(actor, input));
});
