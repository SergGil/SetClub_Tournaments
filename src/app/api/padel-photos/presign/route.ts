import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { isDomainAdmin } from "@/lib/permissions";
import { createPresignedUploadUrl, sanitizeFileName } from "@/lib/r2";
import { presignRequestSchema } from "@/lib/validation/photo";

/** Padel twin of api/photos/presign/route.ts - only the domain gate and key prefix differ. */
export async function POST(request: Request) {
  if (!(await isDomainAdmin("PADEL", request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = presignRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректні дані запиту" }, { status: 400 });
  }

  const { tournamentId, fileName, contentType, contentLength } = parsed.data;
  const key = `padel-tournaments/${tournamentId}/${randomUUID()}-${sanitizeFileName(fileName)}`;
  const uploadUrl = await createPresignedUploadUrl(key, contentType, contentLength);

  return NextResponse.json({ uploadUrl, key });
}
