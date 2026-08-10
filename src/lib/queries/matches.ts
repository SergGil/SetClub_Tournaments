import { prisma } from "@/lib/db";

const matchWithDetailsInclude = {
  tournament: { select: { id: true, name: true } },
  players: { include: { player: { select: { id: true, name: true, nickname: true, gender: true } } } },
  sets: { orderBy: { setNumber: "asc" } },
} as const;

export function getPlayerMatches(playerId: string) {
  return prisma.match.findMany({
    where: { players: { some: { playerId } } },
    include: matchWithDetailsInclude,
    orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
  });
}

export function getTournamentMatches(tournamentId: string) {
  return prisma.match.findMany({
    where: { tournamentId },
    include: matchWithDetailsInclude,
    // completedAt is only ever set once a match is COMPLETED, so sorting it
    // with nulls first keeps not-yet-played matches on top (ordered soonest
    // first via scheduledDate/createdAt as a tiebreak) while the completed
    // ones below sort by completion time descending - most recently finished
    // first, rather than the order they happened to be created in.
    orderBy: [
      { completedAt: { sort: "desc", nulls: "first" } },
      { scheduledDate: "asc" },
      { createdAt: "asc" },
    ],
  });
}

/**
 * The `limit` most recently *played* matches club-wide, for a homepage feed.
 * Ordered by scheduledDate (the match's actual date), not completedAt -
 * historical results are sometimes entered in a single backfill session well
 * after the fact, which would otherwise surface old matches as if they'd
 * just happened (same fix as getMonthlyActivity in src/lib/stats.ts).
 */
export function getRecentCompletedMatches(limit: number) {
  return prisma.match.findMany({
    where: { status: "COMPLETED", winnerSide: { not: null } },
    include: matchWithDetailsInclude,
    orderBy: [{ scheduledDate: "desc" }, { completedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}

export function getAllMatches() {
  return prisma.match.findMany({
    include: matchWithDetailsInclude,
    orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
  });
}

export type MatchWithDetails = Awaited<ReturnType<typeof getPlayerMatches>>[number];

export const MATCHES_PAGE_SIZE = 20;

// CANCELLED is a valid Match.status, but nothing in the app ever sets a match
// to it (no cancel action exists), so it's excluded here - offering it as a
// filter option would only ever show "0 matches" and confuse the admin.
export const MATCH_STATUS_FILTER_VALUES = ["SCHEDULED", "COMPLETED"] as const;
export type MatchStatusFilterValue = (typeof MATCH_STATUS_FILTER_VALUES)[number];

export type MatchesFilter = { playerId?: string; date?: string; status?: MatchStatusFilterValue };

/** Matches a completed-or-not match to a calendar day, preferring the scheduled date and falling back to when it was recorded - same convention as the stats year filter. */
function matchDayFilter(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    OR: [
      { scheduledDate: { gte: start, lt: end } },
      { scheduledDate: null, createdAt: { gte: start, lt: end } },
    ],
  };
}

function matchesWhere(filter: MatchesFilter) {
  return {
    ...(filter.playerId ? { players: { some: { playerId: filter.playerId } } } : {}),
    ...(filter.date ? matchDayFilter(filter.date) : {}),
    ...(filter.status ? { status: filter.status } : {}),
  };
}

/**
 * The first `limit` matches (newest first) across the whole club, optionally
 * narrowed to one player and/or one calendar day, plus the total count - for
 * a "load more" list rather than numbered pages.
 */
export async function getMatchesPage(
  limit: number,
  filter: MatchesFilter,
): Promise<{ matches: MatchWithDetails[]; total: number }> {
  const where = matchesWhere(filter);
  const [matches, total] = await Promise.all([
    prisma.match.findMany({
      where,
      include: matchWithDetailsInclude,
      orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
      take: limit,
    }),
    prisma.match.count({ where }),
  ]);

  return { matches, total };
}
