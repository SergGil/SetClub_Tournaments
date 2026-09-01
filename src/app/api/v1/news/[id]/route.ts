import { NextResponse } from "next/server";

import { deleteNewsPostCore, updateNewsPostCore } from "@/lib/actions/news";
import { withApiErrorHandling } from "@/lib/api-auth";
import { requireAnyDomainAdmin } from "@/lib/permissions";
import { getNewsPostById } from "@/lib/queries/news";
import { newsPostFormSchema } from "@/lib/validation/news";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

type Params = { params: Promise<{ id: string }> };

export const GET = withApiErrorHandling(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const post = await getNewsPostById(id);
  if (!post) return NextResponse.json({ error: "Новину не знайдено" }, { status: 404 });
  return NextResponse.json({ post });
});

/** Body: `{ title, body, photoKey?, removePhoto? }` - see POST /api/v1/news for the photoKey rules. */
export const PATCH = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const session = await requireAnyDomainAdmin(request);

  const body = await request.json().catch(() => null);
  const parsed = newsPostFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некоректні дані", fieldErrors: fieldErrorsFromZod(parsed.error) },
      { status: 400 },
    );
  }

  const newPhotoKey = typeof body?.photoKey === "string" ? body.photoKey : null;
  if (newPhotoKey && !newPhotoKey.startsWith("news/")) {
    return NextResponse.json({ error: "Некоректний ключ фото" }, { status: 400 });
  }
  const removePhoto = body?.removePhoto === true;

  const result = await updateNewsPostCore(session, id, parsed.data, newPhotoKey, removePhoto);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});

export const DELETE = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const session = await requireAnyDomainAdmin(request);

  const result = await deleteNewsPostCore(session, id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});
