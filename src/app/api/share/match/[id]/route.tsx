import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

import { getMatchById } from "@/lib/queries/matches";
import { buildMatchShareData } from "@/lib/share/match-card-data";
import { matchShareCardElement } from "@/lib/share/match-card-image";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = await getMatchById(id);
  const data = match ? buildMatchShareData(match) : null;
  if (!data) {
    return NextResponse.json({ error: "Матч не знайдено або ще не завершено" }, { status: 404 });
  }

  return new ImageResponse(matchShareCardElement(data), { width: 1200, height: 630 });
}
