import { randomUUID } from "node:crypto";

import { OAuth2Client } from "google-auth-library";
import { NextResponse } from "next/server";

import { provisionNewUser, provisionSignIn } from "@/lib/auth-provisioning";
import { prisma } from "@/lib/db";

// Matches next-auth's default database-session maxAge (30 days) so a mobile
// session doesn't expire on a different cadence than a web one.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const googleClient = new OAuth2Client();

/**
 * Mobile equivalent of the web Google OAuth redirect flow. The RN client
 * signs in with Google on-device (expo-auth-session /
 * @react-native-google-signin/google-signin) and hands us the resulting ID
 * token; we verify it server-side, find-or-create the matching User+Account
 * (the same shape @auth/prisma-adapter would produce for a web sign-in), and
 * mint a Session row - same table src/lib/auth.ts's database session
 * strategy already uses, just returned as JSON instead of a cookie so a
 * native client can store it and send it back as `Authorization: Bearer`.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const idToken = typeof body?.idToken === "string" ? body.idToken : null;
  if (!idToken) {
    return NextResponse.json({ error: "idToken обов'язковий" }, { status: 400 });
  }

  let email: string | undefined;
  let providerAccountId: string | undefined;
  let name: string | undefined;
  let picture: string | undefined;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.AUTH_GOOGLE_ID });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified || !payload.sub) {
      return NextResponse.json({ error: "Недійсний Google-токен" }, { status: 401 });
    }
    email = payload.email.toLowerCase();
    providerAccountId = payload.sub;
    name = payload.name;
    picture = payload.picture;
  } catch {
    return NextResponse.json({ error: "Недійсний Google-токен" }, { status: 401 });
  }

  const existingAccount = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: "google", providerAccountId } },
    include: { user: true },
  });

  let user = existingAccount?.user;
  if (!user) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    user = existingUser ?? (await prisma.user.create({ data: { email, name, image: picture } }));
    await prisma.account.create({
      data: { userId: user.id, type: "oauth", provider: "google", providerAccountId },
    });
    if (!existingUser) await provisionNewUser(user);
  }

  await provisionSignIn(user);

  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { sessionToken, userId: user.id, expires } });

  const domainRows = await prisma.userAdminDomain.findMany({
    where: { userId: user.id },
    select: { domain: true },
  });

  return NextResponse.json({
    sessionToken,
    expires,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      domains: domainRows.map((row) => row.domain),
    },
  });
}
