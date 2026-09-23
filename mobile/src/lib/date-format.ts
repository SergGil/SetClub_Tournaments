/**
 * "DD.MM.YYYY" for a genuine timestamp, in the club's own timezone
 * (Europe/Kyiv) rather than the device's local timezone - mirrors
 * formatDateKyiv in the web app (src/lib/date-format.ts). Achievement
 * earnedAt mixes a UTC-midnight date-only value (scheduledDate) with real
 * timestamps (completedAt/createdAt) - Kyiv being always UTC+ means a
 * UTC-midnight value never shifts to the previous calendar day here, so
 * this is safe for both, unlike `toLocaleDateString` (device-timezone-
 * dependent, wrong near a day boundary for a viewer far from Kyiv).
 */
const kyivDateFormatter = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function formatDateKyiv(date: Date): string {
  return kyivDateFormatter.format(date);
}
