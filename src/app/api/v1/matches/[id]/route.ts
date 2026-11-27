import { NextResponse } from "next/server";

import { deleteMatchCore, updateMatchCore } from "@/lib/actions/matches-core";
import { withApiErrorHandling } from "@/lib/api-auth";
import { readJsonBody } from "@/lib/api-body";
import { requireDomainAdmin } from "@/lib/permissions";
import { getMatchById } from "@/lib/queries/matches";
import { matchFormSchema } from "@/lib/validation/match";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

type Params = { params: Promise<{ id: string }> };

export const GET = withApiErrorHandling(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const match = await getMatchById(id);
  if (!match) return NextResponse.json({ error: "Матч не знайдено" }, { status: 404 });
  return NextResponse.json({ match });
});

export const PATCH = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const session = await requireDomainAdmin("TENNIS", request);

  const body = await readJsonBody(request);
  const parsed = matchFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некоректні дані", fieldErrors: fieldErrorsFromZod(parsed.error) },
      { status: 400 },
    );
  }

  // Read from the raw body, beside matchFormSchema - same as the score route.
  const acknowledgedCascadeReset = body.acknowledgedCascadeReset === true;
  const result = await updateMatchCore(session, id, parsed.data, acknowledgedCascadeReset);
  if (result.error) {
    return NextResponse.json({ error: result.error, cascadeResets: result.cascadeResets }, { status: 400 });
  }
  return NextResponse.json({ success: true, notice: result.notice });
});

export const DELETE = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const session = await requireDomainAdmin("TENNIS", request);

  const { searchParams } = new URL(request.url);
  const acknowledgedCascadeReset = searchParams.get("acknowledgedCascadeReset") === "true";

  const result = await deleteMatchCore(session, id, acknowledgedCascadeReset);
  if (result.error) {
    return NextResponse.json({ error: result.error, cascadeResets: result.cascadeResets }, { status: 400 });
  }
  return NextResponse.json({ success: true });
});
