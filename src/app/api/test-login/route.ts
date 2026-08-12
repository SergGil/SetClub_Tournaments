import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { isTestLoginEnabled, matchesTestLoginSecret, TEST_ADMIN_EMAIL } from "@/lib/test-login";

/**
 * Test-only sign-in for Playwright: creates a database session for a fixed
 * admin user and sets the same cookie Auth.js's database session strategy
 * reads, bypassing real Google OAuth. Inert everywhere that matters -
 * disabled whenever NODE_ENV is "production" (always true on Vercel,
 * regardless of any other env misconfiguration) and additionally requires
 * E2E_TEST_LOGIN_SECRET, which is only ever set in local/CI .env files,
 * never in the deployed environment.
 */
export async function POST(request: Request) {
  if (!isTestLoginEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!matchesTestLoginSecret(body?.secret)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const user = await prisma.user.upsert({
    where: { email: TEST_ADMIN_EMAIL },
    update: { role: "SUPERADMIN" },
    create: { email: TEST_ADMIN_EMAIL, name: "E2E Admin", role: "SUPERADMIN" },
  });

  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.session.create({ data: { sessionToken, userId: user.id, expires } });

  const response = NextResponse.json({ ok: true });
  response.cookies.set("authjs.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
  });
  return response;
}
