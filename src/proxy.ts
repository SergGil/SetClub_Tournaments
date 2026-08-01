import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Session strategy is "database", not JWT, so there's no way to verify a
// session is valid (or belongs to an admin) without a DB lookup - and the
// Next.js docs specifically warn against doing that in Proxy (it runs on
// every request, including prefetches). Previously this used auth() here,
// which does exactly that; a DB hiccup in that Edge-side lookup took the
// whole /admin section down with a bare "Server error" for anyone holding
// so much as a stale session cookie - reported after an admin shared an
// /admin/tournaments/... link.
//
// So this only does the cheap, cookie-*presence* check: no session cookie
// at all means definitely not signed in, safe to redirect immediately. Any
// cookie - valid, expired, or bogus - falls through to the admin layout's
// real check (getSession() in a normal Node.js server component), which
// resolves it properly instead of risking a crash here.
function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies.getAll().some((cookie) => cookie.name.includes("authjs.session-token"));
}

export default function proxy(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/admin")) return;
  if (hasSessionCookie(req)) return;

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("callbackUrl", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
