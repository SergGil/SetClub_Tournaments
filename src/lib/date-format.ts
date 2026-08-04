/**
 * "DD.MM.YYYY", computed via explicit UTC fields rather than
 * `toLocaleDateString` - safe inside a component that hydrates (nested
 * inside a Client Component like `Link`, or itself marked "use client"),
 * where locale/timezone-dependent formatting can produce a different string
 * during SSR (server's local timezone) than during hydration (the visitor's
 * browser timezone), triggering a hydration mismatch.
 */
export function formatDateUTC(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getUTCFullYear()}`;
}
