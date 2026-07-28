import { csvResponse } from "@/lib/export/csv-response";
import { buildParticipantsCsv } from "@/lib/export/participants-csv";
import { isAdmin } from "@/lib/permissions";
import { getAllTournamentParticipants } from "@/lib/queries/tournaments";

export async function GET() {
  if (!(await isAdmin())) {
    return new Response("Forbidden", { status: 403 });
  }

  const participants = await getAllTournamentParticipants();
  const csv = buildParticipantsCsv(
    participants.map((p) => ({
      tournamentName: p.tournament.name,
      playerName: p.player.name,
      seeded: p.seed !== null,
      joinedAt: p.joinedAt,
    })),
  );

  return csvResponse(csv, `uchasnyky-${new Date().toISOString().slice(0, 10)}.csv`);
}
