-- CreateEnum
CREATE TYPE "AdvancementSource" AS ENUM ('GROUP_RANK', 'MATCH_RESULT');

-- CreateEnum
CREATE TYPE "AdvancementOutcome" AS ENUM ('WINNER', 'LOSER');

-- CreateTable
CREATE TABLE "match_advancements" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "side" "MatchSide" NOT NULL,
    "source" "AdvancementSource" NOT NULL,
    "sourceGroup" INTEGER,
    "sourceRank" INTEGER,
    "sourceMatchId" TEXT,
    "outcome" "AdvancementOutcome",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_advancements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_advancements_tournamentId_idx" ON "match_advancements"("tournamentId");

-- CreateIndex
CREATE INDEX "match_advancements_sourceMatchId_idx" ON "match_advancements"("sourceMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "match_advancements_matchId_side_key" ON "match_advancements"("matchId", "side");

-- AddForeignKey
ALTER TABLE "match_advancements" ADD CONSTRAINT "match_advancements_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_advancements" ADD CONSTRAINT "match_advancements_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_advancements" ADD CONSTRAINT "match_advancements_sourceMatchId_fkey" FOREIGN KEY ("sourceMatchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
