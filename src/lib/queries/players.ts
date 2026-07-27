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
