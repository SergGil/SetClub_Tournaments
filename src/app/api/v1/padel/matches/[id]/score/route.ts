import { NextResponse } from "next/server";

import { savePadelScoreCore } from "@/lib/actions/padel-matches";
import { withApiErrorHandling } from "@/lib/api-auth";
import { requireDomainAdmin } from "@/lib/permissions";
import { scoreFormSchema } from "@/lib/validation/match";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

type Params = { params: Promise<{ id: string }> };

export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const session = await requireDomainAdmin("PADEL", request);

  const body = await request.json().catch(() => null);
  const parsed = scoreFormSchema.safeParse({ ...body, matchId: id });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некоректний рахунок", fieldErrors: fieldErrorsFromZod(parsed.error) },
      { status: 400 },
    );
  }

  const acknowledgedCascadeReset = body?.acknowledgedCascadeReset === true;
  const result = await savePadelScoreCore(session, parsed.data, acknowledgedCascadeReset);
  if (result.error) {
    return NextResponse.json({ error: result.error, cascadeResets: result.cascadeResets }, { status: 400 });
  }
  return NextResponse.json({ success: true });
});
