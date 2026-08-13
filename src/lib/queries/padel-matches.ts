import { prisma } from "@/lib/db";

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
} as const;

export function getPlayerPadelMatches(playerId: string) {
  return prisma.padelMatch.findMany({
    where: { players: { some: { playerId } } },
    include: padelMatchWithDetailsInclude,
    orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
  });
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
export function getRecentCompletedPadelMatches(limit: number) {
  return prisma.padelMatch.findMany({
    where: { status: "COMPLETED", winnerSide: { not: null } },
    include: padelMatchWithDetailsInclude,
    orderBy: [{ scheduledDate: "desc" }, { completedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}

export function getAllPadelMatches() {
  return prisma.padelMatch.findMany({
    include: padelMatchWithDetailsInclude,
    orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
  });
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
  const [matches, total] = await Promise.all([
    prisma.padelMatch.findMany({
      where,
      include: padelMatchWithDetailsInclude,
      orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
      take: limit,
    }),
    prisma.padelMatch.count({ where }),
  ]);

  return { matches, total };
}
