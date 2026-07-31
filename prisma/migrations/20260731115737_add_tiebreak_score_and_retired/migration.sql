-- AlterTable
ALTER TABLE "match_sets" ADD COLUMN     "tiebreakLoserPoints" INTEGER;

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "retired" BOOLEAN NOT NULL DEFAULT false;
