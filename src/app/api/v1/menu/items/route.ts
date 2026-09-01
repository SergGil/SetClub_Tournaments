import { NextResponse } from "next/server";

import { createMenuItemCore } from "@/lib/actions/menu";
import { withApiErrorHandling } from "@/lib/api-auth";
import { requireDomainAdmin } from "@/lib/permissions";
import { menuItemFormSchema } from "@/lib/validation/menu";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

/** Body: `{ sectionId, name, price, description?, sortOrder?, photoKey? }` - `photoKey` must start with "menu/" (uploaded beforehand via POST /api/menu/photo-presign). */
export const POST = withApiErrorHandling(async (request: Request) => {
  const session = await requireDomainAdmin("COFFEE", request);

  const body = await request.json().catch(() => null);
  const parsed = menuItemFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некоректні дані", fieldErrors: fieldErrorsFromZod(parsed.error) },
      { status: 400 },
    );
  }

  const photoKey = typeof body?.photoKey === "string" ? body.photoKey : null;
  if (photoKey && !photoKey.startsWith("menu/")) {
    return NextResponse.json({ error: "Некоректний ключ фото" }, { status: 400 });
  }

  const result = await createMenuItemCore(session, parsed.data, photoKey);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 201 });
});
