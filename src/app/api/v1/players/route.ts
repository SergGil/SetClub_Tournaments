import { NextResponse } from "next/server";

import { createPlayerCore } from "@/lib/actions/players-core";
import { withApiErrorHandling } from "@/lib/api-auth";
import { isDomainsAdmin, requireDomainsAdmin } from "@/lib/permissions";
import { getPlayers, getPlayersPage, redactPlayerEmails } from "@/lib/queries/players";
import { playerFormSchema } from "@/lib/validation/player";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

/**
 * Public read, but emails (the player's own and the linked Google account's) are only included
 * for a signed-in tennis/padel admin - the mobile admin screens need them, nobody else should
 * be able to harvest them. The `q` search also only matches emails for admins.
 */
export const GET = withApiErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const canSeeEmails = await isDomainsAdmin(["TENNIS", "PADEL"], request);
  const present = <T extends { email: string | null; user: { email: string | null } | null }>(players: T[]) =>
    canSeeEmails ? players : players.map(redactPlayerEmails);

  if (!searchParams.has("limit") && !searchParams.has("q")) {
    return NextResponse.json({ players: present(await getPlayers()) });
  }

  const limit = Math.min(Number(searchParams.get("limit") ?? 20) || 20, 100);
  const query = searchParams.get("q") ?? undefined;
  const { players, total } = await getPlayersPage(limit, query, undefined, { searchEmails: canSeeEmails });
  return NextResponse.json({ players: present(players), total });
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
