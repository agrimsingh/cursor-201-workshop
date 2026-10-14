import {
  AGING_BUCKET_LABELS,
  COLLECTIONS_ACTION_LABELS,
  type CollectionsQueue,
} from "@/lib/domain/aging";
import { formatCsvRow } from "@/lib/csv";
import { asCurrency, toDecimalString } from "@/lib/money";

const HEADER = [
  "Customer",
  "Invoice",
  "Currency",
  "Balance",
  "Due date",
  "Days late",
  "Bucket",
  "Next step",
];

function dueDateYmd(iso: string): string {
  return iso.slice(0, 10);
}

/** Serializes the collections queue as CSV (header + one row per item). */
export function collectionsQueueToCsv(queue: CollectionsQueue): string {
  const lines = [formatCsvRow(HEADER)];
  for (const item of queue.items) {
    const currency = asCurrency(item.currency);
    lines.push(
      formatCsvRow([
        item.customerName,
        item.invoiceNumber,
        item.currency,
        toDecimalString(item.balanceMinor, currency),
        dueDateYmd(item.dueDate),
        String(item.daysPastDue),
        AGING_BUCKET_LABELS[item.bucket],
        COLLECTIONS_ACTION_LABELS[item.suggestedAction],
      ]),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function collectionsExportFilename(asOf: Date): string {
  return `collections-${asOf.toISOString().slice(0, 10)}.csv`;
}
