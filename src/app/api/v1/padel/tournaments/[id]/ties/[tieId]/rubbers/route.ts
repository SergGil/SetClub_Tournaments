import { NextResponse } from "next/server";

import { createPadelRubberCore } from "@/lib/actions/padel-ties";
import { withApiErrorHandling } from "@/lib/api-auth";
import { requireDomainAdmin } from "@/lib/permissions";
import { rubberFormSchema } from "@/lib/validation/rubber";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

type Params = { params: Promise<{ id: string; tieId: string }> };

export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { tieId } = await params;
  const session = await requireDomainAdmin("PADEL", request);

  const body = await request.json().catch(() => null);
  const parsed = rubberFormSchema.safeParse({ ...body, tieId });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некоректні дані", fieldErrors: fieldErrorsFromZod(parsed.error) },
      { status: 400 },
    );
  }

  const result = await createPadelRubberCore(session, parsed.data);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 201 });
});
