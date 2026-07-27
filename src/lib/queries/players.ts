import { prisma } from "@/lib/db";

export function getPlayers() {
  return prisma.player.findMany({
    orderBy: { name: "asc" },
    include: { user: { select: { image: true, email: true } } },
  });
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
