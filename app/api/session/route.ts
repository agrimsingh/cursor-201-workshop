import { SESSION_COOKIE } from "@/lib/auth/demo-users";
import { actorFromRequest } from "@/lib/auth/session";
import { capabilitiesFor } from "@/lib/domain/permissions";
import { NotFoundError } from "@/lib/domain/errors";
import { handle, ok, parseJson } from "@/lib/http/route";
import { listUsers } from "@/lib/services/users";
import { switchUserSchema } from "@/lib/validation/misc";

// GET /api/session -> who am I and what can I do?
export const GET = handle(async (request) => {
  const actor = await actorFromRequest(request);
  return ok({ ...actor, capabilities: capabilitiesFor(actor.role) });
});

// PUT /api/session { "userId": "user_dana" } -> switch the mocked current user.
export const PUT = handle(async (request) => {
  const { userId } = await parseJson(request, switchUserSchema);
  const user = (await listUsers()).find((candidate) => candidate.id === userId);
  if (!user) throw new NotFoundError("User", userId);
  const response = ok(user);
  response.cookies.set(SESSION_COOKIE, user.id, { path: "/", sameSite: "lax", httpOnly: true });
  return response;
});
