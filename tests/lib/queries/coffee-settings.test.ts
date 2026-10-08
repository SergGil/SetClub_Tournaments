import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({ prismaMock: { coffeePageSettings: { findUnique: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { COFFEE_PAGE_SETTINGS_ID, getCoffeePageSettings } from "@/lib/queries/coffee-settings";

beforeEach(() => vi.clearAllMocks());

describe("getCoffeePageSettings", () => {
  it("falls back to the original hardcoded copy until an admin saves once", async () => {
    prismaMock.coffeePageSettings.findUnique.mockResolvedValueOnce(null);
    const settings = await getCoffeePageSettings();
    expect(prismaMock.coffeePageSettings.findUnique).toHaveBeenCalledWith({ where: { id: COFFEE_PAGE_SETTINGS_ID } });
    expect(settings.heroTitle).toBe("Меню");
    expect(settings.heroSubtitle).toContain("кава");
  });

  it("returns the saved values when the row exists", async () => {
    prismaMock.coffeePageSettings.findUnique.mockResolvedValueOnce({
      heroTitle: "Кав'ярня",
      heroSubtitle: "Тут смачно",
    });
    expect(await getCoffeePageSettings()).toEqual({ heroTitle: "Кав'ярня", heroSubtitle: "Тут смачно" });
  });
});
