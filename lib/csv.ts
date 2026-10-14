const NEEDS_QUOTING = /[",\n\r]/;

/** Escapes one CSV field: formula-safe prefix, then RFC-style quoting when needed. */
export function escapeCsvField(value: string): string {
  let field = value;
  if (/^[=+\-@]/.test(field)) {
    field = `'${field}`;
  }
  if (NEEDS_QUOTING.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function formatCsvRow(fields: readonly string[]): string {
  return fields.map(escapeCsvField).join(",");
}
