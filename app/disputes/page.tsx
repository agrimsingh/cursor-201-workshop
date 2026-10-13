import Link from "next/link";
import { Money } from "@/components/ui/money";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { DISPUTE_STATUSES, isDisputeStatus } from "@/lib/domain/dispute-status";
import { formatDate, humanize } from "@/lib/format";
import { listDisputes } from "@/lib/services/disputes";

export default async function DisputesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = status && isDisputeStatus(status) ? status : undefined;
  const { data } = await listDisputes({ status: filter, page: 1, pageSize: 100 });

  return (
    <>
      <PageHeader title="Disputes" description="Invoices a customer has challenged. Disputed invoices are held out of collections." />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link className={filter ? "btn-secondary" : "btn-primary"} href="/disputes">
          All
        </Link>
        {DISPUTE_STATUSES.map((value) => (
          <Link key={value} className={filter === value ? "btn-primary" : "btn-secondary"} href={`/disputes?status=${value}`}>
            {humanize(value)}
          </Link>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Opened</th>
              <th>Customer</th>
              <th>Invoice</th>
              <th>Reason</th>
              <th>Status</th>
              <th className="text-right">Disputed</th>
            </tr>
          </thead>
          <tbody>
            {data.map((dispute) => (
              <tr key={dispute.id} data-testid="dispute-row">
                <td>
                  <Link className="link" href={`/disputes/${dispute.id}`}>
                    {formatDate(dispute.openedAt)}
                  </Link>
                </td>
                <td>{dispute.customer.name}</td>
                <td>
                  <Link className="link font-mono text-xs" href={`/invoices/${dispute.invoice.id}`}>
                    {dispute.invoice.number}
                  </Link>
                </td>
                <td>{humanize(dispute.reason)}</td>
                <td>
                  <StatusBadge status={dispute.status} />
                </td>
                <td className="text-right">
                  <Money minor={dispute.amountMinor} currency={dispute.currency} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 ? <EmptyState>No disputes.</EmptyState> : null}
      </div>
    </>
  );
}
