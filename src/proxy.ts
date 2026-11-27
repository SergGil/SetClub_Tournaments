import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prefersMarkdown } from "@/lib/accept-markdown";
import { ADMIN_PATH_HEADER } from "@/lib/safe-redirect";

// Two cheap, DB-free jobs: content negotiation for the homepage, and the
// /admin cookie-presence gate below.

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
  // An AI agent that asks for Markdown gets the homepage as Markdown
  // (src/app/index.md/route.ts, docs/SEO.md "AI-готовність"). Done here
  // rather than as a next.config `has` rewrite because the decision needs the
  // Accept q-values (`text/markdown;q=0` means "never"), which a regex can't
  // weigh against text/html - see prefersMarkdown.
  if (req.nextUrl.pathname === "/") {
    return prefersMarkdown(req.headers.get("accept")) ? NextResponse.rewrite(new URL("/index.md", req.url)) : undefined;
  }

  if (!req.nextUrl.pathname.startsWith("/admin")) return;
  if (hasSessionCookie(req)) {
    // Tell the admin layout which page this was, so an expired/bogus session
    // goes to /login with it as callbackUrl (see ADMIN_PATH_HEADER).
    const headers = new Headers(req.headers);
    headers.set(ADMIN_PATH_HEADER, req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.next({ request: { headers } });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("callbackUrl", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/admin/:path*",
    // Only a `/` request whose Accept mentions Markdown at all - browsers never
    // send that, so ordinary homepage visits skip the proxy entirely. Matcher
    // values must be literals (statically analysed at build).
    { source: "/", has: [{ type: "header", key: "accept", value: ".*text/markdown.*" }] },
  ],
};
