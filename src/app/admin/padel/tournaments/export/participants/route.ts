import { csvResponse } from "@/lib/export/csv-response";
import { buildParticipantsCsv } from "@/lib/export/participants-csv";
import { displayName } from "@/lib/player-display";
import { isDomainAdmin } from "@/lib/permissions";
import { getAllPadelTournamentParticipants } from "@/lib/queries/padel-tournaments";

export async function GET() {
  if (!(await isDomainAdmin("PADEL"))) {
    return new Response("Forbidden", { status: 403 });
  }

  const participants = await getAllPadelTournamentParticipants();
  const csv = buildParticipantsCsv(
    participants.map((p) => ({
      tournamentName: p.tournament.name,
      playerName: displayName(p.player),
      seeded: p.seed !== null,
      joinedAt: p.joinedAt,
    })),
  );

  return csvResponse(csv, `padel-uchasnyky-${new Date().toISOString().slice(0, 10)}.csv`);
}
