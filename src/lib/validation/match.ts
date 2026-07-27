import { z } from "zod";

export const matchTypeValues = ["SINGLES", "DOUBLES"] as const;

const playerIdList = z.array(z.string().min(1)).min(1).max(2);

export const matchFormSchema = z
  .object({
    tournamentId: z.string().min(1),
    matchType: z.enum(matchTypeValues),
    round: z
      .union([z.literal(""), z.string().trim().max(100)])
      .optional()
      .transform((value) => value || null),
    scheduledDate: z
      .union([z.literal(""), z.string()])
      .optional()
      .transform((value) => value || null),
    sideAPlayerIds: playerIdList,
    sideBPlayerIds: playerIdList,
  })
  .refine((data) => data.sideAPlayerIds.length === data.sideBPlayerIds.length, {
    message: "Кількість гравців має бути однаковою з обох сторін",
    path: ["sideBPlayerIds"],
  })
  .refine(
    (data) =>
      (data.matchType === "SINGLES" && data.sideAPlayerIds.length === 1) ||
      (data.matchType === "DOUBLES" && data.sideAPlayerIds.length === 2),
    {
      message: "Для одиночного матчу потрібен 1 гравець на сторону, для парного — 2",
      path: ["sideAPlayerIds"],
    },
  )
  .refine(
    (data) => {
      const all = [...data.sideAPlayerIds, ...data.sideBPlayerIds];
      return new Set(all).size === all.length;
    },
    { message: "Гравець не може грати за обидві сторони одночасно", path: ["sideBPlayerIds"] },
  );

const setScoreSchema = z.object({
  sideAGames: z.number().int().min(0).max(99),
  sideBGames: z.number().int().min(0).max(99),
});

export const scoreFormSchema = z.object({
  matchId: z.string().min(1),
  sets: z.array(setScoreSchema).max(5),
});
