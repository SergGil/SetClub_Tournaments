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
 * calendar day first (UTC, same "scheduledDate, else createdAt" convention as
 * the day headers and the date filter), then by the clock time the match
 * actually finished (`completedAt`, the time every card shows).
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

const DAY_MS = 24 * 60 * 60 * 1000;

function effectiveDate(match: MatchOrderKeys): Date {
  return match.scheduledDate ?? match.createdAt;
}

function utcDay(match: MatchOrderKeys): number {
  return Math.floor(effectiveDate(match).getTime() / DAY_MS);
}

export function compareMatchesNewestFirst(a: MatchOrderKeys, b: MatchOrderKeys): number {
  const byDay = utcDay(b) - utcDay(a);
  if (byDay !== 0) return byDay;

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

/** A new array sorted newest-first - for lists that are already loaded in full. */
export function sortMatchesNewestFirst<T extends MatchOrderKeys>(matches: readonly T[]): T[] {
  return [...matches].sort(compareMatchesNewestFirst);
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
