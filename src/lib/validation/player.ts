import { z } from "zod";

export const genderValues = ["MALE", "FEMALE"] as const;

export const GENDER_LABEL: Record<(typeof genderValues)[number], string> = {
  MALE: "Чоловіча",
  FEMALE: "Жіноча",
};

export const playerSportValues = ["TENNIS", "PADEL", "BOTH"] as const;

export const PLAYER_SPORT_LABEL: Record<(typeof playerSportValues)[number], string> = {
  TENNIS: "Теніс",
  PADEL: "Падел",
  BOTH: "Теніс і падел",
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
  // undefined (not null) when missing/blank: the column is NOT NULL with a TENNIS
  // default, so on create Prisma applies the default and on update the field is simply
  // left untouched - which is also what the mobile client (no sports field yet) gets when
  // it PATCHes a player. A non-blank value that isn't a real sport is an error, not a
  // silent no-op (a typo would otherwise "save" successfully and change nothing).
  sports: z.preprocess(
    (value) => (value == null || value === "" ? undefined : value),
    z.enum(playerSportValues, { error: "Некоректний вид спорту" }).optional(),
  ),
  nickname: z
    .union([z.literal(""), z.string().trim().max(50, "Максимум 50 символів")])
    .optional()
    .transform((value) => (value ? value : null)),
});

export type PlayerFormInput = z.infer<typeof playerFormSchema>;
