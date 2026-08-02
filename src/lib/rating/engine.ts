import { computeDominance } from "./dominance";
import { GLICKO2_DEFAULT, updateGlicko2Period } from "./glicko2";
import type { Glicko2Rating, Glicko2Result } from "./glicko2";
import { OPENSKILL_DEFAULT, updateDoublesMatch } from "./openskill";
import type { OpenSkillRating } from "./openskill";

export type RatingMatchRow = {
  id: string;
  tournamentId: string;
  /**
   * Epoch milliseconds, not Date - these rows are round-tripped through
   * Next.js's unstable_cache (JSON serialization), which turns Date objects
   * into strings on a cache hit; plain numbers survive that boundary as-is.
   */
  tournamentStartDate: number;
  winnerSide: "A" | "B";
  createdAt: number;
  /**
   * 1 entry/side for singles, 2 entries/side for doubles. `seeded` is this
   * player's TournamentParticipant.seed status in this specific tournament
   * (unused for singles) - see the SEEDED_SHARE note in openskill.ts.
   */
  players: { side: "A" | "B"; playerId: string; seeded: boolean }[];
  sets: { sideAGames: number; sideBGames: number }[];
};

export type SinglesRatingRow = { playerId: string; rating: Glicko2Rating; matchesPlayed: number };
export type DoublesRatingRow = { playerId: string; rating: OpenSkillRating; matchesPlayed: number };

function pushResult(map: Map<string, Glicko2Result[]>, playerId: string, result: Glicko2Result) {
  const list = map.get(playerId);
  if (list) list.push(result);
  else map.set(playerId, [result]);
}

function bumpCount(map: Map<string, number>, playerId: string) {
  map.set(playerId, (map.get(playerId) ?? 0) + 1);
}

/**
 * Replays the full singles match history, one Glicko-2 rating period per
 * tournament (periods ordered by tournament start date), rather than
 * game-by-game - see docs/RATING.md for why this maps naturally onto the
 * lack of reliable ordering between matches within one tournament.
 */
export function computeSinglesRatings(rows: RatingMatchRow[]): Map<string, SinglesRatingRow> {
  const ratings = new Map<string, Glicko2Rating>();
  const matchesPlayed = new Map<string, number>();

  const byTournament = new Map<string, { startDate: number; rows: RatingMatchRow[] }>();
  for (const row of rows) {
    const group = byTournament.get(row.tournamentId);
    if (group) group.rows.push(row);
    else byTournament.set(row.tournamentId, { startDate: row.tournamentStartDate, rows: [row] });
  }

  const periods = [...byTournament.entries()].sort(
    ([idA, a], [idB, b]) => a.startDate - b.startDate || idA.localeCompare(idB),
  );

  for (const [, period] of periods) {
    // Every opponent lookup this period uses this pre-period snapshot, never
    // a rating already updated earlier in the same period.
    const preSnapshot = new Map(ratings);
    const resultsByPlayer = new Map<string, Glicko2Result[]>();
    const playedThisPeriod = new Set<string>();

    for (const row of period.rows) {
      const sideA = row.players.find((p) => p.side === "A");
      const sideB = row.players.find((p) => p.side === "B");
      if (!sideA || !sideB) continue;

      const dominance = computeDominance(row.sets, row.winnerSide);
      const winnerId = row.winnerSide === "A" ? sideA.playerId : sideB.playerId;
      const loserId = row.winnerSide === "A" ? sideB.playerId : sideA.playerId;
      const winnerPre = preSnapshot.get(winnerId) ?? GLICKO2_DEFAULT;
      const loserPre = preSnapshot.get(loserId) ?? GLICKO2_DEFAULT;

      pushResult(resultsByPlayer, winnerId, { opponent: loserPre, score: dominance });
      pushResult(resultsByPlayer, loserId, { opponent: winnerPre, score: 1 - dominance });
      playedThisPeriod.add(winnerId);
      playedThisPeriod.add(loserId);
      bumpCount(matchesPlayed, winnerId);
      bumpCount(matchesPlayed, loserId);
    }

    for (const [playerId, results] of resultsByPlayer) {
      const pre = preSnapshot.get(playerId) ?? GLICKO2_DEFAULT;
      ratings.set(playerId, updateGlicko2Period(pre, results));
    }
    // Previously-seen players who sat out this period only get RD inflation.
    for (const [playerId, pre] of preSnapshot) {
      if (!playedThisPeriod.has(playerId)) {
        ratings.set(playerId, updateGlicko2Period(pre, []));
      }
    }
  }

  const result = new Map<string, SinglesRatingRow>();
  for (const [playerId, rating] of ratings) {
    result.set(playerId, { playerId, rating, matchesPlayed: matchesPlayed.get(playerId) ?? 0 });
  }
  return result;
}

/**
 * Replays the full doubles match history sequentially - OpenSkill, unlike
 * Glicko-2, has no rating-period concept, so matches are processed one at a
 * time in a fully deterministic order.
 */
export function computeDoublesRatings(rows: RatingMatchRow[]): Map<string, DoublesRatingRow> {
  const ratings = new Map<string, OpenSkillRating>();
  const matchesPlayed = new Map<string, number>();

  const sorted = [...rows].sort(
    (a, b) =>
      a.tournamentStartDate - b.tournamentStartDate ||
      a.createdAt - b.createdAt ||
      a.id.localeCompare(b.id),
  );

  for (const row of sorted) {
    const sideA = row.players.filter((p) => p.side === "A");
    const sideB = row.players.filter((p) => p.side === "B");
    if (sideA.length !== 2 || sideB.length !== 2) continue;

    const teamA: [OpenSkillRating, OpenSkillRating] = [
      ratings.get(sideA[0].playerId) ?? OPENSKILL_DEFAULT,
      ratings.get(sideA[1].playerId) ?? OPENSKILL_DEFAULT,
    ];
    const teamB: [OpenSkillRating, OpenSkillRating] = [
      ratings.get(sideB[0].playerId) ?? OPENSKILL_DEFAULT,
      ratings.get(sideB[1].playerId) ?? OPENSKILL_DEFAULT,
    ];

    let gamesA = 0;
    let gamesB = 0;
    for (const set of row.sets) {
      gamesA += set.sideAGames;
      gamesB += set.sideBGames;
    }

    const seededA: [boolean, boolean] = [sideA[0].seeded, sideA[1].seeded];
    const seededB: [boolean, boolean] = [sideB[0].seeded, sideB[1].seeded];
    const updated = updateDoublesMatch(teamA, teamB, row.winnerSide, gamesA, gamesB, seededA, seededB);
    ratings.set(sideA[0].playerId, updated.teamA[0]);
    ratings.set(sideA[1].playerId, updated.teamA[1]);
    ratings.set(sideB[0].playerId, updated.teamB[0]);
    ratings.set(sideB[1].playerId, updated.teamB[1]);

    for (const p of [...sideA, ...sideB]) bumpCount(matchesPlayed, p.playerId);
  }

  const result = new Map<string, DoublesRatingRow>();
  for (const [playerId, rating] of ratings) {
    result.set(playerId, { playerId, rating, matchesPlayed: matchesPlayed.get(playerId) ?? 0 });
  }
  return result;
}
