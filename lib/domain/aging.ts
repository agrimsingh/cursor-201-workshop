import { daysBetween } from "@/lib/domain/dates";
import { isOpenInvoice, type InvoiceStatus } from "@/lib/domain/invoice-status";

// Accounts-receivable aging. Balances are grouped by how many days past due they are.
// Amounts in different currencies are never added together.

export const AGING_BUCKETS = ["current", "0-30", "31-60", "61-90", "90+"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];
export const PAST_DUE_BUCKETS = ["0-30", "31-60", "61-90", "90+"] as const satisfies readonly AgingBucket[];

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  current: "Not yet due",
  "0-30": "0–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "90+ days",
};

export interface AgingInput {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  currency: string;
  status: InvoiceStatus;
  dueDate: Date;
  balanceMinor: number;
  /** True while the invoice has an active dispute. */
  onHold: boolean;
}

export type BucketTotals = Record<AgingBucket, number>;

export interface CurrencyAging {
  currency: string;
  buckets: BucketTotals;
  totalMinor: number;
  pastDueMinor: number;
  onHoldMinor: number;
}

export interface CustomerAging {
  customerId: string;
  customerName: string;
  currency: string;
  buckets: BucketTotals;
  totalMinor: number;
  oldestDaysPastDue: number;
}

export interface AgingReport {
  asOf: string;
  currencies: CurrencyAging[];
  customers: CustomerAging[];
}

/** Days past the due date. Zero or negative means the invoice is not late yet. */
export function daysPastDue(dueDate: Date, asOf: Date): number {
  return daysBetween(dueDate, asOf);
}

export function agingBucket(days: number): AgingBucket {
  if (days <= 0) return "current";
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

function emptyBuckets(): BucketTotals {
  return { current: 0, "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
}

function isReceivable(input: AgingInput): boolean {
  return isOpenInvoice(input.status) && input.balanceMinor > 0;
}

export function buildAgingReport(inputs: readonly AgingInput[], asOf: Date): AgingReport {
  const currencies = new Map<string, CurrencyAging>();
  const customers = new Map<string, CustomerAging>();

  for (const input of inputs.filter(isReceivable)) {
    const days = daysPastDue(input.dueDate, asOf);
    const bucket = agingBucket(days);

    const currency = currencies.get(input.currency) ?? {
      currency: input.currency,
      buckets: emptyBuckets(),
      totalMinor: 0,
      pastDueMinor: 0,
      onHoldMinor: 0,
    };
    currency.buckets[bucket] += input.balanceMinor;
    currency.totalMinor += input.balanceMinor;
    if (bucket !== "current") currency.pastDueMinor += input.balanceMinor;
    if (input.onHold) currency.onHoldMinor += input.balanceMinor;
    currencies.set(input.currency, currency);

    const key = `${input.customerId}:${input.currency}`;
    const customer = customers.get(key) ?? {
      customerId: input.customerId,
      customerName: input.customerName,
      currency: input.currency,
      buckets: emptyBuckets(),
      totalMinor: 0,
      oldestDaysPastDue: 0,
    };
    customer.buckets[bucket] += input.balanceMinor;
    customer.totalMinor += input.balanceMinor;
    customer.oldestDaysPastDue = Math.max(customer.oldestDaysPastDue, days);
    customers.set(key, customer);
  }

  return {
    asOf: asOf.toISOString(),
    currencies: [...currencies.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    customers: [...customers.values()].sort(
      (a, b) => b.oldestDaysPastDue - a.oldestDaysPastDue || a.customerName.localeCompare(b.customerName),
    ),
  };
}

export type CollectionsAction = "send_reminder" | "call_customer" | "final_notice" | "escalate";

export const COLLECTIONS_ACTION_LABELS: Record<CollectionsAction, string> = {
  send_reminder: "Send reminder",
  call_customer: "Call customer",
  final_notice: "Send final notice",
  escalate: "Escalate",
};

const ACTION_BY_BUCKET: Record<(typeof PAST_DUE_BUCKETS)[number], CollectionsAction> = {
  "0-30": "send_reminder",
  "31-60": "call_customer",
  "61-90": "final_notice",
  "90+": "escalate",
};

export interface CollectionsQueueItem {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  currency: string;
  balanceMinor: number;
  dueDate: string;
  daysPastDue: number;
  bucket: AgingBucket;
  suggestedAction: CollectionsAction;
}

export interface CollectionsQueue {
  asOf: string;
  items: CollectionsQueueItem[];
  onHoldCount: number;
}

/** Past-due receivables that need chasing, most overdue first. Disputed invoices are on hold. */
export function buildCollectionsQueue(inputs: readonly AgingInput[], asOf: Date): CollectionsQueue {
  const receivable = inputs.filter(isReceivable).filter((input) => daysPastDue(input.dueDate, asOf) > 0);
  const items = receivable
    .filter((input) => !input.onHold)
    .map((input): CollectionsQueueItem => {
      const days = daysPastDue(input.dueDate, asOf);
      const bucket = agingBucket(days) as (typeof PAST_DUE_BUCKETS)[number];
      return {
        invoiceId: input.invoiceId,
        invoiceNumber: input.invoiceNumber,
        customerId: input.customerId,
        customerName: input.customerName,
        currency: input.currency,
        balanceMinor: input.balanceMinor,
        dueDate: input.dueDate.toISOString(),
        daysPastDue: days,
        bucket,
        suggestedAction: ACTION_BY_BUCKET[bucket],
      };
    })
    .sort((a, b) => b.daysPastDue - a.daysPastDue || a.invoiceNumber.localeCompare(b.invoiceNumber));
  return { asOf: asOf.toISOString(), items, onHoldCount: receivable.length - items.length };
}
