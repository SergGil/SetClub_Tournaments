import { NextResponse } from "next/server";

import { buildTournamentsCsv } from "@/lib/export/tournaments-csv";
import { isAdmin } from "@/lib/permissions";
import { getTournaments } from "@/lib/queries/tournaments";

const UTF8_BOM = String.fromCharCode(0xfeff);

export async function GET() {
  if (!(await isAdmin())) {
    return new NextResponse("Forbidden", { status: 403 });
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

  const filename = `turniry-${new Date().toISOString().slice(0, 10)}.csv`;

  // Leading BOM so Excel opens the Cyrillic content as UTF-8 instead of mojibake.
  return new NextResponse(UTF8_BOM + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
