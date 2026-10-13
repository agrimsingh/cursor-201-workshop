// Date helpers that work on whole UTC days, so "days overdue" doesn't depend on the server time zone.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / MS_PER_DAY);
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
