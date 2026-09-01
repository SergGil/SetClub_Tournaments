import { NextResponse } from "next/server";

import { commitSinglesRoundRobinAction } from "@/lib/actions/randomize-singles";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

/** Body: `{ strategy: "ALL" | "SEEDED_SPLIT", acknowledgedCompletedLoss? }` - singles round robin (not CUSTOM_GROUPS, see /groups/draw+commit for that). */
export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const strategy = body?.strategy === "SEEDED_SPLIT" ? "SEEDED_SPLIT" : "ALL";
  const acknowledgedCompletedLoss = body?.acknowledgedCompletedLoss === true;

  const result = await commitSinglesRoundRobinAction(id, strategy, acknowledgedCompletedLoss, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ matchCount: result.matchCount });
});
