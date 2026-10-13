import { ForbiddenError } from "@/lib/domain/errors";

// Role-based access. Everyone can read invoices, customers, payments and disputes;
// capabilities below gate everything else. The current user is mocked (lib/auth/session.ts).

export const ROLES = ["viewer", "agent", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const CAPABILITIES = [
  "invoices:create",
  "invoices:send",
  "invoices:void",
  "invoices:mark_overdue",
  "payments:record",
  "credit_notes:issue",
  "disputes:open",
  "disputes:review",
  "audit:read",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const GRANTS: Record<Role, readonly Capability[]> = {
  viewer: [],
  agent: [
    "invoices:create",
    "invoices:send",
    "invoices:mark_overdue",
    "payments:record",
    "disputes:open",
    "disputes:review",
    "audit:read",
  ],
  admin: CAPABILITIES,
};

export interface Actor {
  id: string;
  name: string;
  role: Role;
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function can(role: Role, capability: Capability): boolean {
  return GRANTS[role].includes(capability);
}

export function assertCan(actor: Actor, capability: Capability): void {
  if (!can(actor.role, capability)) {
    throw new ForbiddenError(`${actor.name} (${actor.role}) is not allowed to ${capability.replace(":", " ")}`, {
      role: actor.role,
      capability,
    });
  }
}

export function capabilitiesFor(role: Role): Capability[] {
  return [...GRANTS[role]];
}

export function actorLabel(actor: Actor): string {
  return `${actor.name} (${actor.role})`;
}
