import { z } from "zod";

export const coffeePageSettingsFormSchema = z.object({
  heroTitle: z.string().trim().min(1, "Вкажіть заголовок").max(60),
  heroSubtitle: z.string().trim().min(1, "Вкажіть підзаголовок").max(200),
});

export type CoffeePageSettingsFormInput = z.infer<typeof coffeePageSettingsFormSchema>;
