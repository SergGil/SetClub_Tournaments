import { NextResponse } from "next/server";

import { deleteMenuItemCore, updateMenuItemCore } from "@/lib/actions/menu";
import { withApiErrorHandling } from "@/lib/api-auth";
import { requireDomainAdmin } from "@/lib/permissions";
import { getMenuItemById } from "@/lib/queries/menu";
import { menuItemFormSchema } from "@/lib/validation/menu";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

type Params = { params: Promise<{ id: string }> };

export const GET = withApiErrorHandling(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const item = await getMenuItemById(id);
  if (!item) return NextResponse.json({ error: "Напій не знайдено" }, { status: 404 });
  return NextResponse.json({ item });
});

/** Body: `{ sectionId, name, price, description?, sortOrder?, photoKey?, removePhoto? }` - see POST /api/v1/menu/items for the photoKey rules. */
export const PATCH = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const session = await requireDomainAdmin("COFFEE", request);

  const body = await request.json().catch(() => null);
  const parsed = menuItemFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некоректні дані", fieldErrors: fieldErrorsFromZod(parsed.error) },
      { status: 400 },
    );
  }

  const newPhotoKey = typeof body?.photoKey === "string" ? body.photoKey : null;
  if (newPhotoKey && !newPhotoKey.startsWith("menu/")) {
    return NextResponse.json({ error: "Некоректний ключ фото" }, { status: 400 });
  }
  const removePhoto = body?.removePhoto === true;

  const result = await updateMenuItemCore(session, id, parsed.data, newPhotoKey, removePhoto);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});

export const DELETE = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const session = await requireDomainAdmin("COFFEE", request);

  const result = await deleteMenuItemCore(session, id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});
