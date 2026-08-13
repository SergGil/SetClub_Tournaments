import { csvResponse } from "@/lib/export/csv-response";
import { buildMatchesCsv } from "@/lib/export/matches-csv";
import { displayName } from "@/lib/player-display";
import { isDomainAdmin } from "@/lib/permissions";
import { getAllPadelMatches } from "@/lib/queries/padel-matches";

export async function GET() {
  if (!(await isDomainAdmin("PADEL"))) {
    return new Response("Forbidden", { status: 403 });
  }

  const matches = await getAllPadelMatches();
  const csv = buildMatchesCsv(
    matches.map((m) => ({
      tournamentName: m.tournament.name,
      matchType: m.matchType,
      round: m.round,
      scheduledDate: m.scheduledDate,
      status: m.status,
      winnerSide: m.winnerSide,
      retired: m.retired,
      players: m.players.map((p) => ({ side: p.side, name: displayName(p.player) })),
      sets: m.sets.map((s) => ({
        sideAGames: s.sideAGames,
        sideBGames: s.sideBGames,
        tiebreakSideAPoints: s.tiebreakSideAPoints,
        tiebreakSideBPoints: s.tiebreakSideBPoints,
      })),
    })),
  );

  return csvResponse(csv, `padel-matchi-${new Date().toISOString().slice(0, 10)}.csv`);
}
