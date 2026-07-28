-- CreateEnum
CREATE TYPE "CourtSurface" AS ENUM ('CLAY', 'GRASS', 'HARD');

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "surface" "CourtSurface" NOT NULL DEFAULT 'HARD';
