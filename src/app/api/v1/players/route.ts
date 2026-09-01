import { NextResponse } from "next/server";

import { createPlayerCore } from "@/lib/actions/players";
import { withApiErrorHandling } from "@/lib/api-auth";
import { requireDomainsAdmin } from "@/lib/permissions";
import { getPlayers, getPlayersPage } from "@/lib/queries/players";
import { playerFormSchema } from "@/lib/validation/player";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

export const GET = withApiErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  if (!searchParams.has("limit") && !searchParams.has("q")) {
    return NextResponse.json({ players: await getPlayers() });
  }

  const limit = Math.min(Number(searchParams.get("limit") ?? 20) || 20, 100);
  const query = searchParams.get("q") ?? undefined;
  const { players, total } = await getPlayersPage(limit, query);
  return NextResponse.json({ players, total });
});

export const POST = withApiErrorHandling(async (request: Request) => {
  const session = await requireDomainsAdmin(["TENNIS", "PADEL"], request);

  const body = await request.json().catch(() => null);
  const parsed = playerFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некоректні дані", fieldErrors: fieldErrorsFromZod(parsed.error) },
      { status: 400 },
    );
  }

  const result = await createPlayerCore(session, parsed.data);
  if (result.error) return NextResponse.json({ error: result.error, fieldErrors: result.fieldErrors }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 201 });
});
