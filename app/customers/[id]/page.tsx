import Link from "next/link";
import { Money } from "@/components/ui/money";
import { EmptyState, PageHeader, Section, Stat } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, humanize } from "@/lib/format";
import { orNotFound } from "@/lib/not-found";
import { getCustomerDetail } from "@/lib/services/customers";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await orNotFound(getCustomerDetail(id));
  const unapplied = customer.payments.filter((payment) => payment.unappliedMinor > 0);

  return (
    <>
      <PageHeader title={customer.name} description={`${customer.email} · bills in ${customer.currency} · Net ${customer.paymentTermsDays}`} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Open balance"
          value={
            customer.openBalances.length === 0
              ? "—"
              : customer.openBalances.map((b) => (
                  <div key={b.currency}>
                    <Money minor={b.balanceMinor} currency={b.currency} />
                  </div>
                ))
          }
        />
        <Stat label="Invoices" value={customer.invoices.length} />
        <Stat
          label="Unapplied credit"
          value={
            unapplied.length === 0
              ? "—"
              : unapplied.map((payment) => (
                  <div key={payment.id}>
                    <Money minor={payment.unappliedMinor} currency={payment.currency} />
                  </div>
                ))
          }
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Invoices">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Due</th>
                <th>Status</th>
                <th className="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {customer.invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <Link className="link font-mono text-xs" href={`/invoices/${invoice.id}`}>
                      {invoice.number}
                    </Link>
                  </td>
                  <td>{formatDate(invoice.dueDate)}</td>
                  <td>
                    <StatusBadge status={invoice.status} />
                  </td>
                  <td className="text-right">
                    <Money minor={invoice.balanceMinor} currency={invoice.currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        <Section title="Payments">
          {customer.payments.length === 0 ? (
            <EmptyState>No payments yet.</EmptyState>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Method</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {customer.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.receivedAt)}</td>
                    <td>{humanize(payment.method)}</td>
                    <td className="text-right">
                      <Money minor={payment.amountMinor} currency={payment.currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </>
  );
}
