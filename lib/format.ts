// Display helpers shared by server and client components. Dates render in UTC so the
// server and browser always agree.

const DATE_FORMAT = new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  hour12: false,
});

export function formatDate(value: Date | string): string {
  return DATE_FORMAT.format(typeof value === "string" ? new Date(value) : value);
}

export function formatDateTime(value: Date | string): string {
  return `${DATE_TIME_FORMAT.format(typeof value === "string" ? new Date(value) : value)} UTC`;
}

export function humanize(value: string): string {
  const text = value.replace(/[_.]/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
