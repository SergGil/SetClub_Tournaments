import { NextResponse } from "next/server";

import { deletePadelPhotoAction } from "@/lib/actions/padel-photos";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string; photoId: string }> };

export const DELETE = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { photoId } = await params;
  const result = await deletePadelPhotoAction(photoId, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});
