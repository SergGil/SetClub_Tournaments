import type { TournamentStandingsResult } from "@/lib/tournament-standings";

export type TournamentPodiumEntry = { place: 1 | 2 | 3; label: string; wins: number; losses: number };

export type TournamentShareData = {
  tournamentName: string;
  participantCount: number;
  podium: TournamentPodiumEntry[];
};

/**
 * Shapes a tournament's final placement into plain data for the share-card
 * image (see src/lib/share/tournament-card-image.tsx). Mirrors the exact gate
 * PlacedTournamentStandings uses to show its own champion trophy
 * (src/components/tournament-standings.tsx) - only once every row has a
 * decided `place`, never a live/in-progress standing - and reads the same
 * `wins`/`losses` "Очки" record already shown in that table, not the
 * unrelated club-wide SET.club rating points (src/lib/rating/placement.ts).
 *
 * Returns null when the tournament has no placedTable yet, it isn't
 * `complete`, or (shouldn't happen once complete) no row actually landed in
 * the top 3 - nothing meaningful to put on a podium card.
 */
export function buildTournamentShareData(
  tournamentName: string,
  participantCount: number,
  standings: TournamentStandingsResult,
): TournamentShareData | null {
  const placedTable = standings.placedTable;
  if (!placedTable || !placedTable.complete) return null;

  const podium = placedTable.rows
    .filter((row) => row.place === 1 || row.place === 2 || row.place === 3)
    .sort((a, b) => (a.place as number) - (b.place as number))
    .map((row) => ({
      place: row.place as 1 | 2 | 3,
      label: row.label,
      wins: row.wins,
      losses: row.losses,
    }));

  if (podium.length === 0) return null;

  return { tournamentName, participantCount, podium };
}
