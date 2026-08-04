import type { HeadToHead, StandingsRow } from "@/lib/standings-sort";
import { recordHeadToHead } from "@/lib/standings-sort";

import type { RatingMatchRow } from "./engine";
import type { PlayoffResult, SetClubPointsRow } from "./placement";
import { PLACEMENT_ROUND_RANKS, resolvePlacements } from "./placement";

/** Base points for finishing places 1-7; every place beyond that is a flat 1. */
const PLACE_POINTS = [10, 8, 6, 5, 4, 3, 2];

function basePlacePoints(place: number): number {
  return PLACE_POINTS[place - 1] ?? 1;
}

/** Bigger fields are worth more, but not so much more that one big tournament dominates the season. */
function fieldSizeBonus(participantCount: number): number {
  if (participantCount >= 12) return 2;
  if (participantCount >= 10) return 1;
  return 0;
}

function emptyStandingsRow(key: string): StandingsRow {
  return { key, label: key, matchesPlayed: 0, wins: 0, losses: 0, winPct: 0, gamesWon: 0, gamesLost: 0 };
}

/** Awards this one tournament's points to its players, keyed by playerId. */
function computeTournamentPoints(rows: RatingMatchRow[]): Map<string, number> {
  const players = new Set<string>();
  const standingsRows = new Map<string, StandingsRow>();
  const h2h: HeadToHead = new Map();
  const playoffResults: PlayoffResult[] = [];
  let participantCount = 0;

  for (const row of rows) {
    const sideA = row.players.find((p) => p.side === "A");
    const sideB = row.players.find((p) => p.side === "B");
    if (!sideA || !sideB) continue;
    participantCount = row.tournamentParticipantCount;

    players.add(sideA.playerId);
    players.add(sideB.playerId);

    const rowA = standingsRows.get(sideA.playerId) ?? emptyStandingsRow(sideA.playerId);
    const rowB = standingsRows.get(sideB.playerId) ?? emptyStandingsRow(sideB.playerId);
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
      recordHeadToHead(h2h, sideA.playerId, sideB.playerId);
    } else {
      rowB.wins += 1;
      rowA.losses += 1;
      recordHeadToHead(h2h, sideB.playerId, sideA.playerId);
    }
    standingsRows.set(sideA.playerId, rowA);
    standingsRows.set(sideB.playerId, rowB);

    if (row.round && row.round in PLACEMENT_ROUND_RANKS) {
      const winnerKey = row.winnerSide === "A" ? sideA.playerId : sideB.playerId;
      const loserKey = row.winnerSide === "A" ? sideB.playerId : sideA.playerId;
      playoffResults.push({ round: row.round, winnerKey, loserKey });
    }
  }

  if (players.size === 0) return new Map();

  const placeByPlayer = resolvePlacements([...players], standingsRows, h2h, playoffResults);
  const bonus = fieldSizeBonus(participantCount);

  const pointsByPlayer = new Map<string, number>();
  for (const [playerId, place] of placeByPlayer) {
    pointsByPlayer.set(playerId, basePlacePoints(place) + bonus);
  }
  return pointsByPlayer;
}

/**
 * Set Club singles points: a fixed per-place points table (10/8/6/5/4/3/2,
 * flat 1 beyond 7th) plus a bonus for the tournament's registered field size
 * (+1 at 10-11 participants, +2 at 12+), awarded to every player and summed
 * across every tournament in `rows` - callers pre-filter `rows` to one
 * season. See docs/RATING.md's Set Club section for the full algorithm.
 */
export function computeSinglesSetClubPoints(rows: RatingMatchRow[]): Map<string, SetClubPointsRow> {
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
