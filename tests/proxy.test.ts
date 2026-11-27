import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import proxy, { config } from "@/proxy";

function req(path: string, cookie?: string) {
  return new NextRequest(`https://set-club.test${path}`, cookie ? { headers: { cookie } } : undefined);
}

describe("proxy (admin cookie-presence gate)", () => {
  it("only runs for /admin and for a homepage request that mentions Markdown", () => {
    expect(config.matcher).toEqual([
      "/admin/:path*",
      { source: "/", has: [{ type: "header", key: "accept", value: ".*text/markdown.*" }] },
    ]);
  });

  it("lets non-admin paths through untouched", () => {
    expect(proxy(req("/players"))).toBeUndefined();
  });

  it("redirects an /admin visitor with no session cookie to /login, remembering where they were going", () => {
    const response = proxy(req("/admin/tournaments"))!;
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("callbackUrl")).toBe("/admin/tournaments");
  });

  it("lets any session cookie through to the layout's real check - valid or not", () => {
    const res = proxy(req("/admin", "authjs.session-token=whatever"));
    expect(res?.headers.get("location")).toBeNull();
    expect(res?.status).toBe(200);
  });

  it("also recognises the __Secure- prefixed production cookie name", () => {
    const res = proxy(req("/admin/players", "__Secure-authjs.session-token=abc"));
    expect(res?.headers.get("location")).toBeNull();
    expect(res?.status).toBe(200);
  });

  it("hands the requested page (path + query) to the admin layout, overwriting any client-sent value", () => {
    const request = new NextRequest("https://set-club.test/admin/tournaments/t1?tab=matches", {
      headers: { cookie: "authjs.session-token=abc", "x-setclub-admin-path": "/admin/evil" },
    });
    const res = proxy(request);
    // NextResponse.next({ request: { headers } }) forwards overridden request headers this way.
    expect(res?.headers.get("x-middleware-request-x-setclub-admin-path")).toBe("/admin/tournaments/t1?tab=matches");
  });

  it("is not fooled by an unrelated cookie", () => {
    expect(proxy(req("/admin", "theme=dark"))?.status).toBe(307);
  });
});

describe("proxy (homepage content negotiation)", () => {
  function home(accept?: string) {
    return new NextRequest("https://set-club.test/", accept ? { headers: { accept } } : undefined);
  }

  it("rewrites / to the Markdown homepage when Markdown is preferred", () => {
    const response = proxy(home("text/markdown, text/html;q=0.9"))!;
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://set-club.test/index.md");
  });

  it.each([["text/markdown;q=0"], ["text/html, text/markdown;q=0.5"], [undefined]])(
    "leaves / as HTML for Accept %j",
    (accept) => {
      expect(proxy(home(accept))).toBeUndefined();
    },
  );
});
