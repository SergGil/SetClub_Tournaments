import { unstable_cache } from "next/cache";

import type { TournamentFormat, TournamentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { PADEL_STATS_CACHE_TAG } from "@/lib/padel-stats";
import { getPadelTournamentStandingsRows } from "@/lib/padel-tournament-standings";
import { FINAL_ROUND } from "@/lib/playoff-rounds";
import { STATS_CACHE_TAG } from "@/lib/stats";
import { getTournamentStandingsRows } from "@/lib/tournament-standings";

/**
 * A tournament won without a Фінал match: the top row of its single standings
 * table once the round robin is over - exactly the row TournamentStandings
 * (src/components/tournament-standings.tsx, `hasWinner`) puts the trophy next
 * to. Feeds the finalist/champion badges (src/lib/achievements.ts) for the
 * tournaments that have no deciding match for them to count otherwise - see
 * docs/ACHIEVEMENTS.md, "Чемпіон без фіналу".
 */
export type RoundRobinTitle = {
  tournamentId: string;
  matchType: "SINGLES" | "DOUBLES";
  /** Every player on the winning row - one id for singles, both of the pair for doubles. */
  winnerIds: string[];
  /** Epoch ms, not Date (unstable_cache JSON round-trip): the last decided match's day, when the title was settled. */
  decidedAt: number;
};

type StandingsParticipant = {
  playerId: string;
  seed: number | null;
  group: number | null;
  withdrawnAt?: Date | string | null;
  player: { id: string; name: string; nickname?: string | null };
};

/** One tournament with no Фінал match, as fetched below - the pure builder's input. */
export type RoundRobinTitleCandidate = {
  id: string;
  format: TournamentFormat;
  status: TournamentStatus;
  participants: StandingsParticipant[];
  /** Decided matches only (status COMPLETED, winnerSide set). */
  matches: { scheduledDate: Date | null; completedAt: Date | null; createdAt: Date }[];
};

/**
 * The part of getTournamentStandingsRows/getPadelTournamentStandingsRows's
 * result this module reads - structural, so the tennis and padel builders
 * (separate, identically-shaped result types) both fit without a cast.
 */
export type RoundRobinStandings =
  | { mode: "individual"; rows: { key: string; wins: number }[]; roundRobinDone: boolean }
  | { mode: "grouped" };

/**
 * Which of `candidates` have an outright winner, by the same rule the
 * tournament page uses to draw its trophy (TournamentStandings' `hasWinner`,
 * minus `hasPlayoffFinal`, which the candidate query already excludes):
 *
 * - a single standings table (`mode: "individual"`) - a tournament split into
 *   groups (За групами / За сіяністю / custom groups) with no playoff has one
 *   trophy per group and no overall winner, so nobody gets the title;
 * - the tournament is COMPLETED, or its round robin is fully played out;
 * - the top row has at least one win.
 *
 * MIXED (team) tournaments are skipped: their winner is a team on the ties
 * table, not a row here, and their rubbers mix singles and doubles anyway.
 *
 * Split out from the cached fetchers below so it can be unit-tested with a
 * fake `standingsFor`, and so tennis and padel share one implementation.
 */
export async function buildRoundRobinTitles(
  candidates: RoundRobinTitleCandidate[],
  standingsFor: (candidate: RoundRobinTitleCandidate) => Promise<RoundRobinStandings>,
): Promise<RoundRobinTitle[]> {
  const titles = await Promise.all(
    candidates.map(async (candidate): Promise<RoundRobinTitle | null> => {
      if (candidate.format === "MIXED" || candidate.matches.length === 0) return null;
      const standings = await standingsFor(candidate);
      if (standings.mode !== "individual") return null;
      const top = standings.rows[0];
      if (!top || top.wins === 0) return null;
      if (candidate.status !== "COMPLETED" && !standings.roundRobinDone) return null;
      return {
        tournamentId: candidate.id,
        matchType: candidate.format,
        // A singles row is keyed by playerId; a doubles team row by both
        // playerIds joined with "+" (buildTeamRows in tournament-standings.ts).
        winnerIds: top.key.split("+"),
        // Same date precedence as AchievementMatchInput.playedAt
        // (toAchievementMatchInput), so a title's badge date lines up with
        // the match-based badges earned the same day.
        decidedAt: Math.max(
          ...candidate.matches.map((m) => (m.scheduledDate ?? m.completedAt ?? m.createdAt).getTime()),
        ),
      };
    }),
  );
  return titles.filter((t): t is RoundRobinTitle => t !== null);
}

/**
 * Only tournaments with no Фінал match at all - a scheduled, not-yet-played
 * final already suppresses the standings trophy on the page (hasFinalMatch
 * looks at every match regardless of status), so it suppresses the title
 * here too. MIXED is excluded up front; buildRoundRobinTitles re-checks it
 * only to narrow the type.
 */
const candidateWhere = {
  format: { in: ["SINGLES", "DOUBLES"] as TournamentFormat[] },
  matches: { none: { round: FINAL_ROUND } },
};

const candidateSelect = {
  id: true,
  format: true,
  status: true,
  participants: {
    select: {
      playerId: true,
      seed: true,
      group: true,
      withdrawnAt: true,
      player: { select: { id: true, name: true, nickname: true } },
    },
  },
  matches: {
    where: { status: "COMPLETED" as const, winnerSide: { not: null } },
    select: { scheduledDate: true, completedAt: true, createdAt: true },
  },
} as const;

/**
 * Every tennis tournament won without a final, club-wide. Cross-request
 * cached under the stats tag (invalidated by the same match-mutating actions
 * that refresh standings) because it replays getTournamentStandingsRows for
 * every finals-less tournament - a few queries each - which no single
 * profile view should pay for on its own. Consumed by loadPlayerAchievements
 * (src/lib/player-achievements-data.ts), which picks out one player's titles.
 */
export const getRoundRobinTitles = unstable_cache(
  async (): Promise<RoundRobinTitle[]> => {
    const candidates = await prisma.tournament.findMany({ where: candidateWhere, select: candidateSelect });
    return buildRoundRobinTitles(candidates, (c) => getTournamentStandingsRows(c.id, c.format, c.participants));
  },
  ["round-robin-titles"],
  { tags: [STATS_CACHE_TAG], revalidate: 60 },
);

/** Padel twin of getRoundRobinTitles - same rule, padel's own tables and cache tag. */
export const getPadelRoundRobinTitles = unstable_cache(
  async (): Promise<RoundRobinTitle[]> => {
    const candidates = await prisma.padelTournament.findMany({ where: candidateWhere, select: candidateSelect });
    return buildRoundRobinTitles(candidates, (c) =>
      getPadelTournamentStandingsRows(c.id, c.format, c.participants),
    );
  },
  ["padel-round-robin-titles"],
  { tags: [PADEL_STATS_CACHE_TAG], revalidate: 60 },
);
