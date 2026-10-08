import { prisma } from "@/lib/db";
import { sportsMatching } from "@/lib/player-sport";
import type { SportKey } from "@/lib/player-sport";

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

// Both tennis and padel relations - a player who only ever played padel must
// still count as "has history" (padelMatchAppearances/padelTournamentEntries
// cascade-delete, not restrict, so missing them here silently let padel
// results disappear with the player - see docs/CHANGELOG.md).
const playerCountsInclude = {
  _count: {
    select: {
      matchAppearances: true,
      tournamentEntries: true,
      padelMatchAppearances: true,
      padelTournamentEntries: true,
    },
  },
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
  /** Only players who play this sport (or BOTH) - the public /players and /padel/players lists; omitted by the admin list, which shows everyone. */
  sport?: SportKey,
  /**
   * Admin lists only: also match the player's own and linked-account email. Off by default -
   * emails are private, and letting a public search match them would reveal (by which
   * players show up) whether someone's email contains a given string.
   */
  { searchEmails = false }: { searchEmails?: boolean } = {},
): Promise<{ players: PlayerWithUser[]; total: number }> {
  const sportWhere = sport ? { sports: { in: sportsMatching(sport) } } : {};
  const where = query
    ? {
        ...sportWhere,
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { nickname: { contains: query, mode: "insensitive" as const } },
          ...(searchEmails
            ? [
                { email: { contains: query, mode: "insensitive" as const } },
                { user: { email: { contains: query, mode: "insensitive" as const } } },
              ]
            : []),
        ],
      }
    : sportWhere;
  const [players, total] = await Promise.all([
    prisma.player.findMany({
      where,
      include: { user: { select: { image: true, email: true } }, ...playerCountsInclude },
    }),
    prisma.player.count({ where }),
  ]);
  return { players: sortByName(players).slice(0, limit), total };
}

/**
 * Drops the player's own email and the linked Google account's email from a player row - what
 * the public JSON API returns to anyone who is not a tennis/padel admin (the admin screens and
 * the mobile admin app are the only consumers that need them).
 */
export function redactPlayerEmails<T extends { email: string | null; user: { email: string | null } | null }>(
  player: T,
): Omit<T, "email" | "user"> & { email: null; user: Omit<NonNullable<T["user"]>, "email"> | null } {
  const { email: _email, user, ...rest } = player;
  void _email;
  if (!user) return { ...rest, email: null, user: null };
  const { email: _userEmail, ...userRest } = user;
  void _userEmail;
  return { ...rest, email: null, user: userRest as Omit<NonNullable<T["user"]>, "email"> };
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
