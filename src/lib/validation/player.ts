import { z } from "zod";

export const playerFormSchema = z.object({
  name: z.string().trim().min(1, "Вкажіть ім'я").max(100),
  email: z
    .union([z.literal(""), z.string().trim().email("Некоректний email")])
    .optional()
    .transform((value) => (value ? value.toLowerCase() : null)),
});

export type PlayerFormInput = z.infer<typeof playerFormSchema>;
