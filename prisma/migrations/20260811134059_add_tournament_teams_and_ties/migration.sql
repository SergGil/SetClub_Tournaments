-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "tieId" TEXT;

-- CreateTable
CREATE TABLE "tournament_teams" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_team_members" (
    "id" TEXT NOT NULL,
    "tournamentTeamId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_ties" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamAId" TEXT NOT NULL,
    "teamBId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_ties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tournament_teams_tournamentId_idx" ON "tournament_teams"("tournamentId");

-- CreateIndex
CREATE INDEX "tournament_team_members_tournamentTeamId_idx" ON "tournament_team_members"("tournamentTeamId");

-- CreateIndex
CREATE INDEX "tournament_team_members_playerId_idx" ON "tournament_team_members"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_team_members_tournamentId_playerId_key" ON "tournament_team_members"("tournamentId", "playerId");

-- CreateIndex
CREATE INDEX "tournament_ties_tournamentId_idx" ON "tournament_ties"("tournamentId");

-- CreateIndex
CREATE INDEX "tournament_ties_teamAId_idx" ON "tournament_ties"("teamAId");

-- CreateIndex
CREATE INDEX "tournament_ties_teamBId_idx" ON "tournament_ties"("teamBId");

-- CreateIndex
CREATE INDEX "matches_tieId_idx" ON "matches"("tieId");

-- AddForeignKey
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_team_members" ADD CONSTRAINT "tournament_team_members_tournamentTeamId_fkey" FOREIGN KEY ("tournamentTeamId") REFERENCES "tournament_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_team_members" ADD CONSTRAINT "tournament_team_members_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_ties" ADD CONSTRAINT "tournament_ties_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_ties" ADD CONSTRAINT "tournament_ties_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "tournament_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_ties" ADD CONSTRAINT "tournament_ties_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "tournament_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_tieId_fkey" FOREIGN KEY ("tieId") REFERENCES "tournament_ties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
