-- CreateEnum
CREATE TYPE "RatingPool" AS ENUM ('GENERAL', 'WOMEN');

-- AlterTable
ALTER TABLE "rating_snapshots" ADD COLUMN     "pool" "RatingPool" NOT NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "isWomensOnly" BOOLEAN NOT NULL DEFAULT false;
