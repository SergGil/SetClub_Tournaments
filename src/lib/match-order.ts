import { kyivDayStart, toIsoDateKyiv, toIsoDateUTC } from "@/lib/date-format";

/**
 * Newest-first ordering for match history lists (player profile, /matches,
 * the recent-results feeds, the mobile API) - shared by Tennis and Padel.
 *
 * Why not just `ORDER BY scheduledDate DESC`: the playoff placeholders the
 * "4 групи по 3" / doubles-group randomizers create carry a `scheduledDate`
 * staggered by a few seconds per round (PLAYOFF_DISPLAY_ORDER - see
 * randomize-singles-groups12.ts) purely so the tournament's own "Матчі" tab
 * lists not-yet-played rounds in a stable order. Sorting a history list by
 * that raw timestamp lets those seconds override the real play order, e.g.
 * 1/4 (13:38) above 1/2 (14:37) above Фінал (16:22). So the order is by
 * calendar day first (matchCalendarDay - the same day the day headers and the
 * date filter use), then by the clock time the match actually finished
 * (`completedAt`, the time every card shows).
 *
 * Day first rather than `completedAt` first on purpose: results are sometimes
 * entered in one backfill session long after the fact, which would otherwise
 * surface old matches as if they had just been played (see
 * getRecentCompletedMatches).
 */
export type MatchOrderKeys = {
  scheduledDate: Date | null;
  createdAt: Date;
  completedAt: Date | null;
};

function effectiveDate(match: MatchOrderKeys): Date {
  return match.scheduledDate ?? match.createdAt;
}

/**
 * The calendar day ("YYYY-MM-DD") a match is listed and filtered under: its
 * scheduledDate - a date-only field stored as UTC midnight, so its UTC date -
 * else the day it was created on in Kyiv. createdAt is a real timestamp, and
 * its UTC date is still the previous day for anything entered between 00:00
 * and 03:00 Kyiv time. Shared by this ordering, the /matches day headers and
 * the date filter (queries/matches.ts's matchDayFilter), Tennis and Padel.
 */
export function matchCalendarDay(match: Pick<MatchOrderKeys, "scheduledDate" | "createdAt">): string {
  return match.scheduledDate ? toIsoDateUTC(match.scheduledDate) : toIsoDateKyiv(match.createdAt);
}

/**
 * matchCalendarDay as a Prisma `where` fragment: matches listed under the day
 * `isoDate` ("YYYY-MM-DD") - for the /matches and /padel/matches date filter
 * (both match tables share these columns).
 */
export function matchCalendarDayWhere(isoDate: string) {
  const start = new Date(`${isoDate}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    OR: [
      { scheduledDate: { gte: start, lt: end } },
      { scheduledDate: null, createdAt: { gte: kyivDayStart(isoDate), lt: kyivDayStart(toIsoDateUTC(end)) } },
    ],
  };
}

function compareWithinDays(a: MatchOrderKeys, b: MatchOrderKeys, dayA: string, dayB: string): number {
  // "YYYY-MM-DD" sorts lexicographically in date order.
  if (dayA !== dayB) return dayA < dayB ? 1 : -1;

  // Within a day: not-yet-played matches (no completedAt) first, then the most
  // recently finished - the same convention as the tournament "Матчі" tab.
  if (a.completedAt && b.completedAt) {
    const byCompleted = b.completedAt.getTime() - a.completedAt.getTime();
    if (byCompleted !== 0) return byCompleted;
  } else if (a.completedAt !== b.completedAt) {
    return a.completedAt ? 1 : -1;
  }

  return (
    effectiveDate(b).getTime() - effectiveDate(a).getTime() || b.createdAt.getTime() - a.createdAt.getTime()
  );
}

export function compareMatchesNewestFirst(a: MatchOrderKeys, b: MatchOrderKeys): number {
  return compareWithinDays(a, b, matchCalendarDay(a), matchCalendarDay(b));
}

/** A new array sorted newest-first - for lists that are already loaded in full. */
export function sortMatchesNewestFirst<T extends MatchOrderKeys>(matches: readonly T[]): T[] {
  // Each match's day computed once, not on every comparison (it's an Intl
  // call for the createdAt fallback, and /matches sorts the whole history).
  const dayOf = new Map(matches.map((m) => [m, matchCalendarDay(m)]));
  return [...matches].sort((a, b) => compareWithinDays(a, b, dayOf.get(a)!, dayOf.get(b)!));
}

/**
 * The `limit` newest matches (all of them when `limit` is omitted) out of
 * `keys` - a cheap id + ordering-columns query over the whole filtered set -
 * with the full rows then loaded for just those ids and returned in that same
 * order. A DB-level `take` can't be used for this: the DB order is by the raw
 * scheduledDate, so it would cut the newest day at the wrong matches.
 */
export async function loadNewestFirst<K extends MatchOrderKeys & { id: string }, T extends { id: string }>(
  keys: readonly K[],
  limit: number | undefined,
  loadByIds: (ids: string[]) => Promise<T[]>,
): Promise<T[]> {
  const ids = sortMatchesNewestFirst(keys)
    .slice(0, limit)
    .map((key) => key.id);
  if (ids.length === 0) return [];
  const rowById = new Map((await loadByIds(ids)).map((row) => [row.id, row]));
  return ids.flatMap((id) => rowById.get(id) ?? []);
}
