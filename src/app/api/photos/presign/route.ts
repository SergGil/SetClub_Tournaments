import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/lib/api-auth";
import { readJsonBody } from "@/lib/api-body";
import { requireDomainAdmin } from "@/lib/permissions";
import { createPresignedUploadUrl, sanitizeFileName } from "@/lib/r2";
import { presignRequestSchema } from "@/lib/validation/photo";

// No session (e.g. the mobile app's token expired) -> 401, signed in without the
// rights -> 403, via withApiErrorHandling - the app signs out only on a 401.
export const POST = withApiErrorHandling(async (request: Request) => {
  await requireDomainAdmin("TENNIS", request);

  const body = await readJsonBody(request);
  const parsed = presignRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректні дані запиту" }, { status: 400 });
  }

  const { tournamentId, fileName, contentType, contentLength } = parsed.data;
  const key = `tournaments/${tournamentId}/${randomUUID()}-${sanitizeFileName(fileName)}`;
  const uploadUrl = await createPresignedUploadUrl(key, contentType, contentLength);

  return NextResponse.json({ uploadUrl, key });
});
