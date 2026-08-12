import { csvResponse } from "@/lib/export/csv-response";
import { buildTournamentsCsv } from "@/lib/export/tournaments-csv";
import { isDomainAdmin } from "@/lib/permissions";
import { getTournaments } from "@/lib/queries/tournaments";

export async function GET() {
  if (!(await isDomainAdmin("TENNIS"))) {
    return new Response("Forbidden", { status: 403 });
  }

  const tournaments = await getTournaments();
  const csv = buildTournamentsCsv(
    tournaments.map((t) => ({
      name: t.name,
      format: t.format,
      surface: t.surface,
      status: t.status,
      startDate: t.startDate,
      endDate: t.endDate,
      participantsCount: t._count.participants,
      matchesCount: t._count.matches,
    })),
  );

  return csvResponse(csv, `turniry-${new Date().toISOString().slice(0, 10)}.csv`);
}
