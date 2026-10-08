import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import proxy, { config } from "@/proxy";

function req(path: string, cookie?: string) {
  return new NextRequest(`https://set-club.test${path}`, cookie ? { headers: { cookie } } : undefined);
}

describe("proxy (admin cookie-presence gate)", () => {
  it("only runs for /admin", () => {
    expect(config.matcher).toEqual(["/admin/:path*"]);
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
    expect(proxy(req("/admin", "authjs.session-token=whatever"))).toBeUndefined();
  });

  it("also recognises the __Secure- prefixed production cookie name", () => {
    expect(proxy(req("/admin/players", "__Secure-authjs.session-token=abc"))).toBeUndefined();
  });

  it("is not fooled by an unrelated cookie", () => {
    expect(proxy(req("/admin", "theme=dark"))?.status).toBe(307);
  });
});
