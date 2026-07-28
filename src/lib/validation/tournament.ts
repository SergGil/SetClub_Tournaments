import { z } from "zod";

export const tournamentFormatValues = ["SINGLES", "DOUBLES", "MIXED"] as const;
export const tournamentStatusValues = ["UPCOMING", "ONGOING", "COMPLETED"] as const;
export const courtSurfaceValues = ["CLAY", "GRASS", "HARD"] as const;

export type TournamentFormat = (typeof tournamentFormatValues)[number];
export type TournamentStatus = (typeof tournamentStatusValues)[number];
export type CourtSurface = (typeof courtSurfaceValues)[number];

export const tournamentFormSchema = z
  .object({
    name: z.string().trim().min(1, "Вкажіть назву турніру").max(150),
    description: z
      .union([z.literal(""), z.string().trim().max(2000)])
      .optional()
      .transform((value) => value || null),
    format: z.enum(tournamentFormatValues),
    status: z.enum(tournamentStatusValues),
    surface: z.enum(courtSurfaceValues),
    startDate: z.string().min(1, "Вкажіть дату початку"),
    endDate: z.string().min(1, "Вкажіть дату завершення"),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: "Дата завершення не може бути раніше дати початку",
    path: ["endDate"],
  });

export type TournamentFormInput = z.infer<typeof tournamentFormSchema>;

export const TOURNAMENT_FORMAT_LABEL: Record<(typeof tournamentFormatValues)[number], string> = {
  SINGLES: "Одиночний (1×1)",
  DOUBLES: "Парний (2×2)",
  MIXED: "Змішаний",
};

export const TOURNAMENT_STATUS_LABEL: Record<(typeof tournamentStatusValues)[number], string> = {
  UPCOMING: "Заплановано",
  ONGOING: "Триває",
  COMPLETED: "Завершено",
};

export const TOURNAMENT_STATUS_VARIANT: Record<
  (typeof tournamentStatusValues)[number],
  "info" | "warning" | "secondary"
> = {
  UPCOMING: "info",
  ONGOING: "warning",
  COMPLETED: "secondary",
};

export const COURT_SURFACE_LABEL: Record<(typeof courtSurfaceValues)[number], string> = {
  CLAY: "Ґрунт",
  GRASS: "Трава",
  HARD: "Хард",
};

export const COURT_SURFACE_VARIANT: Record<
  (typeof courtSurfaceValues)[number],
  "orange" | "green" | "slate"
> = {
  CLAY: "orange",
  GRASS: "green",
  HARD: "slate",
};
