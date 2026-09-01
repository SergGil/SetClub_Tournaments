import { NextResponse } from "next/server";

import { unlinkPlayerCore } from "@/lib/actions/players";
import { withApiErrorHandling } from "@/lib/api-auth";
import { requireDomainsAdmin } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const session = await requireDomainsAdmin(["TENNIS", "PADEL"], request);

  const result = await unlinkPlayerCore(session, id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});
