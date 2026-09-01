import { NextResponse } from "next/server";

import { deleteTournamentCore, updateTournamentCore } from "@/lib/actions/tournaments";
import { withApiErrorHandling } from "@/lib/api-auth";
import { requireDomainAdmin } from "@/lib/permissions";
import { getTournamentById } from "@/lib/queries/tournaments";
import { tournamentFormSchema } from "@/lib/validation/tournament";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

type Params = { params: Promise<{ id: string }> };

export const GET = withApiErrorHandling(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const tournament = await getTournamentById(id);
  if (!tournament) return NextResponse.json({ error: "Турнір не знайдено" }, { status: 404 });
  return NextResponse.json({ tournament });
});

export const PATCH = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const session = await requireDomainAdmin("TENNIS", request);

  const parsed = tournamentFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некоректні дані", fieldErrors: fieldErrorsFromZod(parsed.error) },
      { status: 400 },
    );
  }

  const result = await updateTournamentCore(session, id, parsed.data);
  if (result.error) {
    return NextResponse.json({ error: result.error, fieldErrors: result.fieldErrors }, { status: 400 });
  }
  return NextResponse.json({ success: true });
});

export const DELETE = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const session = await requireDomainAdmin("TENNIS", request);

  const { searchParams } = new URL(request.url);
  const acknowledgedCompletedLoss = searchParams.get("acknowledgedCompletedLoss") === "true";

  const result = await deleteTournamentCore(session, id, acknowledgedCompletedLoss);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});
