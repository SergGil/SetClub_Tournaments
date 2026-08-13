import { csvResponse } from "@/lib/export/csv-response";
import { buildPadelTournamentsCsv } from "@/lib/export/padel-tournaments-csv";
import { isDomainAdmin } from "@/lib/permissions";
import { getPadelTournaments } from "@/lib/queries/padel-tournaments";

export async function GET() {
  if (!(await isDomainAdmin("PADEL"))) {
    return new Response("Forbidden", { status: 403 });
  }

  const tournaments = await getPadelTournaments();
  const csv = buildPadelTournamentsCsv(
    tournaments.map((t) => ({
      name: t.name,
      format: t.format,
      status: t.status,
      startDate: t.startDate,
      endDate: t.endDate,
      participantsCount: t._count.participants,
      matchesCount: t._count.matches,
    })),
  );

  return csvResponse(csv, `padel-turniry-${new Date().toISOString().slice(0, 10)}.csv`);
}
