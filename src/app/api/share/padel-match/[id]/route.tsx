import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

import { getPadelMatchById } from "@/lib/queries/padel-matches";
import { buildMatchShareData } from "@/lib/share/match-card-data";
import { matchShareCardElement } from "@/lib/share/match-card-image";

/**
 * Padel twin of api/share/match/[id]/route.tsx - only the query differs.
 * buildMatchShareData/matchShareCardElement are pure functions over plain
 * data (no Prisma coupling) and are reused unchanged: PadelMatchWithDetails
 * is structurally identical to Tennis's MatchWithDetails.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = await getPadelMatchById(id);
  const data = match ? buildMatchShareData(match) : null;
  if (!data) {
    return NextResponse.json({ error: "Матч не знайдено або ще не завершено" }, { status: 404 });
  }

  return new ImageResponse(matchShareCardElement(data), { width: 1200, height: 630 });
}
