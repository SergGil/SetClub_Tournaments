import { NextResponse } from "next/server";

import { linkPlayerCore } from "@/lib/actions/players";
import { withApiErrorHandling } from "@/lib/api-auth";
import { requireDomainsAdmin } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const session = await requireDomainsAdmin(["TENNIS", "PADEL"], request);

  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!userId) return NextResponse.json({ error: "Оберіть користувача" }, { status: 400 });

  const result = await linkPlayerCore(session, id, userId);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});
