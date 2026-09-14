import { prisma } from "@/lib/db";

/** Fixed id for the CoffeePageSettings singleton row - see prisma/schema.prisma. */
export const COFFEE_PAGE_SETTINGS_ID = "coffee-hero";

const DEFAULTS = {
  heroTitle: "Меню",
  heroSubtitle: "Спешелті кава, чай і матча в затишному просторі клубу.",
};

/** The /coffee page's hero title/subtitle - falls back to the original hardcoded copy until an admin saves the form once (actions/coffee-settings.ts). */
export async function getCoffeePageSettings() {
  const row = await prisma.coffeePageSettings.findUnique({ where: { id: COFFEE_PAGE_SETTINGS_ID } });
  return { heroTitle: row?.heroTitle ?? DEFAULTS.heroTitle, heroSubtitle: row?.heroSubtitle ?? DEFAULTS.heroSubtitle };
}
