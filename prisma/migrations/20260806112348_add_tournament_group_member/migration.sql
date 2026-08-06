-- CreateTable
CREATE TABLE "tournament_group_members" (
    "id" TEXT NOT NULL,
    "tournamentGroupId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tournament_group_members_playerId_idx" ON "tournament_group_members"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_group_members_tournamentGroupId_playerId_key" ON "tournament_group_members"("tournamentGroupId", "playerId");

-- AddForeignKey
ALTER TABLE "tournament_group_members" ADD CONSTRAINT "tournament_group_members_tournamentGroupId_fkey" FOREIGN KEY ("tournamentGroupId") REFERENCES "tournament_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_group_members" ADD CONSTRAINT "tournament_group_members_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
