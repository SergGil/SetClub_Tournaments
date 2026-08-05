import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { getSession, isAdmin, requireAdmin, requireUser } from "@/lib/permissions";

describe("getSession", () => {
  it("returns whatever auth() resolves to", async () => {
    const session = { user: { id: "1", role: "MEMBER" } };
    authMock.mockResolvedValueOnce(session);
    expect(await getSession()).toBe(session);
  });
});

describe("isAdmin", () => {
  it("is true for a signed-in admin", async () => {
    authMock.mockResolvedValueOnce({ user: { role: "ADMIN" } });
    expect(await isAdmin()).toBe(true);
  });

  it("is false for a signed-in member", async () => {
    authMock.mockResolvedValueOnce({ user: { role: "MEMBER" } });
    expect(await isAdmin()).toBe(false);
  });

  it("is false with no session", async () => {
    authMock.mockResolvedValueOnce(null);
    expect(await isAdmin()).toBe(false);
  });
});

describe("requireAdmin", () => {
  it("returns the session for an admin", async () => {
    const session = { user: { id: "1", role: "ADMIN" } };
    authMock.mockResolvedValueOnce(session);
    expect(await requireAdmin()).toBe(session);
  });

  it("throws for a signed-in member", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1", role: "MEMBER" } });
    await expect(requireAdmin()).rejects.toThrow("Forbidden: admin access required");
  });

  it("throws with no session", async () => {
    authMock.mockResolvedValueOnce(null);
    await expect(requireAdmin()).rejects.toThrow("Forbidden: admin access required");
  });
});

describe("requireUser", () => {
  it("returns the session for any signed-in user", async () => {
    const session = { user: { id: "1", role: "MEMBER" } };
    authMock.mockResolvedValueOnce(session);
    expect(await requireUser()).toBe(session);
  });

  it("throws with no session", async () => {
    authMock.mockResolvedValueOnce(null);
    await expect(requireUser()).rejects.toThrow("Unauthorized: sign-in required");
  });
});
