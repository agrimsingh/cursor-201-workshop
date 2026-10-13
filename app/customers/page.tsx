import Link from "next/link";
import { Money } from "@/components/ui/money";
import { PageHeader } from "@/components/ui/page-header";
import { listCustomers } from "@/lib/services/customers";

export default async function CustomersPage() {
  const customers = await listCustomers();
  return (
    <>
      <PageHeader title="Customers" description="Who we bill, and what they owe." />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Billing currency</th>
              <th className="text-right">Terms</th>
              <th className="text-right">Invoices</th>
              <th className="text-right">Open balance</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <Link className="link" href={`/customers/${customer.id}`}>
                    {customer.name}
                  </Link>
                  <p className="text-xs text-slate-500">{customer.email}</p>
                </td>
                <td>{customer.currency}</td>
                <td className="text-right">Net {customer.paymentTermsDays}</td>
                <td className="text-right tabular-nums">{customer.invoiceCount}</td>
                <td className="text-right">
                  {customer.openBalances.length === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    customer.openBalances.map((balance) => (
                      <div key={balance.currency}>
                        <Money minor={balance.balanceMinor} currency={balance.currency} />
                      </div>
                    ))
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
