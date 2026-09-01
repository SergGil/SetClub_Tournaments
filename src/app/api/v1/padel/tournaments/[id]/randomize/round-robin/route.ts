import { NextResponse } from "next/server";

import { commitPadelSinglesRoundRobinAction } from "@/lib/actions/padel-randomize-singles";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

/** Padel twin of POST /api/v1/tournaments/[id]/randomize/round-robin. */
export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const strategy = body?.strategy === "SEEDED_SPLIT" ? "SEEDED_SPLIT" : "ALL";
  const acknowledgedCompletedLoss = body?.acknowledgedCompletedLoss === true;

  const result = await commitPadelSinglesRoundRobinAction(id, strategy, acknowledgedCompletedLoss, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ matchCount: result.matchCount });
});
