import { FINAL_ROUND } from "@/lib/playoff-rounds";
import type { HeadToHead, StandingsRow } from "@/lib/standings-sort";
import { recordHeadToHead, sortRows } from "@/lib/standings-sort";

import type { RatingMatchRow } from "./engine";

/**
 * Playoff round -> [winnerPlace, loserPlace]. Only these six rounds resolve
 * an exact tournament place; "1/8"/"1/4"/"1/2" are feeder stages that don't
 * decide a place on their own - see docs/RATING.md's Set Club section.
 */
const PLACEMENT_ROUND_RANKS: Record<string, [number, number]> = {
  [FINAL_ROUND]: [1, 2],
  "За 3 місце": [3, 4],
  "За 5 місце": [5, 6],
  "За 7 місце": [7, 8],
  "За 9 місце": [9, 10],
  "За 11 місце": [11, 12],
};

export type SetClubPointsRow = { playerId: string; points: number; tournamentsPlayed: number };

function teamKey(playerIds: [string, string]): string {
  return [...playerIds].sort().join("+");
}

type TeamInfo = { playerIds: [string, string]; seeded: [boolean, boolean] };

/** Points for finishing `place` out of `totalTeams` - clamped at 0 in case a mislabeled placement round would otherwise go negative. */
function placePoints(place: number, totalTeams: number): number {
  return Math.max(0, 2 * (totalTeams - place + 1));
}

function emptyStandingsRow(key: string): StandingsRow {
  return { key, label: key, matchesPlayed: 0, wins: 0, losses: 0, winPct: 0, gamesWon: 0, gamesLost: 0 };
}

/** Awards this one tournament's points to its players, keyed by playerId. */
function computeTournamentPoints(rows: RatingMatchRow[]): Map<string, number> {
  const teams = new Map<string, TeamInfo>();
  const standingsRows = new Map<string, StandingsRow>();
  const h2h: HeadToHead = new Map();
  const placementMatches: { round: string; winnerKey: string; loserKey: string }[] = [];

  for (const row of rows) {
    const sideA = row.players.filter((p) => p.side === "A");
    const sideB = row.players.filter((p) => p.side === "B");
    if (sideA.length !== 2 || sideB.length !== 2) continue;

    const keyA = teamKey([sideA[0].playerId, sideA[1].playerId]);
    const keyB = teamKey([sideB[0].playerId, sideB[1].playerId]);
    if (!teams.has(keyA)) {
      teams.set(keyA, {
        playerIds: [sideA[0].playerId, sideA[1].playerId],
        seeded: [sideA[0].seeded, sideA[1].seeded],
      });
    }
    if (!teams.has(keyB)) {
      teams.set(keyB, {
        playerIds: [sideB[0].playerId, sideB[1].playerId],
        seeded: [sideB[0].seeded, sideB[1].seeded],
      });
    }

    const rowA = standingsRows.get(keyA) ?? emptyStandingsRow(keyA);
    const rowB = standingsRows.get(keyB) ?? emptyStandingsRow(keyB);
    for (const set of row.sets) {
      rowA.gamesWon += set.sideAGames;
      rowA.gamesLost += set.sideBGames;
      rowB.gamesWon += set.sideBGames;
      rowB.gamesLost += set.sideAGames;
    }
    rowA.matchesPlayed += 1;
    rowB.matchesPlayed += 1;
    if (row.winnerSide === "A") {
      rowA.wins += 1;
      rowB.losses += 1;
      recordHeadToHead(h2h, keyA, keyB);
    } else {
      rowB.wins += 1;
      rowA.losses += 1;
      recordHeadToHead(h2h, keyB, keyA);
    }
    standingsRows.set(keyA, rowA);
    standingsRows.set(keyB, rowB);

    if (row.round && row.round in PLACEMENT_ROUND_RANKS) {
      const winnerKey = row.winnerSide === "A" ? keyA : keyB;
      const loserKey = row.winnerSide === "A" ? keyB : keyA;
      placementMatches.push({ round: row.round, winnerKey, loserKey });
    }
  }

  const totalTeams = teams.size;
  if (totalTeams === 0) return new Map();

  const placeByTeam = new Map<string, number>();
  for (const { round, winnerKey, loserKey } of placementMatches) {
    const [winnerPlace, loserPlace] = PLACEMENT_ROUND_RANKS[round];
    placeByTeam.set(winnerKey, winnerPlace);
    placeByTeam.set(loserKey, loserPlace);
  }

  // Fill whichever places 1..totalTeams the playoff didn't decide, in
  // round-robin order - handles gaps (e.g. Фінал+За 3 decided but no За 5)
  // without assuming the decided places form a contiguous block.
  const usedPlaces = new Set([...placeByTeam.values()].filter((p) => p >= 1 && p <= totalTeams));
  const remainingPlaces = Array.from({ length: totalTeams }, (_, i) => i + 1).filter(
    (p) => !usedPlaces.has(p),
  );
  const remainingRows = [...teams.keys()]
    .filter((key) => !placeByTeam.has(key))
    .map((key) => standingsRows.get(key)!);
  sortRows(remainingRows, h2h).forEach((row, i) => {
    const place = remainingPlaces[i];
    if (place !== undefined) placeByTeam.set(row.key, place);
  });

  const pointsByPlayer = new Map<string, number>();
  for (const [key, team] of teams) {
    const place = placeByTeam.get(key);
    if (place === undefined) continue;
    const teamPoints = placePoints(place, totalTeams);
    const [playerA, playerB] = team.playerIds;
    const [seededA, seededB] = team.seeded;
    // Exactly one seeded partner is the only case with a real signal about
    // who's presumed stronger; both-seeded/both-unseeded gets full points
    // for both (no discount without a signal to justify one).
    const shareA = seededA && !seededB ? 1 : !seededA && seededB ? 0.5 : 1;
    const shareB = !seededA && seededB ? 1 : seededA && !seededB ? 0.5 : 1;
    pointsByPlayer.set(playerA, (pointsByPlayer.get(playerA) ?? 0) + teamPoints * shareA);
    pointsByPlayer.set(playerB, (pointsByPlayer.get(playerB) ?? 0) + teamPoints * shareB);
  }
  return pointsByPlayer;
}

/**
 * Set Club doubles points: a per-tournament placement ladder (2 × (N-place+1)
 * points, seeded partner full / unseeded partner half), summed across every
 * tournament in `rows` - callers pre-filter `rows` to one season, so this
 * function's "everything passed in" naturally becomes "one season's total".
 * See docs/RATING.md's Set Club section for the full algorithm writeup.
 */
export function computeDoublesSetClubPoints(rows: RatingMatchRow[]): Map<string, SetClubPointsRow> {
  const byTournament = new Map<string, RatingMatchRow[]>();
  for (const row of rows) {
    const list = byTournament.get(row.tournamentId);
    if (list) list.push(row);
    else byTournament.set(row.tournamentId, [row]);
  }

  const result = new Map<string, SetClubPointsRow>();
  for (const tournamentRows of byTournament.values()) {
    for (const [playerId, points] of computeTournamentPoints(tournamentRows)) {
      const existing = result.get(playerId);
      if (existing) {
        existing.points += points;
        existing.tournamentsPlayed += 1;
      } else {
        result.set(playerId, { playerId, points, tournamentsPlayed: 1 });
      }
    }
  }
  return result;
}
