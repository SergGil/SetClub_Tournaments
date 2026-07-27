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

export type MatchWithDetails = Awaited<ReturnType<typeof getPlayerMatches>>[number];
