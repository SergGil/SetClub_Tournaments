import { NextResponse } from "next/server";

import { createMenuSectionCore } from "@/lib/actions/menu";
import { withApiErrorHandling } from "@/lib/api-auth";
import { requireDomainAdmin } from "@/lib/permissions";
import { menuSectionFormSchema } from "@/lib/validation/menu";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

export const POST = withApiErrorHandling(async (request: Request) => {
  const session = await requireDomainAdmin("COFFEE", request);

  const body = await request.json().catch(() => null);
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
