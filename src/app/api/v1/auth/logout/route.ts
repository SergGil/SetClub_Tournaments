import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

/** JSON/bearer equivalent of signOutAction() (src/lib/actions/auth.ts) for mobile clients. */
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (token) {
    await prisma.session.deleteMany({ where: { sessionToken: token } });
  }
  return NextResponse.json({ success: true });
}
