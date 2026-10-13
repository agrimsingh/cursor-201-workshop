import Link from "next/link";
import { AuditTrail } from "@/components/audit/audit-trail";
import { DisputeActions } from "@/components/disputes/dispute-actions";
import { Money } from "@/components/ui/money";
import { PageHeader, Section } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { currentActor } from "@/lib/auth/session";
import { asDisputeStatus, availableDisputeActions, isActiveDispute } from "@/lib/domain/dispute-status";
import { can } from "@/lib/domain/permissions";
import { formatDate, formatDateTime, humanize } from "@/lib/format";
import { orNotFound } from "@/lib/not-found";
import { auditTrail } from "@/lib/services/audit";
import { getDisputeDetail } from "@/lib/services/disputes";

export default async function DisputePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [dispute, actor] = await Promise.all([orNotFound(getDisputeDetail(id)), currentActor()]);
  const status = asDisputeStatus(dispute.status);
  const history = can(actor.role, "audit:read") ? await auditTrail([{ entityType: "dispute", entityId: dispute.id }]) : null;
  const actions = can(actor.role, "disputes:review") ? availableDisputeActions(status) : [];
  const resolve =
    can(actor.role, "disputes:resolve") && isActiveDispute(status)
      ? { currency: dispute.currency, creditMinor: Math.min(dispute.amountMinor, dispute.invoice.balanceMinor) }
      : null;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {humanize(dispute.reason)} dispute
            <StatusBadge status={dispute.status} />
          </span>
        }
        description={
          <>
            <Link className="link font-mono" href={`/invoices/${dispute.invoice.id}`}>
              {dispute.invoice.number}
            </Link>{" "}
            ·{" "}
            <Link className="link" href={`/customers/${dispute.customer.id}`}>
              {dispute.customer.name}
            </Link>{" "}
            · opened {formatDate(dispute.openedAt)} by {dispute.openedBy.name}
          </>
        }
        actions={<DisputeActions disputeId={dispute.id} actions={actions} resolve={resolve} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Section title="Details">
            <dl className="grid grid-cols-[10rem_1fr] gap-y-2 px-4 py-3 text-sm" data-testid="dispute-details">
              <dt className="text-slate-500">Disputed amount</dt>
              <dd>
                <Money minor={dispute.amountMinor} currency={dispute.currency} className="font-medium" />
              </dd>
              <dt className="text-slate-500">Invoice balance</dt>
              <dd>
                <Money minor={dispute.invoice.balanceMinor} currency={dispute.invoice.currency} />
              </dd>
              <dt className="text-slate-500">Invoice status</dt>
              <dd>
                <StatusBadge status={dispute.invoice.status} />
              </dd>
              <dt className="text-slate-500">Reason</dt>
              <dd>{humanize(dispute.reason)}</dd>
              <dt className="text-slate-500">Customer says</dt>
              <dd className="whitespace-pre-line">{dispute.description}</dd>
            </dl>
          </Section>
          {status === "resolved" ? (
            <Section title="Resolution">
              <dl className="grid grid-cols-[10rem_1fr] gap-y-2 px-4 py-3 text-sm" data-testid="dispute-resolution">
                <dt className="text-slate-500">Outcome</dt>
                <dd data-testid="dispute-resolution-outcome">{dispute.resolution ? humanize(dispute.resolution) : "—"}</dd>
                <dt className="text-slate-500">Note</dt>
                <dd className="whitespace-pre-line" data-testid="dispute-resolution-note">
                  {dispute.resolutionNote ?? "—"}
                </dd>
                <dt className="text-slate-500">Resolved by</dt>
                <dd>{dispute.resolvedBy?.name ?? "—"}</dd>
                <dt className="text-slate-500">Resolved at</dt>
                <dd>{dispute.resolvedAt ? formatDateTime(dispute.resolvedAt) : "—"}</dd>
                {dispute.creditNote ? (
                  <>
                    <dt className="text-slate-500">Credit note</dt>
                    <dd data-testid="dispute-resolution-credit-note">
                      <span className="font-mono">{dispute.creditNote.number}</span> ·{" "}
                      <Money minor={dispute.creditNote.amountMinor} currency={dispute.creditNote.currency} /> ·{" "}
                      <Link className="link" href={`/invoices/${dispute.invoice.id}`}>
                        View on invoice {dispute.invoice.number}
                      </Link>
                    </dd>
                  </>
                ) : null}
              </dl>
            </Section>
          ) : null}
        </div>
        {history ? (
          <Section title="History">
            <AuditTrail entries={history} />
          </Section>
        ) : null}
      </div>
    </>
  );
}
