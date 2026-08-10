import { MINI_GROUP_ROUND } from "@/lib/playoff-rounds";
import type { HeadToHead, StandingsRow } from "@/lib/standings-sort";
import { recordHeadToHead, sortRows } from "@/lib/standings-sort";

import type { RatingMatchRow } from "./engine";
import type { PlayoffResult, SetClubPointsRow } from "./placement";
import { fillRemainingPlacements, placePoints, PLACEMENT_ROUND_RANKS, resolveDecisivePlacements } from "./placement";

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

/**
 * Builds a standalone standings/h2h pair scoped to exactly `scopedRows`
 * (e.g. just the 6 "Група за 9-12 місце" matches) - same shape as the
 * whole-tournament accumulation in computeTournamentPoints below, but never
 * mixed with matches outside that scope. Mirrors buildScopedSinglesRows in
 * tournament-standings.ts (used there for the same mini-group, for display).
 */
function buildScopedStandings(scopedRows: RatingMatchRow[]): { rows: StandingsRow[]; h2h: HeadToHead } {
  const standingsRows = new Map<string, StandingsRow>();
  const h2h: HeadToHead = new Map();
  for (const row of scopedRows) {
    const sideA = row.players.find((p) => p.side === "A");
    const sideB = row.players.find((p) => p.side === "B");
    if (!sideA || !sideB) continue;
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
  }
  return { rows: [...standingsRows.values()], h2h };
}

/**
 * Same staged resolution as placement.ts's resolvePlacements (decisive
 * playoff matches first, round-robin fallback for the rest) - EXCEPT for
 * GROUPS_12_PLAYOFF's "Група за 9-12 місце" mini round robin
 * (`miniGroupRows`): those 4 candidates are ranked by their record in JUST
 * those 6 matches, not the whole-tournament `standingsRows`/`h2h` (which
 * would mix in each candidate's group-stage record against players outside
 * the mini group entirely). The flat "1 point for anything below 7th" old
 * table made that mixing harmless; the scaling `placePoints` formula does
 * not - see docs/GROUPS12_PLAYOFF.md.
 */
function resolveSinglesPlacements(
  playerKeys: string[],
  standingsRows: Map<string, StandingsRow>,
  h2h: HeadToHead,
  playoffResults: PlayoffResult[],
  miniGroupRows: RatingMatchRow[],
): Map<string, number> {
  const placeByKey = resolveDecisivePlacements(playoffResults);

  if (miniGroupRows.length > 0) {
    const { rows: miniRows, h2h: miniH2h } = buildScopedStandings(miniGroupRows);
    const startPlace = placeByKey.size + 1;
    sortRows(miniRows, miniH2h)
      .filter((row) => !placeByKey.has(row.key))
      .forEach((row, i) => placeByKey.set(row.key, startPlace + i));
  }

  fillRemainingPlacements(playerKeys, standingsRows, h2h, placeByKey);
  return placeByKey;
}

/** Awards this one tournament's points to its players, keyed by playerId. */
function computeTournamentPoints(rows: RatingMatchRow[]): Map<string, number> {
  const players = new Set<string>();
  const standingsRows = new Map<string, StandingsRow>();
  const h2h: HeadToHead = new Map();
  const playoffResults: PlayoffResult[] = [];
  const miniGroupRows: RatingMatchRow[] = [];
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
    if (row.round === MINI_GROUP_ROUND) {
      miniGroupRows.push(row);
    }
  }

  if (players.size === 0) return new Map();

  const placeByPlayer = resolveSinglesPlacements(
    [...players],
    standingsRows,
    h2h,
    playoffResults,
    miniGroupRows,
  );

  const pointsByPlayer = new Map<string, number>();
  for (const [playerId, place] of placeByPlayer) {
    pointsByPlayer.set(playerId, placePoints(place, participantCount));
  }
  return pointsByPlayer;
}

/**
 * Set Club singles points: the same per-tournament placement ladder as
 * doubles (`2 × (N-place+1)`, N = registered participant count), summed
 * across every tournament in `rows` - callers pre-filter `rows` to one
 * season. GROUPS_12_PLAYOFF's places 9-12 are ranked within their own
 * mini-group, not the whole tournament (see resolveSinglesPlacements).
 * See docs/RATING.md's Set Club section for the full algorithm.
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
