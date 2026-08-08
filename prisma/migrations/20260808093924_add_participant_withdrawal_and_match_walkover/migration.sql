-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "walkover" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tournament_participants" ADD COLUMN     "withdrawnAt" TIMESTAMP(3);
