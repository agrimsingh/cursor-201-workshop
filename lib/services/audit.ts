import { db, type Tx } from "@/lib/db";
import { SYSTEM_ACTOR_LABEL, type AuditAction, type AuditEntityType } from "@/lib/domain/audit";
import { actorLabel, type Actor } from "@/lib/domain/permissions";

export type AuditActor = Actor | "system";

export interface AuditRecord {
  actor: AuditActor;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  before: unknown;
  after: unknown;
  at?: Date;
}

/** Writes one audit entry. Always call it inside the transaction that made the change. */
export async function recordAudit(tx: Tx, record: AuditRecord): Promise<void> {
  await tx.auditEntry.create({
    data: {
      actorId: record.actor === "system" ? null : record.actor.id,
      actorLabel: record.actor === "system" ? SYSTEM_ACTOR_LABEL : actorLabel(record.actor),
      entityType: record.entityType,
      entityId: record.entityId,
      action: record.action,
      before: record.before === null || record.before === undefined ? null : JSON.stringify(record.before),
      after: record.after === null || record.after === undefined ? null : JSON.stringify(record.after),
      ...(record.at ? { createdAt: record.at } : {}),
    },
  });
}

export interface AuditEntryView {
  id: string;
  actorLabel: string;
  entityType: string;
  entityId: string;
  action: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

function toView(entry: {
  id: string;
  actorLabel: string;
  entityType: string;
  entityId: string;
  action: string;
  before: string | null;
  after: string | null;
  createdAt: Date;
}): AuditEntryView {
  return {
    id: entry.id,
    actorLabel: entry.actorLabel,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    before: entry.before ? JSON.parse(entry.before) : null,
    after: entry.after ? JSON.parse(entry.after) : null,
    createdAt: entry.createdAt.toISOString(),
  };
}

export async function listAuditEntries(query: {
  entityType?: AuditEntityType;
  entityId?: string;
  page: number;
  pageSize: number;
}) {
  const where = {
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.entityId ? { entityId: query.entityId } : {}),
  };
  const [rows, total] = await Promise.all([
    db.auditEntry.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    db.auditEntry.count({ where }),
  ]);
  return {
    data: rows.map(toView),
    meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
  };
}

/** Audit history for a set of entities (for example an invoice plus its payments and disputes). */
export async function auditTrail(entities: { entityType: AuditEntityType; entityId: string }[]): Promise<AuditEntryView[]> {
  if (entities.length === 0) return [];
  const rows = await db.auditEntry.findMany({
    where: { OR: entities.map((entity) => ({ entityType: entity.entityType, entityId: entity.entityId })) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return rows.map(toView);
}
