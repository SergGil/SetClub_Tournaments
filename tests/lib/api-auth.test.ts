import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PUBLIC_API_CACHE, withApiErrorHandling } from "@/lib/api-auth";

afterEach(() => vi.restoreAllMocks());

describe("withApiErrorHandling", () => {
  it("passes a normal response through untouched", async () => {
    const handler = withApiErrorHandling(async () => Response.json({ ok: true }, { status: 201 }));
    const response = await handler();
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("forwards the handler's arguments", async () => {
    const handler = withApiErrorHandling(async (a: number, b: number) => Response.json({ sum: a + b }));
    expect(await (await handler(2, 3)).json()).toEqual({ sum: 5 });
  });

  it("maps Unauthorized errors to 401 with the message", async () => {
    const handler = withApiErrorHandling(async () => {
      throw new Error("Unauthorized: sign-in required");
    });
    const response = await handler();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized: sign-in required" });
  });

  it("maps Forbidden errors to 403 with the message", async () => {
    const handler = withApiErrorHandling(async () => {
      throw new Error("Forbidden: admin access required");
    });
    const response = await handler();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden: admin access required" });
  });

  it("turns anything else into a generic 500 without leaking the error text, and logs it", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withApiErrorHandling(async () => {
      throw new Error("connection string postgres://secret");
    });
    const response = await handler();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
    expect(spy).toHaveBeenCalled();
  });

  it("handles a thrown non-Error value as a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withApiErrorHandling(async () => {
      throw "boom";
    });
    expect((await handler()).status).toBe(500);
  });
});

describe("PUBLIC_API_CACHE", () => {
  it("lets the CDN cache for a minute and serve stale while revalidating", () => {
    expect(PUBLIC_API_CACHE["Cache-Control"]).toBe("public, s-maxage=60, stale-while-revalidate=300");
  });
});
