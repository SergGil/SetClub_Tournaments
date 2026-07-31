import { prisma } from "@/lib/db";

export function getPlayers() {
  return prisma.player.findMany({
    orderBy: { name: "asc" },
    include: { user: { select: { image: true, email: true } } },
  });
}

/** The first `limit` players (alphabetically) plus the total count, for a "load more" list. */
export async function getPlayersPage(
  limit: number,
): Promise<{ players: PlayerWithUser[]; total: number }> {
  const [players, total] = await Promise.all([
    prisma.player.findMany({
      orderBy: { name: "asc" },
      include: { user: { select: { image: true, email: true } } },
      take: limit,
    }),
    prisma.player.count(),
  ]);
  return { players, total };
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
