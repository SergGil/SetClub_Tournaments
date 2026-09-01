import { NextResponse } from "next/server";

import { deletePlayerCore, updatePlayerCore } from "@/lib/actions/players";
import { withApiErrorHandling } from "@/lib/api-auth";
import { requireDomainsAdmin } from "@/lib/permissions";
import { getPlayerById } from "@/lib/queries/players";
import { playerFormSchema } from "@/lib/validation/player";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

type Params = { params: Promise<{ id: string }> };

export const GET = withApiErrorHandling(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const player = await getPlayerById(id);
  if (!player) return NextResponse.json({ error: "Гравця не знайдено" }, { status: 404 });
  return NextResponse.json({ player });
});

export const PATCH = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const session = await requireDomainsAdmin(["TENNIS", "PADEL"], request);

  const parsed = playerFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некоректні дані", fieldErrors: fieldErrorsFromZod(parsed.error) },
      { status: 400 },
    );
  }

  const result = await updatePlayerCore(session, id, parsed.data);
  if (result.error) return NextResponse.json({ error: result.error, fieldErrors: result.fieldErrors }, { status: 400 });
  return NextResponse.json({ success: true });
});

export const DELETE = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const session = await requireDomainsAdmin(["TENNIS", "PADEL"], request);

  const result = await deletePlayerCore(session, id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});
