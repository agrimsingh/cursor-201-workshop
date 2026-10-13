// Catalogue of audited actions. Every state change in lib/services/* records one of these.

export const AUDIT_ENTITY_TYPES = ["invoice", "payment", "credit_note", "dispute"] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export const AUDIT_ACTIONS = [
  "invoice.created",
  "invoice.sent",
  "invoice.voided",
  "invoice.marked_overdue",
  "invoice.settled",
  "payment.recorded",
  "credit_note.issued",
  "dispute.opened",
  "dispute.review_started",
  "dispute.withdrawn",
  "dispute.resolved",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "invoice.created": "Invoice created",
  "invoice.sent": "Invoice sent",
  "invoice.voided": "Invoice voided",
  "invoice.marked_overdue": "Marked overdue",
  "invoice.settled": "Balance changed",
  "payment.recorded": "Payment recorded",
  "credit_note.issued": "Credit note issued",
  "dispute.opened": "Dispute opened",
  "dispute.review_started": "Review started",
  "dispute.withdrawn": "Dispute withdrawn",
  "dispute.resolved": "Dispute resolved",
};

export function auditActionLabel(action: string): string {
  return (AUDIT_ACTION_LABELS as Record<string, string>)[action] ?? action;
}

export const SYSTEM_ACTOR_LABEL = "system";
