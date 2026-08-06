import { prisma } from "@/lib/db";

export function getTournaments() {
  return prisma.tournament.findMany({
    orderBy: { startDate: "desc" },
    include: { _count: { select: { participants: true, matches: true } } },
  });
}

export type TournamentListItem = Awaited<ReturnType<typeof getTournaments>>[number];

export type TournamentSortKey = "startDate" | "participants" | "matches";
export type TournamentSort = { key: TournamentSortKey; dir: "asc" | "desc" };

/**
 * The first `limit` tournaments (newest first by default, optionally
 * name-matching `query` and/or sorted by a different column) plus the total
 * count, for a "load more" + search + sort list.
 */
export async function getTournamentsPage(
  limit: number,
  query?: string,
  sort?: TournamentSort,
): Promise<{ tournaments: TournamentListItem[]; total: number }> {
  const where = query ? { name: { contains: query, mode: "insensitive" as const } } : {};
  const dir = sort?.dir ?? "desc";
  const orderBy =
    sort?.key === "participants"
      ? { participants: { _count: dir } }
      : sort?.key === "matches"
        ? { matches: { _count: dir } }
        : { startDate: dir };
  const [tournaments, total] = await Promise.all([
    prisma.tournament.findMany({
      where,
      orderBy,
      include: { _count: { select: { participants: true, matches: true } } },
      take: limit,
    }),
    prisma.tournament.count({ where }),
  ]);
  return { tournaments, total };
}

export function getTournamentById(id: string) {
  return prisma.tournament.findUnique({
    where: { id },
    include: {
      participants: {
        include: { player: { select: { id: true, name: true } } },
        orderBy: { joinedAt: "asc" },
      },
      // Extra round-robin groups the admin named via "Додати групу", on top
      // of the built-in 1-6 (A-F) range (see createTournamentGroupAction).
      groups: { orderBy: { number: "asc" } },
      _count: { select: { matches: true } },
    },
  });
}

export type TournamentWithRoster = NonNullable<Awaited<ReturnType<typeof getTournamentById>>>;

export function getAllTournamentParticipants() {
  return prisma.tournamentParticipant.findMany({
    include: {
      tournament: { select: { name: true, startDate: true } },
      player: { select: { name: true } },
    },
    orderBy: [{ tournament: { startDate: "desc" } }, { joinedAt: "asc" }],
  });
}
