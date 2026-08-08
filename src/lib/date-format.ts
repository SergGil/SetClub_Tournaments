/**
 * "DD.MM.YYYY", computed via explicit UTC fields rather than
 * `toLocaleDateString` - safe inside a component that hydrates (nested
 * inside a Client Component like `Link`, or itself marked "use client"),
 * where locale/timezone-dependent formatting can produce a different string
 * during SSR (server's local timezone) than during hydration (the visitor's
 * browser timezone), triggering a hydration mismatch.
 *
 * Only correct for date-only fields deliberately stored as UTC midnight
 * (Tournament.startDate/endDate, Match.scheduledDate). For a genuine
 * wall-clock timestamp (e.g. NewsPost.createdAt), use `formatDateKyiv`
 * instead - extracting the UTC calendar day from a real timestamp shows the
 * wrong date for anything created between local midnight and UTC midnight.
 */
export function formatDateUTC(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getUTCFullYear()}`;
}

/**
 * "DD.MM.YYYY" for a genuine timestamp, rendered in the club's own timezone
 * (Europe/Kyiv) rather than UTC or the visitor's browser timezone. Fixing
 * the timezone explicitly (instead of using the visitor's local zone) keeps
 * this hydration-safe - the string is identical during SSR and hydration
 * regardless of where the visitor's browser clock is set.
 */
const kyivDateFormatter = new Intl.DateTimeFormat("uk-UA", {
  timeZone: "Europe/Kyiv",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatDateKyiv(date: Date): string {
  return kyivDateFormatter.format(date);
}

/**
 * "YYYY-MM-DD" for a genuine timestamp, in the club's own timezone
 * (Europe/Kyiv) rather than UTC - see `formatDateKyiv` for why a fixed
 * timezone matters here. For CSV/ISO-style exports of real timestamp
 * fields (e.g. TournamentParticipant.joinedAt), not date-only fields.
 */
export function toIsoDateKyiv(date: Date | string): string {
  const parts = kyivDateFormatter.formatToParts(new Date(date));
  const day = parts.find((p) => p.type === "day")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const year = parts.find((p) => p.type === "year")!.value;
  return `${year}-${month}-${day}`;
}

/**
 * "HH:MM" for a genuine timestamp, in the club's own timezone (Europe/Kyiv)
 * rather than the server's runtime timezone - see `formatDateKyiv` for why a
 * fixed timezone matters. Use this (not a bare `toLocaleTimeString`) for any
 * timestamp shown as a clock time, e.g. Match.completedAt: on a UTC-hosted
 * server, an un-pinned `toLocaleTimeString` shows the server's local time
 * (UTC), 2-3 hours off actual Kyiv wall-clock time.
 */
const kyivTimeFormatter = new Intl.DateTimeFormat("uk-UA", {
  timeZone: "Europe/Kyiv",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatTimeKyiv(date: Date): string {
  return kyivTimeFormatter.format(date);
}

/**
 * "DD.MM.YYYY, HH:MM" for a genuine timestamp, in the club's own timezone
 * (Europe/Kyiv) - see `formatDateKyiv`. Use for admin-facing timestamps that
 * need both date and time in one string (e.g. AuditLog.createdAt), instead
 * of a bare `toLocaleString` which defaults to the server's runtime timezone.
 */
const kyivDateTimeFormatter = new Intl.DateTimeFormat("uk-UA", {
  timeZone: "Europe/Kyiv",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTimeKyiv(date: Date): string {
  return kyivDateTimeFormatter.format(date);
}
