import Link from "next/link";
import { Money } from "@/components/ui/money";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { currentActor } from "@/lib/auth/session";
import { can } from "@/lib/domain/permissions";
import { formatDate, humanize } from "@/lib/format";
import { listPayments } from "@/lib/services/payments";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: rawPage } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);
  const [{ data, meta }, actor] = await Promise.all([listPayments({ page, pageSize: 25 }), currentActor()]);

  return (
    <>
      <PageHeader
        title="Payments"
        description="Money received and how it was allocated."
        actions={
          can(actor.role, "payments:record") ? (
            <Link className="btn-primary" href="/payments/new">
              Record payment
            </Link>
          ) : null
        }
      />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Received</th>
              <th>Customer</th>
              <th>Reference</th>
              <th>Method</th>
              <th>Applied to</th>
              <th className="text-right">Unapplied</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.map((payment) => (
              <tr key={payment.id}>
                <td>{formatDate(payment.receivedAt)}</td>
                <td>
                  <Link className="link" href={`/customers/${payment.customer.id}`}>
                    {payment.customer.name}
                  </Link>
                </td>
                <td className="font-mono text-xs">{payment.reference ?? "—"}</td>
                <td>{humanize(payment.method)}</td>
                <td className="text-xs">
                  {payment.allocations.length === 0
                    ? "—"
                    : payment.allocations.map((allocation, index) => (
                        <span key={allocation.id}>
                          {index > 0 ? ", " : ""}
                          <Link className="link font-mono" href={`/invoices/${allocation.invoice.id}`}>
                            {allocation.invoice.number}
                          </Link>
                        </span>
                      ))}
                </td>
                <td className="text-right text-slate-500">
                  {payment.unappliedMinor > 0 ? <Money minor={payment.unappliedMinor} currency={payment.currency} /> : "—"}
                </td>
                <td className="text-right font-medium">
                  <Money minor={payment.amountMinor} currency={payment.currency} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 ? <EmptyState>No payments yet.</EmptyState> : null}
        <Pager page={meta.page} totalPages={meta.totalPages} basePath="/payments" />
      </div>
    </>
  );
}

function Pager({ page, totalPages, basePath }: { page: number; totalPages: number; basePath: string }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className="btn-secondary" href={`${basePath}?page=${page - 1}`}>
            Previous
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link className="btn-secondary" href={`${basePath}?page=${page + 1}`}>
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}
