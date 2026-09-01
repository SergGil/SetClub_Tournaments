import { NextResponse } from "next/server";

import { deletePadelTournamentCore, updatePadelTournamentCore } from "@/lib/actions/padel-tournaments";
import { withApiErrorHandling } from "@/lib/api-auth";
import { requireDomainAdmin } from "@/lib/permissions";
import { getPadelTournamentById } from "@/lib/queries/padel-tournaments";
import { padelTournamentFormSchema } from "@/lib/validation/padel-tournament";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

type Params = { params: Promise<{ id: string }> };

export const GET = withApiErrorHandling(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const tournament = await getPadelTournamentById(id);
  if (!tournament) return NextResponse.json({ error: "Турнір не знайдено" }, { status: 404 });
  return NextResponse.json({ tournament });
});

export const PATCH = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const session = await requireDomainAdmin("PADEL", request);

  const parsed = padelTournamentFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некоректні дані", fieldErrors: fieldErrorsFromZod(parsed.error) },
      { status: 400 },
    );
  }

  const result = await updatePadelTournamentCore(session, id, parsed.data);
  if (result.error) {
    return NextResponse.json({ error: result.error, fieldErrors: result.fieldErrors }, { status: 400 });
  }
  return NextResponse.json({ success: true });
});

export const DELETE = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const session = await requireDomainAdmin("PADEL", request);

  const { searchParams } = new URL(request.url);
  const acknowledgedCompletedLoss = searchParams.get("acknowledgedCompletedLoss") === "true";

  const result = await deletePadelTournamentCore(session, id, acknowledgedCompletedLoss);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});
