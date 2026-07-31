-- AlterTable: split the loser-only tiebreak convention into an explicit
-- score for both sides, so the UI can display the full breaker (e.g. 7-5)
-- instead of just the loser's points.
ALTER TABLE "match_sets" ADD COLUMN "tiebreakSideAPoints" INTEGER;
ALTER TABLE "match_sets" ADD COLUMN "tiebreakSideBPoints" INTEGER;

-- Backfill existing rows from the old convention: the winner's breaker
-- points were implied (7 if the loser got <=5, else loserPoints + 2),
-- attributed to whichever side actually has 7 games in the set.
UPDATE "match_sets"
SET
  "tiebreakSideAPoints" = CASE
    WHEN "sideAGames" = 7 THEN CASE WHEN "tiebreakLoserPoints" <= 5 THEN 7 ELSE "tiebreakLoserPoints" + 2 END
    WHEN "sideBGames" = 7 THEN "tiebreakLoserPoints"
    ELSE NULL
  END,
  "tiebreakSideBPoints" = CASE
    WHEN "sideBGames" = 7 THEN CASE WHEN "tiebreakLoserPoints" <= 5 THEN 7 ELSE "tiebreakLoserPoints" + 2 END
    WHEN "sideAGames" = 7 THEN "tiebreakLoserPoints"
    ELSE NULL
  END
WHERE "tiebreakLoserPoints" IS NOT NULL;

-- AlterTable
ALTER TABLE "match_sets" DROP COLUMN "tiebreakLoserPoints";
