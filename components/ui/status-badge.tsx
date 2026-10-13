import { humanize } from "@/lib/format";

const TONES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  sent: "bg-sky-50 text-sky-700 ring-sky-200",
  partially_paid: "bg-amber-50 text-amber-800 ring-amber-200",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  overdue: "bg-rose-50 text-rose-700 ring-rose-200",
  void: "bg-slate-100 text-slate-500 ring-slate-200 line-through",
  open: "bg-orange-50 text-orange-700 ring-orange-200",
  under_review: "bg-violet-50 text-violet-700 ring-violet-200",
  withdrawn: "bg-slate-100 text-slate-600 ring-slate-200",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  viewer: "bg-slate-100 text-slate-700 ring-slate-200",
  agent: "bg-sky-50 text-sky-700 ring-sky-200",
  admin: "bg-brand-50 text-brand-700 ring-brand-100",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span
      data-testid="status-badge"
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[status] ?? TONES.draft}`}
    >
      {label ?? humanize(status)}
    </span>
  );
}
