import { z } from "zod";

import { tournamentFormatValues, tournamentStatusValues } from "@/lib/validation/tournament";

export type { TournamentFormat, TournamentStatus } from "@/lib/validation/tournament";

// No court-surface field - padel courts are a standardized enclosed surface,
// unlike Tennis's CLAY/GRASS/HARD (see prisma/schema.prisma's PadelTournament
// comment). Otherwise identical to tournamentFormSchema.
export const padelTournamentFormSchema = z
  .object({
    name: z.string().trim().min(1, "Вкажіть назву турніру").max(150),
    description: z
      .union([z.literal(""), z.string().trim().max(2000)])
      .optional()
      .transform((value) => value || null),
    format: z.enum(tournamentFormatValues),
    status: z.enum(tournamentStatusValues),
    startDate: z.string().min(1, "Вкажіть дату початку"),
    endDate: z.string().min(1, "Вкажіть дату завершення"),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: "Дата завершення не може бути раніше дати початку",
    path: ["endDate"],
  });

export type PadelTournamentFormInput = z.infer<typeof padelTournamentFormSchema>;

export { TOURNAMENT_FORMAT_LABEL, TOURNAMENT_STATUS_LABEL, TOURNAMENT_STATUS_VARIANT } from "@/lib/validation/tournament";
