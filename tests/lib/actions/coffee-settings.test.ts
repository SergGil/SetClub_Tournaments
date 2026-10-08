import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireDomainAdminMock } = vi.hoisted(() => ({ requireDomainAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireDomainAdmin: requireDomainAdminMock }));

const { prismaMock } = vi.hoisted(() => ({ prismaMock: { coffeePageSettings: { upsert: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { logAuditMock } = vi.hoisted(() => ({ logAuditMock: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));

const { revalidatePathMock } = vi.hoisted(() => ({ revalidatePathMock: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/server", () => ({ after: vi.fn((task: () => unknown) => task()) }));

import { updateCoffeePageSettingsAction } from "@/lib/actions/coffee-settings";
import { COFFEE_PAGE_SETTINGS_ID } from "@/lib/queries/coffee-settings";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireDomainAdminMock.mockResolvedValue(session);
});

describe("updateCoffeePageSettingsAction", () => {
  it("requires the COFFEE domain", async () => {
    requireDomainAdminMock.mockRejectedValueOnce(new Error("Forbidden: admin access required"));
    await expect(updateCoffeePageSettingsAction({}, form({ heroTitle: "A", heroSubtitle: "B" }))).rejects.toThrow(
      /Forbidden/,
    );
    expect(requireDomainAdminMock).toHaveBeenCalledWith("COFFEE");
    expect(prismaMock.coffeePageSettings.upsert).not.toHaveBeenCalled();
  });

  it("returns field errors for blank fields without writing", async () => {
    const result = await updateCoffeePageSettingsAction({}, form({ heroTitle: " ", heroSubtitle: "" }));
    expect(result.fieldErrors?.heroTitle).toBeDefined();
    expect(result.fieldErrors?.heroSubtitle).toBeDefined();
    expect(prismaMock.coffeePageSettings.upsert).not.toHaveBeenCalled();
  });

  it("upserts the singleton row, logs it and revalidates both pages", async () => {
    const result = await updateCoffeePageSettingsAction({}, form({ heroTitle: " Меню ", heroSubtitle: "Кава" }));
    expect(result).toEqual({ success: true });
    expect(prismaMock.coffeePageSettings.upsert).toHaveBeenCalledWith({
      where: { id: COFFEE_PAGE_SETTINGS_ID },
      create: { id: COFFEE_PAGE_SETTINGS_ID, heroTitle: "Меню", heroSubtitle: "Кава" },
      update: { heroTitle: "Меню", heroSubtitle: "Кава" },
    });
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ action: "coffee.settings.update", entityId: COFFEE_PAGE_SETTINGS_ID }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/coffee");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/menu");
  });
});
