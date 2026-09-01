import { NextResponse } from "next/server";

import { createNewsPostCore } from "@/lib/actions/news";
import { withApiErrorHandling } from "@/lib/api-auth";
import { requireAnyDomainAdmin } from "@/lib/permissions";
import { getNewsPostsPage } from "@/lib/queries/news";
import { newsPostFormSchema } from "@/lib/validation/news";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

export const GET = withApiErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20) || 20, 100);
  const query = searchParams.get("q") ?? undefined;
  const { posts, total } = await getNewsPostsPage(limit, query);
  return NextResponse.json({ posts, total });
});

/** Body: `{ title, body, photoKey? }` - `photoKey` must start with "news/" (uploaded beforehand via POST /api/news/photo-presign), same as the web form's readPhotoKeyField check. */
export const POST = withApiErrorHandling(async (request: Request) => {
  const session = await requireAnyDomainAdmin(request);

  const body = await request.json().catch(() => null);
  const parsed = newsPostFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некоректні дані", fieldErrors: fieldErrorsFromZod(parsed.error) },
      { status: 400 },
    );
  }

  const photoKey = typeof body?.photoKey === "string" ? body.photoKey : null;
  if (photoKey && !photoKey.startsWith("news/")) {
    return NextResponse.json({ error: "Некоректний ключ фото" }, { status: 400 });
  }

  const result = await createNewsPostCore(session, parsed.data, photoKey);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 201 });
});
