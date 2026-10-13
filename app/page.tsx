import Link from "next/link";
import { AgingTable } from "@/components/reports/aging-table";
import { Money } from "@/components/ui/money";
import { PageHeader, Section, Stat } from "@/components/ui/page-header";
import { dashboardSummary } from "@/lib/services/reports";

export default async function DashboardPage() {
  const summary = await dashboardSummary(new Date());
  const { aging, counts } = summary;

  return (
    <>
      <PageHeader title="Dashboard" description="Where the money is, by currency." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open invoices" value={counts.openInvoices} hint={<Link className="link" href="/invoices">View invoices</Link>} />
        <Stat label="Overdue" value={counts.overdueInvoices} hint={<Link className="link" href="/collections">Open collections queue</Link>} />
        <Stat label="Active disputes" value={counts.activeDisputes} hint={<Link className="link" href="/disputes">Review disputes</Link>} />
        <Stat
          label="Collected (30 days)"
          value={
            <div className="flex flex-col text-base">
              {summary.collectedLast30Days.length === 0
                ? "—"
                : summary.collectedLast30Days.map((row) => <Money key={row.currency} minor={row.amountMinor} currency={row.currency} />)}
            </div>
          }
        />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {aging.currencies.map((row) => (
          <div key={row.currency} className="card p-4" data-testid="currency-card">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-slate-500">{row.currency} outstanding</span>
              <Money minor={row.totalMinor} currency={row.currency} className="text-lg font-semibold" />
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>
                Past due <Money minor={row.pastDueMinor} currency={row.currency} className="font-medium text-rose-700" />
              </span>
              <span>
                On hold <Money minor={row.onHoldMinor} currency={row.currency} className="font-medium" />
              </span>
            </div>
          </div>
        ))}
      </div>

      <Section title="Aging by currency">
        <AgingTable rows={aging.currencies} />
      </Section>
    </>
  );
}
