import { prisma } from "@/lib/db";
import type { HeadToHead, StandingsRow } from "@/lib/standings-sort";
import { isRoundRobinComplete, recordHeadToHead, sortRows } from "@/lib/standings-sort";
import { getTournamentStandings } from "@/lib/stats";
import type { TournamentFormat } from "@/lib/validation/tournament";

export type { StandingsRow };

async function getIndividualRows(
  tournamentId: string,
  participants: { playerId: string; player: { id: string; name: string } }[],
): Promise<{ rows: StandingsRow[]; h2h: HeadToHead }> {
  const [standings, matches] = await Promise.all([
    getTournamentStandings(tournamentId),
    prisma.match.findMany({
      where: { tournamentId, status: "COMPLETED", winnerSide: { not: null } },
      select: { winnerSide: true, players: { select: { side: true, playerId: true } } },
    }),
  ]);

  const h2h: HeadToHead = new Map();
  for (const match of matches) {
    const winners = match.players.filter((p) => p.side === match.winnerSide);
    const losers = match.players.filter((p) => p.side !== match.winnerSide);
    for (const winner of winners) {
      for (const loser of losers) {
        recordHeadToHead(h2h, winner.playerId, loser.playerId);
      }
    }
  }

  const rows = participants.map((entry) => {
    const s = standings.get(entry.playerId);
    return {
      key: entry.playerId,
      label: entry.player.name,
      href: `/players/${entry.playerId}`,
      matchesPlayed: s?.matchesPlayed ?? 0,
      wins: s?.wins ?? 0,
      losses: s?.losses ?? 0,
      winPct: s?.winPct ?? 0,
      gamesWon: s?.gamesWon ?? 0,
      gamesLost: s?.gamesLost ?? 0,
    };
  });
  return { rows, h2h };
}

/**
 * Doubles standings grouped by the exact pair of players who played each side
 * together. Teams show up as soon as they have a scheduled match (0-0), not
 * only once they've completed one - otherwise a freshly-drawn bracket with
 * no scores entered yet looks like an empty roster.
 */
async function getTeamRows(tournamentId: string): Promise<{ rows: StandingsRow[]; h2h: HeadToHead }> {
  const matches = await prisma.match.findMany({
    where: { tournamentId, matchType: "DOUBLES", status: { not: "CANCELLED" } },
    select: {
      status: true,
      winnerSide: true,
      players: { select: { side: true, playerId: true, player: { select: { name: true } } } },
      sets: { select: { sideAGames: true, sideBGames: true } },
    },
  });

  const teams = new Map<
    string,
    { label: string; wins: number; losses: number; gamesWon: number; gamesLost: number }
  >();
  const h2h: HeadToHead = new Map();

  for (const match of matches) {
    const teamKeyBySide: Partial<Record<"A" | "B", string>> = {};

    for (const side of ["A", "B"] as const) {
      const sidePlayers = match.players
        .filter((p) => p.side === side)
        .sort((a, b) => a.playerId.localeCompare(b.playerId));
      if (sidePlayers.length === 0) continue;

      const key = sidePlayers.map((p) => p.playerId).join("+");
      teamKeyBySide[side] = key;
      const entry = teams.get(key) ?? {
        label: sidePlayers.map((p) => p.player.name).join(" / "),
        wins: 0,
        losses: 0,
        gamesWon: 0,
        gamesLost: 0,
      };
      if (match.status === "COMPLETED" && match.winnerSide) {
        if (match.winnerSide === side) entry.wins += 1;
        else entry.losses += 1;
      }
      for (const set of match.sets) {
        if (side === "A") {
          entry.gamesWon += set.sideAGames;
          entry.gamesLost += set.sideBGames;
        } else {
          entry.gamesWon += set.sideBGames;
          entry.gamesLost += set.sideAGames;
        }
      }
      teams.set(key, entry);
    }

    if (match.status === "COMPLETED" && match.winnerSide) {
      const winnerKey = teamKeyBySide[match.winnerSide];
      const loserKey = teamKeyBySide[match.winnerSide === "A" ? "B" : "A"];
      if (winnerKey && loserKey) recordHeadToHead(h2h, winnerKey, loserKey);
    }
  }

  const rows = Array.from(teams.entries()).map(([key, team]) => {
    const matchesPlayed = team.wins + team.losses;
    return {
      key,
      label: team.label,
      matchesPlayed,
      wins: team.wins,
      losses: team.losses,
      winPct: matchesPlayed > 0 ? Math.round((team.wins / matchesPlayed) * 100) : 0,
      gamesWon: team.gamesWon,
      gamesLost: team.gamesLost,
    };
  });
  return { rows, h2h };
}

export type TournamentStandingsResult =
  | { grouped: false; rows: StandingsRow[]; roundRobinDone: boolean }
  | {
      grouped: true;
      seededRows: StandingsRow[];
      unseededRows: StandingsRow[];
      seededRoundRobinDone: boolean;
      unseededRoundRobinDone: boolean;
    };

/**
 * DOUBLES tournaments are ranked by team (the pair that played together), since an
 * individual player's win/loss record there depends entirely on their rotating
 * partner. SINGLES and MIXED tournaments rank individual players - split into a
 * seeded ("Gold") and unseeded ("Silver") bracket when the roster actually has
 * seeded participants, matching the singles randomizer's seeded-split matches.
 */
export async function getTournamentStandingsRows(
  tournamentId: string,
  format: TournamentFormat,
  participants: { playerId: string; seed: number | null; player: { id: string; name: string } }[],
): Promise<TournamentStandingsResult> {
  if (format === "DOUBLES") {
    const { rows, h2h } = await getTeamRows(tournamentId);
    return { grouped: false, rows: sortRows(rows, h2h), roundRobinDone: isRoundRobinComplete(rows, h2h) };
  }

  const { rows, h2h } = await getIndividualRows(tournamentId, participants);
  const seededIds = new Set(participants.filter((p) => p.seed !== null).map((p) => p.playerId));
  if (seededIds.size === 0) {
    return { grouped: false, rows: sortRows(rows, h2h), roundRobinDone: isRoundRobinComplete(rows, h2h) };
  }

  const seededRows = rows.filter((r) => seededIds.has(r.key));
  const unseededRows = rows.filter((r) => !seededIds.has(r.key));
  return {
    grouped: true,
    seededRows: sortRows(seededRows, h2h),
    unseededRows: sortRows(unseededRows, h2h),
    seededRoundRobinDone: isRoundRobinComplete(seededRows, h2h),
    unseededRoundRobinDone: isRoundRobinComplete(unseededRows, h2h),
  };
}
