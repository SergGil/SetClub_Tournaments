import { csvResponse } from "@/lib/export/csv-response";
import { buildParticipantsCsv } from "@/lib/export/participants-csv";
import { displayName } from "@/lib/player-display";
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
      // displayName (nickname if set, else the real name) - see the same
      // fix in the matches export route.
      playerName: displayName(p.player),
      seeded: p.seed !== null,
      joinedAt: p.joinedAt,
    })),
  );

  return csvResponse(csv, `uchasnyky-${new Date().toISOString().slice(0, 10)}.csv`);
}
