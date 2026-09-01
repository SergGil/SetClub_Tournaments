import { NextResponse } from "next/server";

import { updateUserDomainsAction } from "@/lib/actions/users";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

/** See the doc comment on PATCH /api/v1/users/[id]/role for why business-rule Errors are mapped to 400 here. */
export const PATCH = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const domains = Array.isArray(body?.domains) ? body.domains.filter((v: unknown) => typeof v === "string") : [];

  try {
    await updateUserDomainsAction(id, domains, request);
  } catch (error) {
    if (error instanceof Error && !error.message.startsWith("Forbidden") && !error.message.startsWith("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json({ success: true });
});
