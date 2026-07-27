import { z } from "zod";

export const genderValues = ["MALE", "FEMALE"] as const;

export const GENDER_LABEL: Record<(typeof genderValues)[number], string> = {
  MALE: "Чоловіча",
  FEMALE: "Жіноча",
};

export const playerFormSchema = z.object({
  name: z.string().trim().min(1, "Вкажіть ім'я").max(100),
  email: z
    .union([z.literal(""), z.string().trim().email("Некоректний email")])
    .optional()
    .transform((value) => (value ? value.toLowerCase() : null)),
  gender: z
    .string()
    .optional()
    .transform((value) => (value === "MALE" || value === "FEMALE" ? value : null)),
});

export type PlayerFormInput = z.infer<typeof playerFormSchema>;
