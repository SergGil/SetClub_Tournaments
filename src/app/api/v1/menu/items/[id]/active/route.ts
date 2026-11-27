import { NextResponse } from "next/server";

import { toggleMenuItemActiveCore } from "@/lib/actions/menu-core";
import { withApiErrorHandling } from "@/lib/api-auth";
import { readJsonBody } from "@/lib/api-body";
import { requireDomainAdmin } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const session = await requireDomainAdmin("COFFEE", request);

  const body = await readJsonBody(request);
  const result = await toggleMenuItemActiveCore(session, id, body.active === true);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});
