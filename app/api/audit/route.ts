import { actorFromRequest } from "@/lib/auth/session";
import { assertCan } from "@/lib/domain/permissions";
import { handle, okList, parseQuery } from "@/lib/http/route";
import { listAuditEntries } from "@/lib/services/audit";
import { auditListQuerySchema } from "@/lib/validation/misc";

export const GET = handle(async (request) => {
  const query = parseQuery(request, auditListQuerySchema);
  assertCan(await actorFromRequest(request), "audit:read");
  const { data, meta } = await listAuditEntries(query);
  return okList(data, meta);
});
