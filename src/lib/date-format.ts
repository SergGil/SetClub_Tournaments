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

/** "YYYY-MM-DD" of a date-only field stored as UTC midnight (see formatDateUTC). */
export function toIsoDateUTC(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

const kyivWallClockFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Kyiv",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/**
 * The instant Kyiv's calendar day `isoDate` ("YYYY-MM-DD") starts at - 00:00
 * local, i.e. 22:00 or 21:00 UTC the day before. For filtering a genuine
 * timestamp (e.g. Match.createdAt) by the club's calendar day. Kyiv switches
 * DST at 03:00/04:00 local, never around midnight, so the offset read at that
 * date's UTC midnight is the one in effect at Kyiv midnight too.
 */
export function kyivDayStart(isoDate: string): Date {
  const utcMidnight = new Date(`${isoDate}T00:00:00.000Z`);
  const parts = kyivWallClockFormatter.formatToParts(utcMidnight);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)!.value);
  const wallClockAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  const offsetMs = wallClockAsUtc - utcMidnight.getTime();
  return new Date(utcMidnight.getTime() - offsetMs);
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

/**
 * "24 листопада 2026 р." for a genuine timestamp, in the club's own timezone
 * (Europe/Kyiv) - see `formatDateKyiv`. For prose next to a `<time>` element
 * (the homepage's "Оновлено ..." line), where "24.11.2026" reads like a form field.
 */
const kyivLongDateFormatter = new Intl.DateTimeFormat("uk-UA", {
  timeZone: "Europe/Kyiv",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatLongDateKyiv(date: Date): string {
  return kyivLongDateFormatter.format(date);
}
