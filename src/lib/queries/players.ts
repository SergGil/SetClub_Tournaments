import { prisma } from "@/lib/db";

// Postgres's default collation sorts by raw Unicode code point, not Ukrainian
// dictionary order - Є/І/Ї sit at unusually low code points (inherited from
// their historical placement in the Cyrillic block), so `ORDER BY name ASC`
// puts names starting with them before "А"/"Б"/etc instead of after "З".
// Sorting in JS with a Ukrainian collator instead gives the order a Ukrainian
// speaker actually expects.
const nameCollator = new Intl.Collator("uk");

function sortByName<T extends { name: string }>(players: T[]): T[] {
  return [...players].sort((a, b) => nameCollator.compare(a.name, b.name));
}

const playerCountsInclude = {
  _count: { select: { matchAppearances: true, tournamentEntries: true } },
} as const;

export async function getPlayers() {
  const players = await prisma.player.findMany({
    include: { user: { select: { image: true, email: true } }, ...playerCountsInclude },
  });
  return sortByName(players);
}

/**
 * Every already-linked userId, club-wide - not just the current page/search
 * result. Used to compute which accounts are still "unlinked" (available in
 * LinkPlayerControl's picker) independently of pagination/search on the
 * players list itself, so an account linked to a player outside the current
 * page doesn't wrongly show up as available.
 */
export async function getLinkedUserIds(): Promise<Set<string>> {
  const rows = await prisma.player.findMany({
    where: { userId: { not: null } },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId!));
}

/**
 * The first `limit` players (alphabetically, optionally name-matching
 * `query`) plus the total count, for a "load more" + search list. Sorts in
 * JS (see nameCollator above), so pagination fetches every matching row
 * rather than paging at the database level - fine at this club's scale.
 */
export async function getPlayersPage(
  limit: number,
  query?: string,
): Promise<{ players: PlayerWithUser[]; total: number }> {
  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { nickname: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
          { user: { email: { contains: query, mode: "insensitive" as const } } },
        ],
      }
    : {};
  const [players, total] = await Promise.all([
    prisma.player.findMany({
      where,
      include: { user: { select: { image: true, email: true } }, ...playerCountsInclude },
    }),
    prisma.player.count({ where }),
  ]);
  return { players: sortByName(players).slice(0, limit), total };
}

export function getPlayerById(id: string) {
  return prisma.player.findUnique({
    where: { id },
    include: { user: { select: { image: true, email: true } } },
  });
}

/** The linked Player record for a given Auth.js User id, if any. */
export function getPlayerByUserId(userId: string) {
  return prisma.player.findUnique({ where: { userId }, select: { id: true, name: true } });
}

export type PlayerWithUser = Awaited<ReturnType<typeof getPlayers>>[number];
