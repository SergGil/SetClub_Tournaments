import { prisma } from "@/lib/db";

export function getTournaments() {
  return prisma.tournament.findMany({
    orderBy: { startDate: "desc" },
    include: { _count: { select: { participants: true, matches: true } } },
  });
}

export function getTournamentById(id: string) {
  return prisma.tournament.findUnique({
    where: { id },
    include: {
      participants: {
        include: { player: { select: { id: true, name: true } } },
        orderBy: { joinedAt: "asc" },
      },
      _count: { select: { matches: true } },
    },
  });
}

export type TournamentWithRoster = NonNullable<Awaited<ReturnType<typeof getTournamentById>>>;
