-- CreateEnum
CREATE TYPE "PlayerSport" AS ENUM ('TENNIS', 'PADEL', 'BOTH');

-- AlterTable
-- Existing rows all become TENNIS (the column default): at the time of this
-- migration no player has any Padel history, so there's nothing to backfill.
ALTER TABLE "players" ADD COLUMN     "sports" "PlayerSport" NOT NULL DEFAULT 'TENNIS';
