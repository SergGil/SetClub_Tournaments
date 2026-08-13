import { prisma } from "@/lib/db";

/** Every section with its items, in display order - used by both the public /coffee page and the admin list, so the two never drift apart. */
export function getMenuSections() {
  return prisma.menuSection.findMany({
    orderBy: { sortOrder: "asc" },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
}

/** Same as getMenuSections, minus inactive sections/items - what the public /coffee page actually renders. */
export async function getActiveMenuSections() {
  const sections = await prisma.menuSection.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: { items: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
  });
  return sections.filter((section) => section.items.length > 0);
}

export function getMenuSectionById(id: string) {
  return prisma.menuSection.findUnique({ where: { id } });
}

export function getMenuItemById(id: string) {
  return prisma.menuItem.findUnique({ where: { id } });
}

export type MenuSectionWithItems = Awaited<ReturnType<typeof getMenuSections>>[number];
