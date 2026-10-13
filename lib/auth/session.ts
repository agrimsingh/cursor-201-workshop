import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { DEFAULT_USER_ID, SESSION_COOKIE } from "@/lib/auth/demo-users";
import { isRole, type Actor } from "@/lib/domain/permissions";
import { db } from "@/lib/db";

// Mocked "current user": the id of a seeded user stored in a cookie.
// Swap this module for a real identity provider and nothing else needs to change.

async function resolveActor(userId: string | undefined): Promise<Actor> {
  const user =
    (userId ? await db.user.findUnique({ where: { id: userId } }) : null) ??
    (await db.user.findUnique({ where: { id: DEFAULT_USER_ID } }));
  if (!user || !isRole(user.role)) {
    throw new Error("No demo users found. Run `npx prisma db seed` to load them.");
  }
  return { id: user.id, name: user.name, role: user.role };
}

/** Current user inside route handlers. */
export function actorFromRequest(request: NextRequest): Promise<Actor> {
  return resolveActor(request.cookies.get(SESSION_COOKIE)?.value);
}

/** Current user inside server components and server actions. */
export async function currentActor(): Promise<Actor> {
  const store = await cookies();
  return resolveActor(store.get(SESSION_COOKIE)?.value);
}
