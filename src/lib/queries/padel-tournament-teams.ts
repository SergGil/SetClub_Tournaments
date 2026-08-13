import { prisma } from "@/lib/db";

/** Teams for MIXED-format team/tie play - Padel twin of getTournamentTeams (see docs/TOURNAMENT_TEAMS.md). Empty for every tournament that hasn't opted in. */
export async function getPadelTournamentTeams(tournamentId: string) {
  const teams = await prisma.padelTournamentTeam.findMany({
    where: { tournamentId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      members: { select: { player: { select: { id: true, name: true, nickname: true } } } },
    },
  });
  return teams.map((team) => ({ id: team.id, name: team.name, members: team.members.map((m) => m.player) }));
}

export type PadelTournamentTeamWithMembers = Awaited<ReturnType<typeof getPadelTournamentTeams>>[number];
