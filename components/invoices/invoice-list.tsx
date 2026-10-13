"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Money } from "@/components/ui/money";
import { EmptyState } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApiClientError } from "@/lib/client/api";
import { fromInvoiceSearchParams, toInvoiceSearchParams, type InvoiceListParams } from "@/lib/client/invoice-list-params";
import { INVOICE_STATUSES } from "@/lib/domain/invoice-status";
import { formatDate, humanize } from "@/lib/format";
import type { ListMeta } from "@/lib/http/route";
import { CURRENCIES } from "@/lib/money";
import type { InvoiceListItem } from "@/lib/services/invoices";
import type { InvoiceSortField } from "@/lib/validation/invoices";

const COLUMNS: { field: InvoiceSortField | null; label: string; align?: "right" }[] = [
  { field: "number", label: "Invoice" },
  { field: "customer", label: "Customer" },
  { field: null, label: "Status" },
  { field: "issueDate", label: "Issued" },
  { field: "dueDate", label: "Due" },
  { field: "totalMinor", label: "Total", align: "right" },
  { field: "balanceMinor", label: "Balance", align: "right" },
];

type ListState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: InvoiceListItem[]; meta: ListMeta };

export function InvoiceList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = fromInvoiceSearchParams(new URLSearchParams(searchParams.toString()));
  const query = toInvoiceSearchParams(params).toString();
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [search, setSearch] = useState(params.q ?? "");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/invoices?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new ApiClientError(response.status, body.error.code, body.error.message);
        setState({ kind: "ready", data: body.data, meta: body.meta });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ kind: "error", message: error instanceof Error ? error.message : "Could not load invoices" });
      });
    return () => controller.abort();
  }, [query]);

  function update(next: Partial<InvoiceListParams>) {
    const merged = { ...params, page: 1, ...next };
    const qs = toInvoiceSearchParams(merged).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function toggleSort(field: InvoiceSortField) {
    update({ sort: field, order: params.sort === field && params.order === "asc" ? "desc" : "asc" });
  }

  return (
    <div className="card">
      <form
        className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          update({ q: search.trim() || undefined });
        }}
      >
        <div>
          <label className="label" htmlFor="status-filter">
            Status
          </label>
          <select
            id="status-filter"
            className="input"
            value={params.status ?? ""}
            onChange={(event) => update({ status: (event.target.value || undefined) as InvoiceListParams["status"] })}
          >
            <option value="">All statuses</option>
            {INVOICE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {humanize(status)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="currency-filter">
            Currency
          </label>
          <select
            id="currency-filter"
            className="input"
            value={params.currency ?? ""}
            onChange={(event) => update({ currency: (event.target.value || undefined) as InvoiceListParams["currency"] })}
          >
            <option value="">All currencies</option>
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-56 flex-1">
          <label className="label" htmlFor="invoice-search">
            Search
          </label>
          <input
            id="invoice-search"
            className="input"
            placeholder="Invoice number or customer"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <button type="submit" className="btn-secondary">
          Search
        </button>
      </form>

      {state.kind === "loading" ? <EmptyState>Loading invoices…</EmptyState> : null}
      {state.kind === "error" ? <EmptyState>{state.message}</EmptyState> : null}
      {state.kind === "ready" ? (
        <>
          <div className="overflow-x-auto">
            <table className="table" data-testid="invoice-table">
              <thead>
                <tr>
                  {COLUMNS.map((column) => (
                    <th key={column.label} className={column.align === "right" ? "text-right" : undefined}>
                      {column.field ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 uppercase hover:text-slate-800"
                          onClick={() => toggleSort(column.field!)}
                        >
                          {column.label}
                          {params.sort === column.field ? <span aria-hidden>{params.order === "asc" ? "↑" : "↓"}</span> : null}
                        </button>
                      ) : (
                        column.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.data.map((invoice) => (
                  <tr key={invoice.id} data-testid="invoice-row" className="hover:bg-slate-50">
                    <td>
                      <Link href={`/invoices/${invoice.id}`} className="link font-mono text-xs">
                        {invoice.number}
                      </Link>
                    </td>
                    <td>{invoice.customer.name}</td>
                    <td>
                      <span className="flex items-center gap-1.5">
                        <StatusBadge status={invoice.status} />
                        {invoice.inDispute ? <StatusBadge status="open" label="In dispute" /> : null}
                      </span>
                    </td>
                    <td className="text-slate-600">{formatDate(invoice.issueDate)}</td>
                    <td className="text-slate-600">{formatDate(invoice.dueDate)}</td>
                    <td className="text-right">
                      <Money minor={invoice.totalMinor} currency={invoice.currency} />
                    </td>
                    <td className="text-right font-medium">
                      <Money minor={invoice.balanceMinor} currency={invoice.currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {state.data.length === 0 ? <EmptyState>No invoices match these filters.</EmptyState> : null}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
            <span data-testid="invoice-count">
              {state.meta.total} invoice{state.meta.total === 1 ? "" : "s"} · page {state.meta.page} of {state.meta.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={state.meta.page <= 1}
                onClick={() => update({ page: state.meta.page - 1 })}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={state.meta.page >= state.meta.totalPages}
                onClick={() => update({ page: state.meta.page + 1 })}
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
