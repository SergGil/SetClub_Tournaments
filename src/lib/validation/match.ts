import { z } from "zod";

import { isTiebreakSet, isValidSetScore, isValidSetTiebreak } from "@/lib/match-result";
import { canonicalizeRound } from "@/lib/playoff-rounds";

export const matchTypeValues = ["SINGLES", "DOUBLES"] as const;

// min(0) - a match can be created as a playoff placeholder before its
// participants are known (e.g. "winner of semifinal 1"), filled in later
// via updateMatchAction once the real players are decided.
const playerIdList = z.array(z.string().min(1)).min(0).max(2);

export const matchFormSchema = z
  .object({
    tournamentId: z.string().min(1),
    matchType: z.enum(matchTypeValues),
    round: z
      .union([z.literal(""), z.string().trim().max(100)])
      .optional()
      .transform((value) => canonicalizeRound(value || null)),
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
      data.sideAPlayerIds.length <= (data.matchType === "SINGLES" ? 1 : 2),
    {
      message: "Для одиночного матчу можна вказати не більше 1 гравця на сторону, для парного — не більше 2",
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
  // Only meaningful for a 7-6/6-7 set - the full tiebreak point score.
  tiebreakSideAPoints: z.number().int().min(0).max(99).nullable().optional(),
  tiebreakSideBPoints: z.number().int().min(0).max(99).nullable().optional(),
});

export const scoreFormSchema = z
  .object({
    matchId: z.string().min(1),
    // The match's updatedAt as of when the score form was opened - lets
    // saveScoreAction detect that someone else changed the match in the
    // meantime (see the conflict check there) instead of silently
    // overwriting their edit.
    expectedUpdatedAt: z.string().min(1),
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
        // Sets 1-2 must be a full set; only the actual final/deciding set
        // (3rd or later) may instead be a match tiebreak, in formats where
        // the club skips a full decisive set - an earlier set that happens
        // to sit at index >= 2 (e.g. set 3 of an eventual 5) still has to be
        // a real set, since the match wasn't decided there.
        const allowSuperTiebreak = index >= 2 && index === data.sets.length - 1;
        if (!isValidSetScore(set, allowSuperTiebreak)) {
          ctx.addIssue({
            code: "custom",
            message: `Некоректний рахунок сету ${index + 1}: ${set.sideAGames}-${set.sideBGames}`,
            path: ["sets", index, "sideAGames"],
          });
        }

        const tiebreakA = set.tiebreakSideAPoints;
        const tiebreakB = set.tiebreakSideBPoints;
        if (tiebreakA != null || tiebreakB != null) {
          if (!isTiebreakSet(set.sideAGames, set.sideBGames)) {
            ctx.addIssue({
              code: "custom",
              message: `Рахунок тайбрейку можна вказати лише для сету 7-6, а не для сету ${index + 1}`,
              path: ["sets", index, "tiebreakSideAPoints"],
            });
          } else if (tiebreakA == null || tiebreakB == null) {
            ctx.addIssue({
              code: "custom",
              message: `Вкажіть рахунок тайбрейку для обох сторін у сеті ${index + 1}`,
              path: ["sets", index, "tiebreakSideAPoints"],
            });
          } else if (!isValidSetTiebreak(set, tiebreakA, tiebreakB)) {
            ctx.addIssue({
              code: "custom",
              message: `Некоректний рахунок тайбрейку сету ${index + 1}: ${tiebreakA}-${tiebreakB}`,
              path: ["sets", index, "tiebreakSideAPoints"],
            });
          }
        }
      }
    });
  });
