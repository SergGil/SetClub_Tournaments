import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/lib/api-auth";
import { requireAdmin } from "@/lib/permissions";
import { getUsers, getUsersPage } from "@/lib/queries/users";

/** SUPERADMIN-only, same as /admin/users. */
export const GET = withApiErrorHandling(async (request: Request) => {
  await requireAdmin(request);

  const { searchParams } = new URL(request.url);
  if (!searchParams.has("limit") && !searchParams.has("q")) {
    return NextResponse.json({ users: await getUsers() });
  }

  const limit = Math.min(Number(searchParams.get("limit") ?? 20) || 20, 100);
  const query = searchParams.get("q") ?? undefined;
  const { users, total } = await getUsersPage(limit, query);
  return NextResponse.json({ users, total });
});
