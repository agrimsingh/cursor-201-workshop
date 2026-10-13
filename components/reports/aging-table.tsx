import { Money } from "@/components/ui/money";
import { EmptyState } from "@/components/ui/page-header";
import { AGING_BUCKET_LABELS, AGING_BUCKETS, type CurrencyAging } from "@/lib/domain/aging";

/** Receivables by currency and aging bucket. Currencies are never summed together. */
export function AgingTable({ rows }: { rows: CurrencyAging[] }) {
  if (rows.length === 0) return <EmptyState>Nothing outstanding.</EmptyState>;
  return (
    <div className="overflow-x-auto">
      <table className="table" data-testid="aging-table">
        <thead>
          <tr>
            <th>Currency</th>
            {AGING_BUCKETS.map((bucket) => (
              <th key={bucket} className="text-right">
                {AGING_BUCKET_LABELS[bucket]}
              </th>
            ))}
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.currency}>
              <td className="font-medium">{row.currency}</td>
              {AGING_BUCKETS.map((bucket) => (
                <td
                  key={bucket}
                  className={`text-right ${bucket === "90+" && row.buckets[bucket] > 0 ? "font-medium text-rose-700" : ""}`}
                >
                  {row.buckets[bucket] ? <Money minor={row.buckets[bucket]} currency={row.currency} /> : <span className="text-slate-300">—</span>}
                </td>
              ))}
              <td className="text-right font-semibold">
                <Money minor={row.totalMinor} currency={row.currency} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
