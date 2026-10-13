import { auditActionLabel } from "@/lib/domain/audit";
import { formatDateTime, humanize } from "@/lib/format";
import type { AuditEntryView } from "@/lib/services/audit";
import { EmptyState } from "@/components/ui/page-header";

function describeChange(entry: AuditEntryView): string | null {
  const before = entry.before as { status?: string } | null;
  const after = entry.after as { status?: string } | null;
  if (before?.status && after?.status && before.status !== after.status) {
    return `${humanize(before.status)} → ${humanize(after.status)}`;
  }
  if (!before && after?.status) return humanize(after.status);
  return null;
}

export function AuditTrail({ entries }: { entries: AuditEntryView[] }) {
  if (entries.length === 0) return <EmptyState>No history yet.</EmptyState>;
  return (
    <ol className="divide-y divide-slate-100" data-testid="audit-trail">
      {entries.map((entry) => {
        const change = describeChange(entry);
        return (
          <li key={entry.id} className="px-4 py-2.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{auditActionLabel(entry.action)}</span>
              <time className="text-xs text-slate-500">{formatDateTime(entry.createdAt)}</time>
            </div>
            <div className="text-xs text-slate-500">
              {entry.actorLabel}
              {change ? ` · ${change}` : ""}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
