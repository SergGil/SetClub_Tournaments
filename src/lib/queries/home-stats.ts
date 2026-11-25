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
 * AuditLog.entityType values of the public tennis content the homepage date
 * tracks - every tournament/participant/group/team/tie, match and news
 * mutation (src/lib/actions/*) logs under one of these. Padel's are
 * "PadelTournament"/"PadelMatch", deliberately not listed.
 */
export const PUBLIC_CONTENT_AUDIT_ENTITIES = ["Tournament", "Match", "NewsPost"];

/**
 * When the club's public content last changed. Shown as the homepage's
 * "Оновлено ..." `<time>` and its JSON-LD `dateModified`, the date signal
 * AI/search engines look for. A real data date rather than a hardcoded one,
 * so it can't go stale. null on an empty database.
 *
 * Two sources, newest wins:
 * - the latest audit-log entry for tennis tournaments, matches and news -
 *   the only place a deletion leaves a trace (a deleted row has no
 *   updatedAt left to count). Indexed on createdAt, so it's one index read;
 * - the newest `updatedAt` of those tables - for writes that bypass the audit
 *   log: one-off scripts/imports, or a best-effort logAudit that failed.
 *   `_max(updatedAt)` has no index, so it scans the tables - a few hundred
 *   rows today; add `@@index([updatedAt])` or cache this if they grow large.
 *
 * Padel is left out while it's admin-only: editing a padel test tournament
 * shouldn't move a public date.
 */
export async function getContentLastUpdatedAt(): Promise<Date | null> {
  const [lastAudit, ...aggregates] = await Promise.all([
    prisma.auditLog.findFirst({
      where: { entityType: { in: PUBLIC_CONTENT_AUDIT_ENTITIES } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.tournament.aggregate({ _max: { updatedAt: true } }),
    prisma.match.aggregate({ _max: { updatedAt: true } }),
    prisma.newsPost.aggregate({ _max: { updatedAt: true } }),
  ]);
  const dates = [lastAudit?.createdAt, ...aggregates.map((result) => result._max.updatedAt)];
  const times = dates.flatMap((date) => (date ? [date.getTime()] : []));
  return times.length > 0 ? new Date(Math.max(...times)) : null;
}
