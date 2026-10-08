import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireDomainAdminMock } = vi.hoisted(() => ({ requireDomainAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireDomainAdmin: requireDomainAdminMock }));

const { prismaMock } = vi.hoisted(() => ({ prismaMock: { homePanelSettings: { upsert: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { logAuditMock } = vi.hoisted(() => ({ logAuditMock: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));

const { revalidatePathMock } = vi.hoisted(() => ({ revalidatePathMock: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/server", () => ({ after: vi.fn((task: () => unknown) => task()) }));

import { updateHomePanelSettingsAction } from "@/lib/actions/home-panels";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireDomainAdminMock.mockResolvedValue(session);
});

describe("updateHomePanelSettingsAction", () => {
  it("rejects an unknown panel key before any permission check or write", async () => {
    const result = await updateHomePanelSettingsAction({}, form({ key: "GOLF", title: "Гольф" }));
    expect(result.fieldErrors?.key).toBe("Невідома секція");
    expect(requireDomainAdminMock).not.toHaveBeenCalled();
    expect(prismaMock.homePanelSettings.upsert).not.toHaveBeenCalled();
  });

  it("rejects a missing title", async () => {
    const result = await updateHomePanelSettingsAction({}, form({ key: "TENNIS", eyebrow: "", title: "", description: "" }));
    expect(result.fieldErrors?.title).toBeDefined();
    expect(prismaMock.homePanelSettings.upsert).not.toHaveBeenCalled();
  });

  it("checks the admin against the panel's OWN domain (a COFFEE admin can't edit the Tennis panel)", async () => {
    requireDomainAdminMock.mockRejectedValueOnce(new Error("Forbidden: admin access required"));
    await expect(updateHomePanelSettingsAction({}, form({ key: "TENNIS", eyebrow: "", title: "Теніс", description: "" }))).rejects.toThrow(
      /Forbidden/,
    );
    expect(requireDomainAdminMock).toHaveBeenCalledWith("TENNIS");
    expect(prismaMock.homePanelSettings.upsert).not.toHaveBeenCalled();
  });

  it("upserts by key, turning blank optional fields into null, and logs the panel label", async () => {
    const result = await updateHomePanelSettingsAction(
      {},
      form({ key: "PADEL", eyebrow: "", title: " Падел ", description: "Корти й тренування" }),
    );
    expect(result).toEqual({ success: true });
    expect(prismaMock.homePanelSettings.upsert).toHaveBeenCalledWith({
      where: { key: "PADEL" },
      create: { key: "PADEL", eyebrow: null, title: "Падел", description: "Корти й тренування" },
      update: { eyebrow: null, title: "Падел", description: "Корти й тренування" },
    });
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({
        action: "home.panel.update",
        entityId: "PADEL",
        summary: expect.stringContaining("Падел"),
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/home");
  });
});
