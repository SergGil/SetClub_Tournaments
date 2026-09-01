import { NextResponse } from "next/server";

import { deleteMenuSectionCore, updateMenuSectionCore } from "@/lib/actions/menu";
import { withApiErrorHandling } from "@/lib/api-auth";
import { requireDomainAdmin } from "@/lib/permissions";
import { getMenuSectionById } from "@/lib/queries/menu";
import { menuSectionFormSchema } from "@/lib/validation/menu";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

type Params = { params: Promise<{ id: string }> };

export const GET = withApiErrorHandling(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const section = await getMenuSectionById(id);
  if (!section) return NextResponse.json({ error: "Секцію не знайдено" }, { status: 404 });
  return NextResponse.json({ section });
});

export const PATCH = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const session = await requireDomainAdmin("COFFEE", request);

  const parsed = menuSectionFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некоректні дані", fieldErrors: fieldErrorsFromZod(parsed.error) },
      { status: 400 },
    );
  }

  const result = await updateMenuSectionCore(session, id, parsed.data);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});

export const DELETE = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const session = await requireDomainAdmin("COFFEE", request);

  const result = await deleteMenuSectionCore(session, id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});
