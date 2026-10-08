import { cache } from "react";

import { prisma } from "@/lib/db";
import type { TournamentFormat } from "@/lib/validation/tournament";

export function getPadelTournaments() {
  return prisma.padelTournament.findMany({
    orderBy: { startDate: "desc" },
    include: { _count: { select: { participants: true, matches: true } } },
  });
}

export type PadelTournamentListItem = Awaited<ReturnType<typeof getPadelTournaments>>[number];

/** Completed Padel tournaments whose startDate falls in the given calendar year - Padel twin of getSeasonTournamentCount, for the "Рік у SET.club" share card (src/lib/share/season-card-data.ts). */
export function getPadelSeasonTournamentCount(year: number): Promise<number> {
  const start = new Date(`${year}-01-01T00:00:00.000Z`);
  const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);
  return prisma.padelTournament.count({ where: { status: "COMPLETED", startDate: { gte: start, lt: end } } });
}

/**
 * Every women-only padel tournament's id, club-wide - Padel twin of getWomensOnlyTournamentIds
 * (queries/tournaments.ts): lets a page that renders a mix of matches pick the correct rating
 * pool per match (`ids.has(match.tournament.id)`) without adding `isWomensOnly` to the shared
 * match include.
 */
export async function getPadelWomensOnlyTournamentIds(): Promise<Set<string>> {
  const rows = await prisma.padelTournament.findMany({ where: { isWomensOnly: true }, select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

export type PadelTournamentSortKey = "startDate" | "participants" | "matches";
export type PadelTournamentSort = { key: PadelTournamentSortKey; dir: "asc" | "desc" };

/**
 * The first `limit` tournaments (newest first by default, optionally
 * name-matching `query`, filtered to a single `format`, and/or sorted by a
 * different column) plus the total count, for a "load more" + search + sort
 * list - Padel twin of getTournamentsPage.
 */
export async function getPadelTournamentsPage(
  limit: number,
  query?: string,
  sort?: PadelTournamentSort,
  format?: TournamentFormat,
): Promise<{ tournaments: PadelTournamentListItem[]; total: number }> {
  const where = {
    ...(query ? { name: { contains: query, mode: "insensitive" as const } } : {}),
    ...(format ? { format } : {}),
  };
  const dir = sort?.dir ?? "desc";
  const orderBy =
    sort?.key === "participants"
      ? { participants: { _count: dir } }
      : sort?.key === "matches"
        ? { matches: { _count: dir } }
        : { startDate: dir };
  const [tournaments, total] = await Promise.all([
    prisma.padelTournament.findMany({
      where,
      orderBy,
      include: { _count: { select: { participants: true, matches: true } } },
      take: limit,
    }),
    prisma.padelTournament.count({ where }),
  ]);
  return { tournaments, total };
}

// Wrapped in React's cache() so generateMetadata() and the page component -
// both of which call this with the same id on the same request - share one
// query instead of hitting the DB twice, same reasoning as getTournamentById.
export const getPadelTournamentById = cache((id: string) => {
  return prisma.padelTournament.findUnique({
    where: { id },
    include: {
      participants: {
        include: { player: { select: { id: true, name: true, nickname: true } } },
        orderBy: { joinedAt: "asc" },
      },
      groups: {
        orderBy: { number: "asc" },
        include: { members: { select: { playerId: true } } },
      },
      _count: { select: { matches: true } },
    },
  });
});

export type PadelTournamentWithRoster = NonNullable<Awaited<ReturnType<typeof getPadelTournamentById>>>;

export function getAllPadelTournamentParticipants() {
  return prisma.padelTournamentParticipant.findMany({
    include: {
      tournament: { select: { name: true, startDate: true } },
      player: { select: { name: true, nickname: true } },
    },
    orderBy: [{ tournament: { startDate: "desc" } }, { joinedAt: "asc" }],
  });
}
