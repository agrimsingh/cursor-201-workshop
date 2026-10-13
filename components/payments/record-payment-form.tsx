"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { FormError } from "@/components/ui/dialog";
import { Money } from "@/components/ui/money";
import { apiRequest, errorMessage } from "@/lib/client/api";
import { formatDate, humanize } from "@/lib/format";
import { asCurrency, CURRENCIES, MoneyError, parseMoney, toDecimalString, type Currency } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/validation/payments";

interface CustomerOption {
  id: string;
  name: string;
  currency: string;
}

interface OpenInvoiceOption {
  id: string;
  number: string;
  customerId: string;
  currency: string;
  dueDate: string;
  balanceMinor: number;
}

function safeParse(value: string, currency: Currency): number | null {
  if (!value.trim()) return 0;
  try {
    return parseMoney(value, currency);
  } catch (error) {
    if (error instanceof MoneyError) return null;
    throw error;
  }
}

export function RecordPaymentForm({
  customers,
  openInvoices,
  initialCustomerId,
  initialInvoiceId,
  today,
}: {
  customers: CustomerOption[];
  openInvoices: OpenInvoiceOption[];
  initialCustomerId?: string;
  initialInvoiceId?: string;
  today: string;
}) {
  const router = useRouter();
  const initialInvoice = openInvoices.find((invoice) => invoice.id === initialInvoiceId);
  const [customerId, setCustomerId] = useState(initialInvoice?.customerId ?? initialCustomerId ?? customers[0]?.id ?? "");
  const customer = customers.find((c) => c.id === customerId);
  const [currency, setCurrency] = useState<Currency>(asCurrency(initialInvoice?.currency ?? customer?.currency ?? "AUD"));
  const [amount, setAmount] = useState(initialInvoice ? toDecimalString(initialInvoice.balanceMinor, currency) : "");
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>("bank_transfer");
  const [reference, setReference] = useState("");
  const [receivedAt, setReceivedAt] = useState(today);
  const [mode, setMode] = useState<"oldest_first" | "explicit">(initialInvoice ? "explicit" : "oldest_first");
  const [lines, setLines] = useState<Record<string, string>>(
    initialInvoice ? { [initialInvoice.id]: toDecimalString(initialInvoice.balanceMinor, currency) } : {},
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const candidates = useMemo(
    () => openInvoices.filter((invoice) => invoice.customerId === customerId && invoice.currency === currency),
    [openInvoices, customerId, currency],
  );
  const amountMinor = safeParse(amount, currency);
  const allocatedMinor =
    mode === "explicit"
      ? candidates.reduce((sum, invoice) => sum + (safeParse(lines[invoice.id] ?? "", currency) ?? 0), 0)
      : Math.min(amountMinor ?? 0, candidates.reduce((sum, invoice) => sum + invoice.balanceMinor, 0));

  function changeCustomer(id: string) {
    setCustomerId(id);
    const next = customers.find((c) => c.id === id);
    if (next) setCurrency(asCurrency(next.currency));
    setLines({});
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const paymentMinor = parseMoney(amount, currency);
      const explicitLines = Object.entries(lines)
        .map(([invoiceId, value]) => ({ invoiceId, amountMinor: value.trim() ? parseMoney(value, currency) : 0 }))
        .filter((line) => line.amountMinor > 0 && candidates.some((invoice) => invoice.id === line.invoiceId));
      setBusy(true);
      await apiRequest("POST", "/api/payments", {
        customerId,
        currency,
        amountMinor: paymentMinor,
        method,
        reference: reference.trim() || undefined,
        receivedAt,
        allocation: mode === "explicit" ? { mode, lines: explicitLines } : { mode },
      });
      router.push(initialInvoice ? `/invoices/${initialInvoice.id}` : "/payments");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="card flex flex-col gap-5 p-5" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="customer">
            Customer
          </label>
          <select id="customer" className="input" value={customerId} onChange={(e) => changeCustomer(e.target.value)}>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-[6rem_1fr] gap-2">
          <div>
            <label className="label" htmlFor="currency">
              Currency
            </label>
            <select
              id="currency"
              className="input"
              value={currency}
              onChange={(e) => {
                setCurrency(asCurrency(e.target.value));
                setLines({});
              }}
            >
              {CURRENCIES.map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="payment-amount">
              Amount received
            </label>
            <input
              id="payment-amount"
              className="input"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="method">
            Method
          </label>
          <select id="method" className="input" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
            {PAYMENT_METHODS.map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="reference">
              Reference
            </label>
            <input id="reference" className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="received-at">
              Received on
            </label>
            <input
              id="received-at"
              type="date"
              className="input"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </div>
        </div>
      </div>

      <fieldset>
        <legend className="label">Allocation</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === "oldest_first"} onChange={() => setMode("oldest_first")} />
            Oldest invoices first
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === "explicit"} onChange={() => setMode("explicit")} />
            Choose invoices
          </label>
        </div>
      </fieldset>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Due</th>
              <th className="text-right">Balance</th>
              {mode === "explicit" ? <th className="w-40 text-right">Apply</th> : null}
            </tr>
          </thead>
          <tbody>
            {candidates.map((invoice) => (
              <tr key={invoice.id}>
                <td className="font-mono text-xs">{invoice.number}</td>
                <td>{formatDate(invoice.dueDate)}</td>
                <td className="text-right">
                  <Money minor={invoice.balanceMinor} currency={invoice.currency} />
                </td>
                {mode === "explicit" ? (
                  <td>
                    <input
                      aria-label={`Apply to ${invoice.number}`}
                      className="input text-right"
                      inputMode="decimal"
                      value={lines[invoice.id] ?? ""}
                      onChange={(e) => setLines({ ...lines, [invoice.id]: e.target.value })}
                    />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {candidates.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">No open {currency} invoices. The full amount will be held as credit.</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-slate-600" data-testid="allocation-preview">
          Allocating <Money minor={allocatedMinor} currency={currency} className="font-medium" />
          {amountMinor !== null && amountMinor > allocatedMinor ? (
            <>
              {" "}
              · <Money minor={amountMinor - allocatedMinor} currency={currency} className="font-medium" /> held as unapplied credit
            </>
          ) : null}
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => router.back()}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            Record payment
          </button>
        </div>
      </div>
      <FormError message={error} />
    </form>
  );
}
