import { NextResponse } from "next/server";

import { toggleMenuItemActiveCore } from "@/lib/actions/menu";
import { withApiErrorHandling } from "@/lib/api-auth";
import { requireDomainAdmin } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const session = await requireDomainAdmin("COFFEE", request);

  const body = await request.json().catch(() => null);
  const result = await toggleMenuItemActiveCore(session, id, body?.active === true);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});
