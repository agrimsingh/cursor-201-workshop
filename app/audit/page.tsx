import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { currentActor } from "@/lib/auth/session";
import { auditActionLabel, AUDIT_ENTITY_TYPES, type AuditEntityType } from "@/lib/domain/audit";
import { can } from "@/lib/domain/permissions";
import { formatDateTime, humanize } from "@/lib/format";
import { listAuditEntries } from "@/lib/services/audit";

const ENTITY_LINKS: Partial<Record<AuditEntityType, string>> = { invoice: "/invoices", dispute: "/disputes" };

function summarise(value: unknown): string {
  if (!value || typeof value !== "object") return "—";
  const record = value as Record<string, unknown>;
  return ["status", "balanceMinor", "amountMinor"]
    .filter((key) => record[key] !== undefined)
    .map((key) => `${key}: ${String(record[key])}`)
    .join(", ") || "—";
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entityType?: string; page?: string }> }) {
  const params = await searchParams;
  const actor = await currentActor();
  if (!can(actor.role, "audit:read")) {
    return (
      <>
        <PageHeader title="Audit log" />
        <p className="card p-5 text-sm text-slate-600">Your role ({actor.role}) cannot view the audit log.</p>
      </>
    );
  }
  const entityType = AUDIT_ENTITY_TYPES.find((type) => type === params.entityType);
  const page = Math.max(1, Number(params.page) || 1);
  const { data, meta } = await listAuditEntries({ entityType, page, pageSize: 50 });
  const query = (next: number) => `/audit?${new URLSearchParams({ ...(entityType ? { entityType } : {}), page: String(next) })}`;

  return (
    <>
      <PageHeader title="Audit log" description="Every state change, who made it, and what it changed." />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link className={entityType ? "btn-secondary" : "btn-primary"} href="/audit">
          All
        </Link>
        {AUDIT_ENTITY_TYPES.map((type) => (
          <Link key={type} className={entityType === type ? "btn-primary" : "btn-secondary"} href={`/audit?entityType=${type}`}>
            {humanize(type)}
          </Link>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="table" data-testid="audit-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Entity</th>
              <th>Before</th>
              <th>After</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry) => {
              const base = ENTITY_LINKS[entry.entityType as AuditEntityType];
              return (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(entry.createdAt)}</td>
                  <td className="font-medium">{auditActionLabel(entry.action)}</td>
                  <td>{entry.actorLabel}</td>
                  <td className="text-xs">
                    {base ? (
                      <Link className="link" href={`${base}/${entry.entityId}`}>
                        {humanize(entry.entityType)}
                      </Link>
                    ) : (
                      humanize(entry.entityType)
                    )}
                  </td>
                  <td className="font-mono text-xs text-slate-500">{summarise(entry.before)}</td>
                  <td className="font-mono text-xs">{summarise(entry.after)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data.length === 0 ? <EmptyState>No audit entries.</EmptyState> : null}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
          <span>
            {meta.total} entries · page {meta.page} of {meta.totalPages}
          </span>
          <div className="flex gap-2">
            {meta.page > 1 ? (
              <Link className="btn-secondary" href={query(meta.page - 1)}>
                Previous
              </Link>
            ) : null}
            {meta.page < meta.totalPages ? (
              <Link className="btn-secondary" href={query(meta.page + 1)}>
                Next
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
