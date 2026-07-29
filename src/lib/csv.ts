// Excel/Sheets treat a cell starting with one of these as a formula, so a
// player/tournament name like "=cmd|'/c calc'!A1" would execute on open.
// Prefixing with a single quote (OWASP's standard CSV-injection mitigation)
// forces it to render as literal text instead.
const FORMULA_TRIGGER = /^[=+\-@]/;

function escapeCsvField(value: string): string {
  const guarded = FORMULA_TRIGGER.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

/** Builds an RFC 4180 CSV string (CRLF line endings) from a header row and data rows. */
export function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCsvField).join(",")).join("\r\n");
}
