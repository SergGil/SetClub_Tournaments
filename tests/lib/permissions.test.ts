import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import {
  getSession,
  hasAnyAdminAccess,
  isAdmin,
  isDomainAdmin,
  requireAdmin,
  requireDomainAdmin,
  requireUser,
} from "@/lib/permissions";

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

describe("isDomainAdmin", () => {
  it("is true for a superadmin regardless of the domain", async () => {
    authMock.mockResolvedValueOnce({ user: { role: "ADMIN", domains: [] } });
    expect(await isDomainAdmin("COFFEE")).toBe(true);
  });

  it("is true for a member holding that domain", async () => {
    authMock.mockResolvedValueOnce({ user: { role: "MEMBER", domains: ["TENNIS"] } });
    expect(await isDomainAdmin("TENNIS")).toBe(true);
  });

  it("is false for a member holding a different domain", async () => {
    authMock.mockResolvedValueOnce({ user: { role: "MEMBER", domains: ["COFFEE"] } });
    expect(await isDomainAdmin("TENNIS")).toBe(false);
  });

  it("is false with no session", async () => {
    authMock.mockResolvedValueOnce(null);
    expect(await isDomainAdmin("TENNIS")).toBe(false);
  });
});

describe("requireDomainAdmin", () => {
  it("returns the session for a superadmin", async () => {
    const session = { user: { id: "1", role: "ADMIN", domains: [] } };
    authMock.mockResolvedValueOnce(session);
    expect(await requireDomainAdmin("PADEL")).toBe(session);
  });

  it("returns the session for a matching domain admin", async () => {
    const session = { user: { id: "1", role: "MEMBER", domains: ["PADEL", "COFFEE"] } };
    authMock.mockResolvedValueOnce(session);
    expect(await requireDomainAdmin("PADEL")).toBe(session);
  });

  it("throws for a member without that domain", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1", role: "MEMBER", domains: ["COFFEE"] } });
    await expect(requireDomainAdmin("TENNIS")).rejects.toThrow("Forbidden: admin access required");
  });

  it("throws with no session", async () => {
    authMock.mockResolvedValueOnce(null);
    await expect(requireDomainAdmin("TENNIS")).rejects.toThrow("Forbidden: admin access required");
  });
});

describe("hasAnyAdminAccess", () => {
  it("is true for a superadmin with no domains", async () => {
    authMock.mockResolvedValueOnce({ user: { role: "ADMIN", domains: [] } });
    expect(await hasAnyAdminAccess()).toBe(true);
  });

  it("is true for a member with at least one domain", async () => {
    authMock.mockResolvedValueOnce({ user: { role: "MEMBER", domains: ["PADEL"] } });
    expect(await hasAnyAdminAccess()).toBe(true);
  });

  it("is false for a member with no domains", async () => {
    authMock.mockResolvedValueOnce({ user: { role: "MEMBER", domains: [] } });
    expect(await hasAnyAdminAccess()).toBe(false);
  });

  it("is false with no session", async () => {
    authMock.mockResolvedValueOnce(null);
    expect(await hasAnyAdminAccess()).toBe(false);
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
