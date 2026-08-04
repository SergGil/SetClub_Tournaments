-- CreateTable
CREATE TABLE "rating_snapshots" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "matchType" "MatchType" NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "rating" INTEGER NOT NULL,
    "spread" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rating_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rating_snapshots_playerId_matchType_asOfDate_idx" ON "rating_snapshots"("playerId", "matchType", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "rating_snapshots_playerId_matchType_tournamentId_key" ON "rating_snapshots"("playerId", "matchType", "tournamentId");

-- AddForeignKey
ALTER TABLE "rating_snapshots" ADD CONSTRAINT "rating_snapshots_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_snapshots" ADD CONSTRAINT "rating_snapshots_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
