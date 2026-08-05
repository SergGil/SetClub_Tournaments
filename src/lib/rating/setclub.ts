import type { HeadToHead, StandingsRow } from "@/lib/standings-sort";
import { recordHeadToHead } from "@/lib/standings-sort";

import type { RatingMatchRow } from "./engine";
import type { PlayoffResult, SetClubPointsRow } from "./placement";
import { PLACEMENT_ROUND_RANKS, resolvePlacements } from "./placement";

export type { SetClubPointsRow };

function teamKey(playerIds: [string, string]): string {
  return [...playerIds].sort().join("+");
}

type TeamInfo = { playerIds: [string, string]; seeded: [boolean, boolean] };

/** Points for finishing `place` out of `totalTeams` - clamped at 0 in case a mislabeled placement round would otherwise go negative. */
function placePoints(place: number, totalTeams: number): number {
  return Math.max(0, 2 * (totalTeams - place + 1));
}

function emptyStandingsRow(key: string): StandingsRow {
  return {
    key,
    label: key,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    winPct: 0,
    gamesWon: 0,
    gamesLost: 0,
    points: 0,
  };
}

/** Awards this one tournament's points to its players, keyed by playerId. */
function computeTournamentPoints(rows: RatingMatchRow[]): Map<string, number> {
  const teams = new Map<string, TeamInfo>();
  const standingsRows = new Map<string, StandingsRow>();
  const h2h: HeadToHead = new Map();
  const playoffResults: PlayoffResult[] = [];

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
      playoffResults.push({ round: row.round, winnerKey, loserKey });
    }
  }

  const totalTeams = teams.size;
  if (totalTeams === 0) return new Map();

  const placeByTeam = resolvePlacements([...teams.keys()], standingsRows, h2h, playoffResults);

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
