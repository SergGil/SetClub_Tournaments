import { prisma } from "@/lib/db";
import { loadNewestFirst, sortMatchesNewestFirst } from "@/lib/match-order";

export const padelMatchWithDetailsInclude = {
  tournament: { select: { id: true, name: true } },
  players: {
    include: {
      player: {
        select: { id: true, name: true, nickname: true, gender: true, user: { select: { image: true } } },
      },
    },
  },
  sets: { orderBy: { setNumber: "asc" } },
  // Padel twin of matchWithDetailsInclude's advancementsAsTarget - see docs/DOUBLES_GROUP_PLAYOFF.md.
  advancementsAsTarget: {
    select: {
      side: true,
      source: true,
      sourceGroup: true,
      sourceRank: true,
      outcome: true,
      sourceMatch: { select: { round: true } },
    },
  },
} as const;

/** The columns newest-first ordering needs - see match-order.ts. */
const ORDER_KEYS = { id: true, scheduledDate: true, createdAt: true, completedAt: true } as const;

/** Every Padel match the player took part in, newest first - see match-order.ts for the ordering. */
export async function getPlayerPadelMatches(playerId: string) {
  const matches = await prisma.padelMatch.findMany({
    where: { players: { some: { playerId } } },
    include: padelMatchWithDetailsInclude,
  });
  return sortMatchesNewestFirst(matches);
}

export function getPadelMatchById(id: string) {
  return prisma.padelMatch.findUnique({
    where: { id },
    include: padelMatchWithDetailsInclude,
  });
}

export function getPadelTournamentMatches(tournamentId: string) {
  return prisma.padelMatch.findMany({
    where: { tournamentId },
    include: padelMatchWithDetailsInclude,
    orderBy: [
      { completedAt: { sort: "desc", nulls: "first" } },
      { scheduledDate: "asc" },
      { createdAt: "asc" },
    ],
  });
}

/** The `limit` most recently *played* Padel matches club-wide, for a Padel hub feed - twin of getRecentCompletedMatches. */
export async function getRecentCompletedPadelMatches(limit: number) {
  const where = { status: "COMPLETED" as const, winnerSide: { not: null } };
  const keys = await prisma.padelMatch.findMany({ where, select: ORDER_KEYS });
  return loadNewestFirst(keys, limit, (ids) =>
    prisma.padelMatch.findMany({ where: { id: { in: ids } }, include: padelMatchWithDetailsInclude }),
  );
}

/** Decided (non-walkover) Padel matches whose tournament started in the given calendar year - Padel twin of getSeasonMatchCount, for the "Рік у SET.club" share card (src/lib/share/season-card-data.ts). */
export function getPadelSeasonMatchCount(year: number): Promise<number> {
  const start = new Date(`${year}-01-01T00:00:00.000Z`);
  const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);
  return prisma.padelMatch.count({
    where: {
      status: "COMPLETED",
      winnerSide: { not: null },
      walkover: false,
      tournament: { startDate: { gte: start, lt: end } },
    },
  });
}

export async function getAllPadelMatches() {
  const matches = await prisma.padelMatch.findMany({ include: padelMatchWithDetailsInclude });
  return sortMatchesNewestFirst(matches);
}

export type PadelMatchWithDetails = Awaited<ReturnType<typeof getPlayerPadelMatches>>[number];

export const PADEL_MATCHES_PAGE_SIZE = 20;

// CANCELLED is a valid PadelMatch.status, but nothing in the app ever sets a
// match to it (no cancel action exists), so it's excluded here - same
// reasoning as Tennis's MATCH_STATUS_FILTER_VALUES.
export const PADEL_MATCH_STATUS_FILTER_VALUES = ["SCHEDULED", "COMPLETED"] as const;
export type PadelMatchStatusFilterValue = (typeof PADEL_MATCH_STATUS_FILTER_VALUES)[number];

export type PadelMatchesFilter = { playerId?: string; date?: string; status?: PadelMatchStatusFilterValue };

/** Matches a completed-or-not match to a calendar day, preferring the scheduled date and falling back to when it was recorded - same convention as Tennis's matchDayFilter. */
function padelMatchDayFilter(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    OR: [
      { scheduledDate: { gte: start, lt: end } },
      { scheduledDate: null, createdAt: { gte: start, lt: end } },
    ],
  };
}

function padelMatchesWhere(filter: PadelMatchesFilter) {
  return {
    ...(filter.playerId ? { players: { some: { playerId: filter.playerId } } } : {}),
    ...(filter.date ? padelMatchDayFilter(filter.date) : {}),
    ...(filter.status ? { status: filter.status } : {}),
  };
}

/**
 * The first `limit` Padel matches (newest first) across the whole club,
 * optionally narrowed to one player and/or one calendar day, plus the total
 * count - Padel twin of getMatchesPage.
 */
export async function getPadelMatchesPage(
  limit: number,
  filter: PadelMatchesFilter,
): Promise<{ matches: PadelMatchWithDetails[]; total: number }> {
  const where = padelMatchesWhere(filter);
  // Ordering/paging happens in loadNewestFirst, not in the DB - see match-order.ts.
  const keys = await prisma.padelMatch.findMany({ where, select: ORDER_KEYS });
  const matches = await loadNewestFirst(keys, limit, (ids) =>
    prisma.padelMatch.findMany({ where: { id: { in: ids } }, include: padelMatchWithDetailsInclude }),
  );

  return { matches, total: keys.length };
}
