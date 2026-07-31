import { z } from "zod";

import { isTiebreakSet, isValidSetScore } from "@/lib/match-result";

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
  // Only meaningful for a 7-6/6-7 set - the losing side's tiebreak points.
  tiebreakLoserPoints: z.number().int().min(0).max(99).nullable().optional(),
});

export const scoreFormSchema = z
  .object({
    matchId: z.string().min(1),
    // Player conceded mid-match - the entered sets don't have to form a
    // complete, legal result, so skip the tennis-legality checks below.
    retired: z.boolean().optional().default(false),
    // A retirement's winner is whoever *didn't* retire, which the game count
    // alone can't tell us (the retiring player might have been ahead), so it
    // has to be picked explicitly rather than derived from the sets.
    retiredWinnerSide: z.enum(["A", "B"]).nullable().optional(),
    sets: z.array(setScoreSchema).max(5),
  })
  .superRefine((data, ctx) => {
    if (data.retired && !data.retiredWinnerSide) {
      ctx.addIssue({
        code: "custom",
        message: "Оберіть переможця матчу, завершеного зняттям",
        path: ["retiredWinnerSide"],
      });
    }

    data.sets.forEach((set, index) => {
      if (!data.retired) {
        // Sets 1-2 must be a full set; the 3rd set onward may instead be a
        // match tiebreak in formats where the club skips a full decisive set.
        const allowSuperTiebreak = index >= 2;
        if (!isValidSetScore(set, allowSuperTiebreak)) {
          ctx.addIssue({
            code: "custom",
            message: `Некоректний рахунок сету ${index + 1}: ${set.sideAGames}-${set.sideBGames}`,
            path: ["sets", index, "sideAGames"],
          });
        }

        if (
          set.tiebreakLoserPoints != null &&
          !isTiebreakSet(set.sideAGames, set.sideBGames)
        ) {
          ctx.addIssue({
            code: "custom",
            message: `Рахунок тайбрейку можна вказати лише для сету 7-6, а не для сету ${index + 1}`,
            path: ["sets", index, "tiebreakLoserPoints"],
          });
        }
      }
    });
  });
