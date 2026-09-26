import { prisma } from "@/lib/db";

export type HomeStats = {
  tournamentsCount: number;
  matchesCount: number;
  playersCount: number;
};

/**
 * All-time, club-wide counts for the homepage stats strip (HomeStats,
 * rendered on `/` between TripleSplit and HomeFooter) - tennis + padel
 * combined, since those are separate Prisma models (PadelTournament/
 * PadelMatch mirror Tournament/Match rather than sharing rows). Unlike
 * getSeasonTournamentCount/getSeasonMatchCount (tournaments.ts/matches.ts),
 * this has no year scoping - it's an all-time total, not a season recap.
 */
export async function getHomeStats(): Promise<HomeStats> {
  const [tennisTournaments, padelTournaments, tennisMatches, padelMatches, playersCount] = await Promise.all([
    prisma.tournament.count({ where: { status: "COMPLETED" } }),
    prisma.padelTournament.count({ where: { status: "COMPLETED" } }),
    prisma.match.count({ where: { status: "COMPLETED", winnerSide: { not: null }, walkover: false } }),
    prisma.padelMatch.count({ where: { status: "COMPLETED", winnerSide: { not: null }, walkover: false } }),
    prisma.player.count(),
  ]);

  return {
    tournamentsCount: tennisTournaments + padelTournaments,
    matchesCount: tennisMatches + padelMatches,
    playersCount,
  };
}
