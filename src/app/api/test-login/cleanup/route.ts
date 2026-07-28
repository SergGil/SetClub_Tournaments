import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { isTestLoginEnabled, TEST_ADMIN_EMAIL, TEST_LOGIN_SECRET } from "@/lib/test-login";

/**
 * Deletes whatever the Playwright admin-flow tests created (matched by a
 * "Playwright " name prefix the tests always use) plus the test admin user
 * and its sessions. Same production/secret double-gate as /api/test-login -
 * see that route's comment.
 */
export async function POST(request: Request) {
  if (!isTestLoginEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (body?.secret !== TEST_LOGIN_SECRET) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  await prisma.player.deleteMany({ where: { name: { startsWith: "Playwright " } } });
  await prisma.tournament.deleteMany({ where: { name: { startsWith: "Playwright " } } });
  await prisma.session.deleteMany({ where: { user: { email: TEST_ADMIN_EMAIL } } });
  await prisma.user.deleteMany({ where: { email: TEST_ADMIN_EMAIL } });

  return NextResponse.json({ ok: true });
}
