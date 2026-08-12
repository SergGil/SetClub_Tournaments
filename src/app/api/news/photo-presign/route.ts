import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { isDomainAdmin } from "@/lib/permissions";
import { createPresignedUploadUrl, sanitizeFileName } from "@/lib/r2";
import { newsPhotoPresignRequestSchema } from "@/lib/validation/photo";

export async function POST(request: Request) {
  if (!(await isDomainAdmin("TENNIS"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = newsPhotoPresignRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректні дані запиту" }, { status: 400 });
  }

  const { fileName, contentType, contentLength } = parsed.data;
  const key = `news/${randomUUID()}-${sanitizeFileName(fileName)}`;
  const uploadUrl = await createPresignedUploadUrl(key, contentType, contentLength);

  return NextResponse.json({ uploadUrl, key });
}
