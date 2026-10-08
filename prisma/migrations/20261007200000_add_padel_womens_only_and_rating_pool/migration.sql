-- AlterTable
ALTER TABLE "padel_tournaments" ADD COLUMN     "isWomensOnly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "padel_rating_snapshots" ADD COLUMN     "pool" "RatingPool" NOT NULL DEFAULT 'GENERAL';
