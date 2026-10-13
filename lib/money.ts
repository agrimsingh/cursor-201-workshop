// Money is an integer number of minor units (cents, pence, yen) plus an ISO 4217 code.
// Arithmetic only ever happens on integers. Floats appear only when formatting for display.

export const CURRENCIES = ["AUD", "USD", "EUR", "GBP", "NZD", "JPY"] as const;
export type Currency = (typeof CURRENCIES)[number];

const MINOR_UNIT_EXPONENT: Record<Currency, number> = {
  AUD: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  NZD: 2,
  JPY: 0,
};

export interface Money {
  amountMinor: number;
  currency: Currency;
}

export class MoneyError extends Error {}

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

export function asCurrency(value: string): Currency {
  if (!isCurrency(value)) throw new MoneyError(`Unsupported currency: ${value}`);
  return value;
}

export function minorUnitExponent(currency: Currency): number {
  return MINOR_UNIT_EXPONENT[currency];
}

export function assertMinorUnits(amountMinor: number): void {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new MoneyError(`Money must be an integer number of minor units, got ${amountMinor}`);
  }
}

export function money(amountMinor: number, currency: Currency): Money {
  assertMinorUnits(amountMinor);
  return { amountMinor, currency };
}

export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

export function sumMinor(values: readonly number[]): number {
  return values.reduce((total, value) => {
    assertMinorUnits(value);
    return total + value;
  }, 0);
}

/** Parses a user-entered decimal string ("1,234.50") into minor units without using floats. */
export function parseMoney(input: string, currency: Currency): number {
  const exponent = minorUnitExponent(currency);
  const cleaned = input.trim().replace(/,/g, "");
  const pattern = exponent === 0 ? /^-?\d+$/ : new RegExp(`^-?\\d+(\\.\\d{1,${exponent}})?$`);
  if (!pattern.test(cleaned)) {
    throw new MoneyError(
      exponent === 0
        ? `${currency} amounts must be whole numbers`
        : `Enter an amount with at most ${exponent} decimal places`,
    );
  }
  const negative = cleaned.startsWith("-");
  const [whole, fraction = ""] = cleaned.replace("-", "").split(".");
  const minor = Number(whole + fraction.padEnd(exponent, "0"));
  assertMinorUnits(minor);
  return negative ? -minor : minor;
}

/** Renders minor units as a plain decimal string ("1234.50"), the inverse of parseMoney. */
export function toDecimalString(amountMinor: number, currency: Currency): string {
  assertMinorUnits(amountMinor);
  const exponent = minorUnitExponent(currency);
  if (exponent === 0) return String(amountMinor);
  const sign = amountMinor < 0 ? "-" : "";
  const digits = String(Math.abs(amountMinor)).padStart(exponent + 1, "0");
  return `${sign}${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`;
}

export function formatMoney(amountMinor: number, currency: Currency | string): string {
  const code = asCurrency(currency);
  const exponent = minorUnitExponent(code);
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: code,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(Number(toDecimalString(amountMinor, code)));
}
