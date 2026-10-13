import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/domain/errors";
import { OPEN_INVOICE_STATUSES } from "@/lib/domain/invoice-status";

export interface CurrencyBalance {
  currency: string;
  balanceMinor: number;
}

async function openBalancesByCustomer(customerIds?: string[]) {
  const rows = await db.invoice.groupBy({
    by: ["customerId", "currency"],
    where: {
      status: { in: [...OPEN_INVOICE_STATUSES] },
      ...(customerIds ? { customerId: { in: customerIds } } : {}),
    },
    _sum: { balanceMinor: true },
  });
  const balances = new Map<string, CurrencyBalance[]>();
  for (const row of rows) {
    const list = balances.get(row.customerId) ?? [];
    list.push({ currency: row.currency, balanceMinor: row._sum.balanceMinor ?? 0 });
    balances.set(row.customerId, list);
  }
  return balances;
}

export async function listCustomers() {
  const [customers, balances] = await Promise.all([
    db.customer.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { invoices: true } } } }),
    openBalancesByCustomer(),
  ]);
  return customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    currency: customer.currency,
    paymentTermsDays: customer.paymentTermsDays,
    invoiceCount: customer._count.invoices,
    openBalances: balances.get(customer.id) ?? [],
  }));
}

export async function getCustomerDetail(id: string) {
  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      invoices: { orderBy: { dueDate: "desc" } },
      payments: { orderBy: { receivedAt: "desc" }, include: { allocations: true } },
      creditNotes: { orderBy: { issuedAt: "desc" } },
    },
  });
  if (!customer) throw new NotFoundError("Customer", id);
  const balances = await openBalancesByCustomer([id]);
  return { ...customer, openBalances: balances.get(id) ?? [] };
}

/** Invoices that can still take a payment, used by the payment allocation form. */
export async function listOpenInvoices(customerId?: string) {
  return db.invoice.findMany({
    where: {
      status: { in: [...OPEN_INVOICE_STATUSES] },
      balanceMinor: { gt: 0 },
      ...(customerId ? { customerId } : {}),
    },
    orderBy: [{ dueDate: "asc" }, { number: "asc" }],
    select: { id: true, number: true, customerId: true, currency: true, dueDate: true, balanceMinor: true },
  });
}
