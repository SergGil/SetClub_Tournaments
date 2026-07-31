import { prisma } from "@/lib/db";

const matchWithDetailsInclude = {
  tournament: { select: { id: true, name: true } },
  players: { include: { player: { select: { id: true, name: true } } } },
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
    orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
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

export type MatchesFilter = { playerId?: string; date?: string };

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
