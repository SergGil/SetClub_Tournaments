import { beforeEach, describe, expect, it } from "vitest";

import { checkRateLimit, clientIp, resetRateLimits, withRateLimit } from "@/lib/rate-limit";

const opts = { name: "t", limit: 3, windowMs: 60_000 };

function req(ip: string) {
  return new Request("https://example.test/api", { headers: { "x-forwarded-for": ip } });
}

beforeEach(() => resetRateLimits());

describe("clientIp", () => {
  it("takes the first x-forwarded-for entry, then x-real-ip, then 'unknown'", () => {
    expect(clientIp(req("1.1.1.1, 2.2.2.2"))).toBe("1.1.1.1");
    expect(clientIp(new Request("https://x.test", { headers: { "x-real-ip": "3.3.3.3" } }))).toBe("3.3.3.3");
    expect(clientIp(new Request("https://x.test"))).toBe("unknown");
  });
});

describe("checkRateLimit", () => {
  it("allows up to the limit, then blocks with a Retry-After", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) expect(checkRateLimit(req("1.1.1.1"), opts, now)).toEqual({ ok: true });
    const blocked = checkRateLimit(req("1.1.1.1"), opts, now + 10_000);
    expect(blocked).toEqual({ ok: false, retryAfterSeconds: 50 });
  });

  it("counts clients and endpoint groups separately", () => {
    const now = 5;
    for (let i = 0; i < 3; i++) checkRateLimit(req("1.1.1.1"), opts, now);
    expect(checkRateLimit(req("2.2.2.2"), opts, now).ok).toBe(true);
    expect(checkRateLimit(req("1.1.1.1"), { ...opts, name: "other" }, now).ok).toBe(true);
  });

  it("starts a fresh window once the old one expired", () => {
    const now = 100;
    for (let i = 0; i < 4; i++) checkRateLimit(req("1.1.1.1"), opts, now);
    expect(checkRateLimit(req("1.1.1.1"), opts, now + 60_001).ok).toBe(true);
  });
});

describe("withRateLimit", () => {
  it("answers 429 with Retry-After once over the limit and skips the handler", async () => {
    let calls = 0;
    const handler = withRateLimit(opts, async () => {
      calls += 1;
      return new Response("ok");
    });
    for (let i = 0; i < 3; i++) expect((await handler(req("9.9.9.9"))).status).toBe(200);
    const blocked = await handler(req("9.9.9.9"));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(calls).toBe(3);
  });
});
