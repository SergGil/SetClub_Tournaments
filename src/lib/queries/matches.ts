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

export const MATCHES_PAGE_SIZE = 10;

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
 * A page of matches (newest first) across the whole club, optionally
 * narrowed to one player and/or one calendar day. `page` is clamped to
 * `[1, totalPages]` so an out-of-range page param (e.g. a stale link after
 * matches were deleted) still returns the nearest valid page instead of an
 * empty result.
 */
export async function getMatchesPage(
  page: number,
  filter: MatchesFilter,
): Promise<{ matches: MatchWithDetails[]; total: number; page: number; totalPages: number }> {
  const where = matchesWhere(filter);
  const total = await prisma.match.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / MATCHES_PAGE_SIZE));
  const clampedPage = Math.min(Math.max(1, page), totalPages);

  const matches = await prisma.match.findMany({
    where,
    include: matchWithDetailsInclude,
    orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
    skip: (clampedPage - 1) * MATCHES_PAGE_SIZE,
    take: MATCHES_PAGE_SIZE,
  });

  return { matches, total, page: clampedPage, totalPages };
}
