import { prisma } from "@/lib/db";
import { getTournamentStandings } from "@/lib/stats";
import type { TournamentFormat } from "@/lib/validation/tournament";

export type StandingsRow = {
  key: string;
  label: string;
  href?: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winPct: number;
};

function sortRows(rows: StandingsRow[]): StandingsRow[] {
  return [...rows].sort(
    (a, b) => b.wins - a.wins || b.winPct - a.winPct || a.label.localeCompare(b.label),
  );
}

async function getIndividualRows(
  tournamentId: string,
  participants: { playerId: string; player: { id: string; name: string } }[],
): Promise<StandingsRow[]> {
  const standings = await getTournamentStandings(tournamentId);
  return participants.map((entry) => {
    const s = standings.get(entry.playerId);
    return {
      key: entry.playerId,
      label: entry.player.name,
      href: `/players/${entry.playerId}`,
      matchesPlayed: s?.matchesPlayed ?? 0,
      wins: s?.wins ?? 0,
      losses: s?.losses ?? 0,
      winPct: s?.winPct ?? 0,
    };
  });
}

/**
 * Doubles standings grouped by the exact pair of players who played each side
 * together. Teams show up as soon as they have a scheduled match (0-0), not
 * only once they've completed one - otherwise a freshly-drawn bracket with
 * no scores entered yet looks like an empty roster.
 */
async function getTeamRows(tournamentId: string): Promise<StandingsRow[]> {
  const matches = await prisma.match.findMany({
    where: { tournamentId, matchType: "DOUBLES", status: { not: "CANCELLED" } },
    select: {
      status: true,
      winnerSide: true,
      players: { select: { side: true, playerId: true, player: { select: { name: true } } } },
    },
  });

  const teams = new Map<string, { label: string; wins: number; losses: number }>();

  for (const match of matches) {
    for (const side of ["A", "B"] as const) {
      const sidePlayers = match.players
        .filter((p) => p.side === side)
        .sort((a, b) => a.playerId.localeCompare(b.playerId));
      if (sidePlayers.length === 0) continue;

      const key = sidePlayers.map((p) => p.playerId).join("+");
      const entry = teams.get(key) ?? {
        label: sidePlayers.map((p) => p.player.name).join(" / "),
        wins: 0,
        losses: 0,
      };
      if (match.status === "COMPLETED" && match.winnerSide) {
        if (match.winnerSide === side) entry.wins += 1;
        else entry.losses += 1;
      }
      teams.set(key, entry);
    }
  }

  return Array.from(teams.entries()).map(([key, team]) => {
    const matchesPlayed = team.wins + team.losses;
    return {
      key,
      label: team.label,
      matchesPlayed,
      wins: team.wins,
      losses: team.losses,
      winPct: matchesPlayed > 0 ? Math.round((team.wins / matchesPlayed) * 100) : 0,
    };
  });
}

/**
 * DOUBLES tournaments are ranked by team (the pair that played together), since an
 * individual player's win/loss record there depends entirely on their rotating
 * partner. SINGLES and MIXED tournaments rank individual players.
 */
export async function getTournamentStandingsRows(
  tournamentId: string,
  format: TournamentFormat,
  participants: { playerId: string; player: { id: string; name: string } }[],
): Promise<StandingsRow[]> {
  const rows =
    format === "DOUBLES"
      ? await getTeamRows(tournamentId)
      : await getIndividualRows(tournamentId, participants);
  return sortRows(rows);
}
