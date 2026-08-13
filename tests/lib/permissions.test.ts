import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import {
  getAdminScope,
  getSession,
  hasAnyAdminAccess,
  isAdmin,
  isDomainAdmin,
  requireAdmin,
  requireAnyDomainAdmin,
  requireDomainAdmin,
  requireUser,
} from "@/lib/permissions";

describe("getAdminScope", () => {
  it("is superadmin with no domains for a SUPERADMIN, regardless of any domain rows", () => {
    expect(getAdminScope({ user: { role: "SUPERADMIN", domains: ["TENNIS"] } })).toEqual({
      isSuperAdmin: true,
      domains: [],
    });
  });

  it("passes through the domains for an ADMIN", () => {
    expect(getAdminScope({ user: { role: "ADMIN", domains: ["COFFEE", "PADEL"] } })).toEqual({
      isSuperAdmin: false,
      domains: ["COFFEE", "PADEL"],
    });
  });

  it("ignores leftover domain rows for a MEMBER", () => {
    expect(getAdminScope({ user: { role: "MEMBER", domains: ["TENNIS"] } })).toEqual({
      isSuperAdmin: false,
      domains: [],
    });
  });

  it("is neither for no session", () => {
    expect(getAdminScope(null)).toEqual({ isSuperAdmin: false, domains: [] });
    expect(getAdminScope(undefined)).toEqual({ isSuperAdmin: false, domains: [] });
    expect(getAdminScope({})).toEqual({ isSuperAdmin: false, domains: [] });
  });
});

describe("getSession", () => {
  it("returns whatever auth() resolves to", async () => {
    const session = { user: { id: "1", role: "MEMBER" } };
    authMock.mockResolvedValueOnce(session);
    expect(await getSession()).toBe(session);
  });
});

describe("isAdmin", () => {
  it("is true for a superadmin", async () => {
    authMock.mockResolvedValueOnce({ user: { role: "SUPERADMIN" } });
    expect(await isAdmin()).toBe(true);
  });

  it("is false for a scoped ADMIN (not a superadmin)", async () => {
    authMock.mockResolvedValueOnce({ user: { role: "ADMIN", domains: ["TENNIS"] } });
    expect(await isAdmin()).toBe(false);
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
  it("returns the session for a superadmin", async () => {
    const session = { user: { id: "1", role: "SUPERADMIN" } };
    authMock.mockResolvedValueOnce(session);
    expect(await requireAdmin()).toBe(session);
  });

  it("throws for a scoped ADMIN (not a superadmin)", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1", role: "ADMIN", domains: ["TENNIS"] } });
    await expect(requireAdmin()).rejects.toThrow("Forbidden: admin access required");
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
    authMock.mockResolvedValueOnce({ user: { role: "SUPERADMIN", domains: [] } });
    expect(await isDomainAdmin("COFFEE")).toBe(true);
  });

  it("is true for an ADMIN holding that domain", async () => {
    authMock.mockResolvedValueOnce({ user: { role: "ADMIN", domains: ["TENNIS"] } });
    expect(await isDomainAdmin("TENNIS")).toBe(true);
  });

  it("is false for an ADMIN holding a different domain", async () => {
    authMock.mockResolvedValueOnce({ user: { role: "ADMIN", domains: ["COFFEE"] } });
    expect(await isDomainAdmin("TENNIS")).toBe(false);
  });

  it("is false for a MEMBER even if domain rows somehow still exist (e.g. a demoted ex-ADMIN)", async () => {
    authMock.mockResolvedValueOnce({ user: { role: "MEMBER", domains: ["TENNIS"] } });
    expect(await isDomainAdmin("TENNIS")).toBe(false);
  });

  it("is false with no session", async () => {
    authMock.mockResolvedValueOnce(null);
    expect(await isDomainAdmin("TENNIS")).toBe(false);
  });
});

describe("requireDomainAdmin", () => {
  it("returns the session for a superadmin", async () => {
    const session = { user: { id: "1", role: "SUPERADMIN", domains: [] } };
    authMock.mockResolvedValueOnce(session);
    expect(await requireDomainAdmin("PADEL")).toBe(session);
  });

  it("returns the session for a matching ADMIN domain holder", async () => {
    const session = { user: { id: "1", role: "ADMIN", domains: ["PADEL", "COFFEE"] } };
    authMock.mockResolvedValueOnce(session);
    expect(await requireDomainAdmin("PADEL")).toBe(session);
  });

  it("throws for an ADMIN without that domain", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1", role: "ADMIN", domains: ["COFFEE"] } });
    await expect(requireDomainAdmin("TENNIS")).rejects.toThrow("Forbidden: admin access required");
  });

  it("throws for a MEMBER even with leftover domain rows", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1", role: "MEMBER", domains: ["TENNIS"] } });
    await expect(requireDomainAdmin("TENNIS")).rejects.toThrow("Forbidden: admin access required");
  });

  it("throws with no session", async () => {
    authMock.mockResolvedValueOnce(null);
    await expect(requireDomainAdmin("TENNIS")).rejects.toThrow("Forbidden: admin access required");
  });
});

describe("hasAnyAdminAccess", () => {
  it("is true for a superadmin with no domains", async () => {
    authMock.mockResolvedValueOnce({ user: { role: "SUPERADMIN", domains: [] } });
    expect(await hasAnyAdminAccess()).toBe(true);
  });

  it("is true for an ADMIN with at least one domain", async () => {
    authMock.mockResolvedValueOnce({ user: { role: "ADMIN", domains: ["PADEL"] } });
    expect(await hasAnyAdminAccess()).toBe(true);
  });

  it("is false for an ADMIN with no domains yet", async () => {
    authMock.mockResolvedValueOnce({ user: { role: "ADMIN", domains: [] } });
    expect(await hasAnyAdminAccess()).toBe(false);
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

describe("requireAnyDomainAdmin", () => {
  it("returns the session for a superadmin with no domains", async () => {
    const session = { user: { id: "1", role: "SUPERADMIN", domains: [] } };
    authMock.mockResolvedValueOnce(session);
    expect(await requireAnyDomainAdmin()).toBe(session);
  });

  it("returns the session for an ADMIN with at least one domain", async () => {
    const session = { user: { id: "1", role: "ADMIN", domains: ["PADEL"] } };
    authMock.mockResolvedValueOnce(session);
    expect(await requireAnyDomainAdmin()).toBe(session);
  });

  it("throws for an ADMIN with no domains yet", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1", role: "ADMIN", domains: [] } });
    await expect(requireAnyDomainAdmin()).rejects.toThrow("Forbidden: admin access required");
  });

  it("throws for a signed-in member", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1", role: "MEMBER", domains: [] } });
    await expect(requireAnyDomainAdmin()).rejects.toThrow("Forbidden: admin access required");
  });

  it("throws with no session", async () => {
    authMock.mockResolvedValueOnce(null);
    await expect(requireAnyDomainAdmin()).rejects.toThrow("Forbidden: admin access required");
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
