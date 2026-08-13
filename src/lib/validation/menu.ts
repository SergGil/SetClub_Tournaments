import { z } from "zod";

export const menuLayoutValues = ["LIST", "CARDS"] as const;

export const MENU_LAYOUT_LABEL: Record<(typeof menuLayoutValues)[number], string> = {
  LIST: "Список (назва — ціна)",
  CARDS: "Картки (фото + опис)",
};

export const menuSectionFormSchema = z.object({
  name: z.string().trim().min(1, "Вкажіть назву секції").max(60),
  tagline: z
    .union([z.literal(""), z.string().trim().max(80, "Максимум 80 символів")])
    .optional()
    .transform((value) => (value ? value : null)),
  layout: z.enum(menuLayoutValues, { error: "Оберіть тип відображення" }),
  sortOrder: z.coerce.number().int().default(0),
});

export type MenuSectionFormInput = z.infer<typeof menuSectionFormSchema>;

export const menuItemFormSchema = z.object({
  sectionId: z.string().trim().min(1, "Оберіть секцію"),
  name: z.string().trim().min(1, "Вкажіть назву напою").max(80),
  price: z.coerce.number().int().min(0, "Ціна не може бути від'ємною").max(100_000),
  description: z
    .union([z.literal(""), z.string().trim().max(200, "Максимум 200 символів")])
    .optional()
    .transform((value) => (value ? value : null)),
  sortOrder: z.coerce.number().int().default(0),
});

export type MenuItemFormInput = z.infer<typeof menuItemFormSchema>;
