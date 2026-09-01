import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/lib/api-auth";
import { isDomainAdmin } from "@/lib/permissions";
import { getActiveMenuSections, getMenuSections } from "@/lib/queries/menu";

/** `?all=true` (COFFEE admin only) returns every section/item including inactive ones; otherwise the public active-only menu. */
export const GET = withApiErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const wantsAll = searchParams.get("all") === "true";
  const sections =
    wantsAll && (await isDomainAdmin("COFFEE", request)) ? await getMenuSections() : await getActiveMenuSections();
  return NextResponse.json({ sections });
});
