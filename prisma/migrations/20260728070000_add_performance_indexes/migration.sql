-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "tournament_participants_playerId_idx" ON "tournament_participants"("playerId");

-- CreateIndex
CREATE INDEX "matches_tournamentId_idx" ON "matches"("tournamentId");

-- CreateIndex
CREATE INDEX "match_players_playerId_idx" ON "match_players"("playerId");
