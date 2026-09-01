export type MenuItem = {
  id: string;
  sectionId: string;
  name: string;
  price: number;
  description: string | null;
  sortOrder: number;
  active: boolean;
  photoKey: string | null;
};

/** Mirrors getMenuSections' include (src/lib/queries/menu.ts). */
export type MenuSection = {
  id: string;
  name: string;
  tagline: string | null;
  layout: string;
  sortOrder: number;
  active: boolean;
  items: MenuItem[];
};

export const MENU_LAYOUTS = ['LIST', 'CARDS'] as const;
export type MenuLayout = (typeof MENU_LAYOUTS)[number];
export const MENU_LAYOUT_LABEL: Record<MenuLayout, string> = {
  LIST: 'Список (назва — ціна)',
  CARDS: 'Картки (фото + опис)',
};

/** menuSectionFormSchema's shape (src/lib/validation/menu.ts) - price/sortOrder are z.coerce.number(), a numeric string works fine over JSON too. */
export type MenuSectionFormInput = { name: string; tagline: string; layout: MenuLayout; sortOrder: number };

/** menuItemFormSchema's shape. */
export type MenuItemFormInput = {
  sectionId: string;
  name: string;
  price: number;
  description: string;
  sortOrder: number;
};
