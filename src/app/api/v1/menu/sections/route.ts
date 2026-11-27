import { NextResponse } from "next/server";

import { createMenuSectionCore } from "@/lib/actions/menu-core";
import { withApiErrorHandling } from "@/lib/api-auth";
import { readJsonBody } from "@/lib/api-body";
import { requireDomainAdmin } from "@/lib/permissions";
import { menuSectionFormSchema } from "@/lib/validation/menu";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

export const POST = withApiErrorHandling(async (request: Request) => {
  const session = await requireDomainAdmin("COFFEE", request);

  const body = await readJsonBody(request);
  const parsed = menuSectionFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некоректні дані", fieldErrors: fieldErrorsFromZod(parsed.error) },
      { status: 400 },
    );
  }

  const result = await createMenuSectionCore(session, parsed.data);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 201 });
});
