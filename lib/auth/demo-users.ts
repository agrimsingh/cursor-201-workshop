import type { Role } from "@/lib/domain/permissions";

// Tally has no real authentication. These seeded users back the user switcher in the header.
export const DEMO_USERS = [
  { id: "user_priya", name: "Priya Shah", email: "priya@tally.test", role: "viewer" },
  { id: "user_marcus", name: "Marcus Lee", email: "marcus@tally.test", role: "agent" },
  { id: "user_dana", name: "Dana Okafor", email: "dana@tally.test", role: "admin" },
] as const satisfies readonly { id: string; name: string; email: string; role: Role }[];

export const DEFAULT_USER_ID = "user_marcus";
export const SESSION_COOKIE = "tally_user";
