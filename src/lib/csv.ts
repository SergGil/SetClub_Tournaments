function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Builds an RFC 4180 CSV string (CRLF line endings) from a header row and data rows. */
export function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCsvField).join(",")).join("\r\n");
}
