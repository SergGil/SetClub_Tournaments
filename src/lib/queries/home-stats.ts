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

/**
 * When the club's public content last changed - the newest `updatedAt`
 * across tennis tournaments, tennis matches and news posts. Shown as the
 * homepage's "Оновлено ..." `<time>` and its JSON-LD `dateModified`, the
 * date signal AI/search engines look for. A real data date rather than a
 * hardcoded one, so it can't go stale. Padel is left out while it's
 * admin-only: editing a padel test tournament shouldn't move a public date.
 * null on an empty database.
 */
export async function getContentLastUpdatedAt(): Promise<Date | null> {
  const results = await Promise.all([
    prisma.tournament.aggregate({ _max: { updatedAt: true } }),
    prisma.match.aggregate({ _max: { updatedAt: true } }),
    prisma.newsPost.aggregate({ _max: { updatedAt: true } }),
  ]);
  const times = results.flatMap((result) => (result._max.updatedAt ? [result._max.updatedAt.getTime()] : []));
  return times.length > 0 ? new Date(Math.max(...times)) : null;
}
