import Link from "next/link";
import { AuditTrail } from "@/components/audit/audit-trail";
import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { Money } from "@/components/ui/money";
import { EmptyState, PageHeader, Section } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { currentActor } from "@/lib/auth/session";
import { AGING_BUCKET_LABELS, agingBucket, daysPastDue } from "@/lib/domain/aging";
import { isActiveDispute } from "@/lib/domain/dispute-status";
import { availableInvoiceActions, isOpenInvoice } from "@/lib/domain/invoice-status";
import { can, capabilitiesFor } from "@/lib/domain/permissions";
import { formatDate, humanize } from "@/lib/format";
import { orNotFound } from "@/lib/not-found";
import { auditTrail } from "@/lib/services/audit";
import { getInvoiceDetail, toInvoiceState } from "@/lib/services/invoices";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [invoice, actor] = await Promise.all([orNotFound(getInvoiceDetail(id)), currentActor()]);
  const now = new Date();
  const state = toInvoiceState(invoice);
  const open = isOpenInvoice(state.status);
  const days = daysPastDue(invoice.dueDate, now);
  const activeDispute = invoice.disputes.find((dispute) => isActiveDispute(dispute.status));
  const history = can(actor.role, "audit:read")
    ? await auditTrail([
        { entityType: "invoice", entityId: invoice.id },
        ...invoice.allocations.map((a) => ({ entityType: "payment" as const, entityId: a.paymentId })),
        ...invoice.creditNotes.map((c) => ({ entityType: "credit_note" as const, entityId: c.id })),
        ...invoice.disputes.map((d) => ({ entityType: "dispute" as const, entityId: d.id })),
      ])
    : null;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{invoice.number}</span>
            <StatusBadge status={invoice.status} />
            {activeDispute ? <StatusBadge status="open" label="In dispute" /> : null}
          </span>
        }
        description={
          <>
            <Link className="link" href={`/customers/${invoice.customer.id}`}>
              {invoice.customer.name}
            </Link>{" "}
            · issued {formatDate(invoice.issueDate)} · due {formatDate(invoice.dueDate)}
          </>
        }
        actions={
          <InvoiceActions
            invoiceId={invoice.id}
            customerId={invoice.customerId}
            currency={invoice.currency}
            balanceMinor={invoice.balanceMinor}
            isOpen={open}
            hasActiveDispute={Boolean(activeDispute)}
            actions={availableInvoiceActions(state, now)}
            capabilities={capabilitiesFor(actor.role)}
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Section title="Line items">
            <table className="table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Unit price</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.description}</td>
                    <td className="text-right tabular-nums">{line.quantity}</td>
                    <td className="text-right">
                      <Money minor={line.unitPriceMinor} currency={invoice.currency} />
                    </td>
                    <td className="text-right">
                      <Money minor={line.amountMinor} currency={invoice.currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Payments applied">
            {invoice.allocations.length === 0 ? (
              <EmptyState>No payments applied.</EmptyState>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Received</th>
                    <th>Reference</th>
                    <th>Method</th>
                    <th className="text-right">Applied here</th>
                    <th className="text-right">Payment total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.allocations.map((allocation) => (
                    <tr key={allocation.id}>
                      <td>{formatDate(allocation.payment.receivedAt)}</td>
                      <td className="font-mono text-xs">{allocation.payment.reference ?? "—"}</td>
                      <td>{humanize(allocation.payment.method)}</td>
                      <td className="text-right">
                        <Money minor={allocation.amountMinor} currency={invoice.currency} />
                      </td>
                      <td className="text-right text-slate-500">
                        <Money minor={allocation.payment.amountMinor} currency={allocation.payment.currency} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Credit notes">
            {invoice.creditNotes.length === 0 ? (
              <EmptyState>No credit notes.</EmptyState>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Issued</th>
                    <th>Reason</th>
                    <th>By</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.creditNotes.map((note) => (
                    <tr key={note.id}>
                      <td className="font-mono text-xs">{note.number}</td>
                      <td>{formatDate(note.issuedAt)}</td>
                      <td>{humanize(note.reason)}</td>
                      <td>{note.issuedBy.name}</td>
                      <td className="text-right">
                        <Money minor={note.amountMinor} currency={note.currency} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Disputes">
            {invoice.disputes.length === 0 ? (
              <EmptyState>No disputes.</EmptyState>
            ) : (
              <ul className="divide-y divide-slate-100">
                {invoice.disputes.map((dispute) => (
                  <li key={dispute.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <Link className="link" href={`/disputes/${dispute.id}`}>
                        {humanize(dispute.reason)} dispute
                      </Link>
                      <p className="text-xs text-slate-500">
                        Opened {formatDate(dispute.openedAt)} by {dispute.openedBy.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Money minor={dispute.amountMinor} currency={dispute.currency} />
                      <StatusBadge status={dispute.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <Section title="Summary">
            <dl className="grid grid-cols-2 gap-y-2 px-4 py-3 text-sm" data-testid="invoice-summary">
              <dt className="text-slate-500">Total</dt>
              <dd className="text-right">
                <Money minor={invoice.totalMinor} currency={invoice.currency} />
              </dd>
              <dt className="text-slate-500">Paid</dt>
              <dd className="text-right">
                <Money minor={invoice.amountPaidMinor} currency={invoice.currency} />
              </dd>
              <dt className="text-slate-500">Credited</dt>
              <dd className="text-right">
                <Money minor={invoice.amountCreditedMinor} currency={invoice.currency} />
              </dd>
              <dt className="border-t border-slate-100 pt-2 font-semibold">Balance</dt>
              <dd className="border-t border-slate-100 pt-2 text-right font-semibold" data-testid="invoice-balance">
                <Money minor={invoice.balanceMinor} currency={invoice.currency} />
              </dd>
              {open ? (
                <>
                  <dt className="text-slate-500">Aging</dt>
                  <dd className="text-right">
                    {days > 0 ? `${days} days past due (${AGING_BUCKET_LABELS[agingBucket(days)]})` : "Not yet due"}
                  </dd>
                </>
              ) : null}
            </dl>
          </Section>
          {history ? (
            <Section title="History">
              <AuditTrail entries={history} />
            </Section>
          ) : null}
        </div>
      </div>
    </>
  );
}
