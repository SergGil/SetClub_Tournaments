import { csvResponse } from "@/lib/export/csv-response";
import { buildMatchesCsv } from "@/lib/export/matches-csv";
import { displayName } from "@/lib/player-display";
import { isAdmin } from "@/lib/permissions";
import { getAllMatches } from "@/lib/queries/matches";

export async function GET() {
  if (!(await isAdmin())) {
    return new Response("Forbidden", { status: 403 });
  }

  const matches = await getAllMatches();
  const csv = buildMatchesCsv(
    matches.map((m) => ({
      tournamentName: m.tournament.name,
      matchType: m.matchType,
      round: m.round,
      scheduledDate: m.scheduledDate,
      status: m.status,
      winnerSide: m.winnerSide,
      retired: m.retired,
      // displayName (nickname if set, else the real name) - same fallback
      // used almost everywhere a player name is shown (see
      // src/lib/player-display.ts) - this export used to bypass it.
      players: m.players.map((p) => ({ side: p.side, name: displayName(p.player) })),
      sets: m.sets.map((s) => ({
        sideAGames: s.sideAGames,
        sideBGames: s.sideBGames,
        tiebreakSideAPoints: s.tiebreakSideAPoints,
        tiebreakSideBPoints: s.tiebreakSideBPoints,
      })),
    })),
  );

  return csvResponse(csv, `matchi-${new Date().toISOString().slice(0, 10)}.csv`);
}
