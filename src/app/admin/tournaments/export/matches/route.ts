import { csvResponse } from "@/lib/export/csv-response";
import { buildMatchesCsv } from "@/lib/export/matches-csv";
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
      players: m.players.map((p) => ({ side: p.side, name: p.player.name })),
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
