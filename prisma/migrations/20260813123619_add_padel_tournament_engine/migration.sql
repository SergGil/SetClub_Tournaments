-- CreateTable
CREATE TABLE "padel_tournaments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "format" "TournamentFormat" NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'UPCOMING',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "padel_tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "padel_tournament_groups" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "padel_tournament_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "padel_tournament_group_members" (
    "id" TEXT NOT NULL,
    "tournamentGroupId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "padel_tournament_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "padel_tournament_participants" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "seed" INTEGER,
    "group" INTEGER,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "padel_tournament_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "padel_tournament_teams" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "padel_tournament_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "padel_tournament_team_members" (
    "id" TEXT NOT NULL,
    "tournamentTeamId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "padel_tournament_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "padel_tournament_ties" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamAId" TEXT NOT NULL,
    "teamBId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "padel_tournament_ties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "padel_matches" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "round" TEXT,
    "matchType" "MatchType" NOT NULL,
    "scheduledDate" TIMESTAMP(3),
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "winnerSide" "MatchSide",
    "completedAt" TIMESTAMP(3),
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "walkover" BOOLEAN NOT NULL DEFAULT false,
    "tieId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "padel_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "padel_match_advancements" (
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

    CONSTRAINT "padel_match_advancements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "padel_match_players" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "side" "MatchSide" NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "padel_match_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "padel_match_sets" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "sideAGames" INTEGER NOT NULL,
    "sideBGames" INTEGER NOT NULL,
    "tiebreakSideAPoints" INTEGER,
    "tiebreakSideBPoints" INTEGER,

    CONSTRAINT "padel_match_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "padel_rating_snapshots" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "matchType" "MatchType" NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "rating" INTEGER NOT NULL,
    "spread" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "padel_rating_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "padel_tournament_groups_tournamentId_number_key" ON "padel_tournament_groups"("tournamentId", "number");

-- CreateIndex
CREATE INDEX "padel_tournament_group_members_playerId_idx" ON "padel_tournament_group_members"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "padel_tournament_group_members_tournamentGroupId_playerId_key" ON "padel_tournament_group_members"("tournamentGroupId", "playerId");

-- CreateIndex
CREATE INDEX "padel_tournament_participants_playerId_idx" ON "padel_tournament_participants"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "padel_tournament_participants_tournamentId_playerId_key" ON "padel_tournament_participants"("tournamentId", "playerId");

-- CreateIndex
CREATE INDEX "padel_tournament_teams_tournamentId_idx" ON "padel_tournament_teams"("tournamentId");

-- CreateIndex
CREATE INDEX "padel_tournament_team_members_tournamentTeamId_idx" ON "padel_tournament_team_members"("tournamentTeamId");

-- CreateIndex
CREATE INDEX "padel_tournament_team_members_playerId_idx" ON "padel_tournament_team_members"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "padel_tournament_team_members_tournamentId_playerId_key" ON "padel_tournament_team_members"("tournamentId", "playerId");

-- CreateIndex
CREATE INDEX "padel_tournament_ties_tournamentId_idx" ON "padel_tournament_ties"("tournamentId");

-- CreateIndex
CREATE INDEX "padel_tournament_ties_teamAId_idx" ON "padel_tournament_ties"("teamAId");

-- CreateIndex
CREATE INDEX "padel_tournament_ties_teamBId_idx" ON "padel_tournament_ties"("teamBId");

-- CreateIndex
CREATE INDEX "padel_matches_tournamentId_idx" ON "padel_matches"("tournamentId");

-- CreateIndex
CREATE INDEX "padel_matches_status_idx" ON "padel_matches"("status");

-- CreateIndex
CREATE INDEX "padel_matches_tieId_idx" ON "padel_matches"("tieId");

-- CreateIndex
CREATE INDEX "padel_match_advancements_tournamentId_idx" ON "padel_match_advancements"("tournamentId");

-- CreateIndex
CREATE INDEX "padel_match_advancements_sourceMatchId_idx" ON "padel_match_advancements"("sourceMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "padel_match_advancements_matchId_side_key" ON "padel_match_advancements"("matchId", "side");

-- CreateIndex
CREATE INDEX "padel_match_players_playerId_idx" ON "padel_match_players"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "padel_match_players_matchId_side_playerId_key" ON "padel_match_players"("matchId", "side", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "padel_match_sets_matchId_setNumber_key" ON "padel_match_sets"("matchId", "setNumber");

-- CreateIndex
CREATE INDEX "padel_rating_snapshots_playerId_matchType_asOfDate_idx" ON "padel_rating_snapshots"("playerId", "matchType", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "padel_rating_snapshots_playerId_matchType_tournamentId_key" ON "padel_rating_snapshots"("playerId", "matchType", "tournamentId");

-- AddForeignKey
ALTER TABLE "padel_tournaments" ADD CONSTRAINT "padel_tournaments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_tournament_groups" ADD CONSTRAINT "padel_tournament_groups_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "padel_tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_tournament_group_members" ADD CONSTRAINT "padel_tournament_group_members_tournamentGroupId_fkey" FOREIGN KEY ("tournamentGroupId") REFERENCES "padel_tournament_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_tournament_group_members" ADD CONSTRAINT "padel_tournament_group_members_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_tournament_participants" ADD CONSTRAINT "padel_tournament_participants_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "padel_tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_tournament_participants" ADD CONSTRAINT "padel_tournament_participants_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_tournament_teams" ADD CONSTRAINT "padel_tournament_teams_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "padel_tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_tournament_team_members" ADD CONSTRAINT "padel_tournament_team_members_tournamentTeamId_fkey" FOREIGN KEY ("tournamentTeamId") REFERENCES "padel_tournament_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_tournament_team_members" ADD CONSTRAINT "padel_tournament_team_members_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_tournament_ties" ADD CONSTRAINT "padel_tournament_ties_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "padel_tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_tournament_ties" ADD CONSTRAINT "padel_tournament_ties_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "padel_tournament_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_tournament_ties" ADD CONSTRAINT "padel_tournament_ties_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "padel_tournament_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_matches" ADD CONSTRAINT "padel_matches_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "padel_tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_matches" ADD CONSTRAINT "padel_matches_tieId_fkey" FOREIGN KEY ("tieId") REFERENCES "padel_tournament_ties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_match_advancements" ADD CONSTRAINT "padel_match_advancements_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "padel_tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_match_advancements" ADD CONSTRAINT "padel_match_advancements_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "padel_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_match_advancements" ADD CONSTRAINT "padel_match_advancements_sourceMatchId_fkey" FOREIGN KEY ("sourceMatchId") REFERENCES "padel_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_match_players" ADD CONSTRAINT "padel_match_players_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "padel_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_match_players" ADD CONSTRAINT "padel_match_players_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_match_sets" ADD CONSTRAINT "padel_match_sets_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "padel_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_rating_snapshots" ADD CONSTRAINT "padel_rating_snapshots_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padel_rating_snapshots" ADD CONSTRAINT "padel_rating_snapshots_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "padel_tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
