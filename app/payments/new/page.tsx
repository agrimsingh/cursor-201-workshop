import { RecordPaymentForm } from "@/components/payments/record-payment-form";
import { PageHeader } from "@/components/ui/page-header";
import { currentActor } from "@/lib/auth/session";
import { toIsoDate } from "@/lib/domain/dates";
import { can } from "@/lib/domain/permissions";
import { listCustomers, listOpenInvoices } from "@/lib/services/customers";

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; invoiceId?: string }>;
}) {
  const [{ customerId, invoiceId }, actor] = await Promise.all([searchParams, currentActor()]);
  if (!can(actor.role, "payments:record")) {
    return (
      <>
        <PageHeader title="Record payment" />
        <p className="card p-5 text-sm text-slate-600">
          Your role ({actor.role}) cannot record payments. Switch user in the header.
        </p>
      </>
    );
  }
  const [customers, openInvoices] = await Promise.all([listCustomers(), listOpenInvoices()]);
  return (
    <>
      <PageHeader title="Record payment" description="Record money received and decide which invoices it pays." />
      <RecordPaymentForm
        customers={customers.map(({ id, name, currency }) => ({ id, name, currency }))}
        openInvoices={openInvoices.map((invoice) => ({ ...invoice, dueDate: invoice.dueDate.toISOString() }))}
        initialCustomerId={customerId}
        initialInvoiceId={invoiceId}
        today={toIsoDate(new Date())}
      />
    </>
  );
}
