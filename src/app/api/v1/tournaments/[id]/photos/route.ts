import { NextResponse } from "next/server";

import { confirmPhotoUploadAction } from "@/lib/actions/photos";
import { withApiErrorHandling } from "@/lib/api-auth";
import { getPhotosByTournament } from "@/lib/queries/photos";

type Params = { params: Promise<{ id: string }> };

export const GET = withApiErrorHandling(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const photos = await getPhotosByTournament(id);
  return NextResponse.json({ photos });
});

/** Body: `{ key, caption? }` - `key` comes from the presigned upload at POST /api/photos/presign, PUT there first. */
export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key : "";
  const caption = typeof body?.caption === "string" ? body.caption : undefined;

  const result = await confirmPhotoUploadAction(id, key, caption, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 201 });
});
