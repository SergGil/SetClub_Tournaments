import { NextResponse } from "next/server";

import { confirmPadelPhotoUploadAction } from "@/lib/actions/padel-photos";
import { withApiErrorHandling } from "@/lib/api-auth";
import { getPhotosByPadelTournament } from "@/lib/queries/padel-photos";

type Params = { params: Promise<{ id: string }> };

/** Padel twin of GET /api/v1/tournaments/[id]/photos. */
export const GET = withApiErrorHandling(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const photos = await getPhotosByPadelTournament(id);
  return NextResponse.json({ photos });
});

/** Padel twin of POST /api/v1/tournaments/[id]/photos - key from POST /api/padel-photos/presign. */
export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key : "";
  const caption = typeof body?.caption === "string" ? body.caption : undefined;

  const result = await confirmPadelPhotoUploadAction(id, key, caption, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 201 });
});
