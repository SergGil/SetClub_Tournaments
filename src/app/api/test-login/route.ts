import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import type { AdminDomain } from "@/generated/prisma/enums";
import { readJsonBody, unknownArray } from "@/lib/api-body";
import { prisma } from "@/lib/db";
import { isTestLoginEnabled, matchesTestLoginSecret, TEST_ADMIN_EMAIL } from "@/lib/test-login";

const ROLE_VALUES = ["SUPERADMIN", "ADMIN", "MEMBER"] as const;
const DOMAIN_VALUES = ["TENNIS", "COFFEE", "PADEL"] as const;

function isTestRole(value: unknown): value is (typeof ROLE_VALUES)[number] {
  return ROLE_VALUES.some((role) => role === value);
}

function isAdminDomain(value: unknown): value is AdminDomain {
  return DOMAIN_VALUES.some((domain) => domain === value);
}

/**
 * Test-only sign-in for Playwright: creates a database session for a fixed
 * test user and sets the same cookie Auth.js's database session strategy
 * reads, bypassing real Google OAuth. Inert everywhere that matters -
 * disabled whenever NODE_ENV is "production" (always true on Vercel,
 * regardless of any other env misconfiguration) and additionally requires
 * E2E_TEST_LOGIN_SECRET, which is only ever set in local/CI .env files,
 * never in the deployed environment.
 *
 * Defaults to SUPERADMIN with no domains (unchanged from before scoped
 * admin roles existed). Optional `role`/`domains` in the body let e2e specs
 * exercise the narrower tiers (docs/ADMIN_DOMAINS.md) - e.g. an ADMIN
 * scoped to TENNIS, or an ADMIN with no domains at all - without needing
 * direct DB access from the spec file.
 */
export async function POST(request: Request) {
  if (!isTestLoginEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const body = await readJsonBody(request);
  if (!matchesTestLoginSecret(body.secret)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const role = isTestRole(body.role) ? body.role : "SUPERADMIN";
  const domains = unknownArray(body.domains).filter(isAdminDomain);

  const user = await prisma.user.upsert({
    where: { email: TEST_ADMIN_EMAIL },
    update: { role },
    create: { email: TEST_ADMIN_EMAIL, name: "E2E Admin", role },
  });

  await prisma.userAdminDomain.deleteMany({ where: { userId: user.id } });
  if (domains.length > 0) {
    await prisma.userAdminDomain.createMany({
      data: domains.map((domain) => ({ userId: user.id, domain })),
    });
  }

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
