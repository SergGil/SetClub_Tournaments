import { notFound, redirect } from "next/navigation";

import { AddPadelTournamentGroupDialog } from "@/components/admin/add-padel-tournament-group-dialog";
import { CreatePadelTieDialog } from "@/components/admin/create-padel-tie-dialog";
import { DeletePadelTournamentButton } from "@/components/admin/delete-padel-tournament-button";
import { DeletePadelTournamentGroupButton } from "@/components/admin/delete-padel-tournament-group-button";
import { EditPadelTournamentGroupDialog } from "@/components/admin/edit-padel-tournament-group-dialog";
import { PadelTournamentForm } from "@/components/admin/padel-tournament-form";
import { PadelTournamentMatches } from "@/components/admin/padel-tournament-matches";
import { PadelTournamentRoster } from "@/components/admin/padel-tournament-roster";
import { PadelTournamentTeams } from "@/components/admin/padel-tournament-teams";
import { ResetPadelTournamentButton } from "@/components/admin/reset-padel-tournament-button";
import { TournamentPlayoffs } from "@/components/tournament-playoffs";
import { TournamentStandingsSection } from "@/components/tournament-standings";
import { TournamentTiesSection } from "@/components/tournament-ties-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createPadelRubberAction, deletePadelTieAction } from "@/lib/actions/padel-ties";
import { hasFinalMatch } from "@/lib/playoff-rounds";
import { isDomainAdmin } from "@/lib/permissions";
import { countLabel, MATCH_FORMS, PARTICIPANT_FORMS } from "@/lib/pluralize";
import { getPadelTournamentMatches } from "@/lib/queries/padel-matches";
import { getPadelTournamentTeams } from "@/lib/queries/padel-tournament-teams";
import { getPadelTournamentById } from "@/lib/queries/padel-tournaments";
import { getPlayers } from "@/lib/queries/players";
import { buildMatchPreview } from "@/lib/rating/match-preview";
import {
  getPadelDoublesRatings,
  getPadelDoublesSetClubPoints,
  getPadelSinglesRatings,
  getPadelSinglesSetClubPoints,
  PADEL_ROLLING_SEASON,
} from "@/lib/rating/padel-ratings-data";
import { getPadelTournamentStandingsRows } from "@/lib/padel-tournament-standings";
import { getPadelTeamTieStandings } from "@/lib/padel-tournament-ties";
import type { PadelTeamTieStandings } from "@/lib/padel-tournament-ties";

export default async function AdminPadelTournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isDomainAdmin("PADEL"))) {
    redirect("/admin");
  }

  const { id } = await params;
  const [
    tournament,
    allPlayers,
    matches,
    singlesRatings,
    doublesRatings,
    singlesSetClubPoints,
    doublesSetClubPoints,
  ] = await Promise.all([
    getPadelTournamentById(id),
    getPlayers(),
    getPadelTournamentMatches(id),
    getPadelSinglesRatings(),
    getPadelDoublesRatings(),
    getPadelSinglesSetClubPoints(PADEL_ROLLING_SEASON),
    getPadelDoublesSetClubPoints(PADEL_ROLLING_SEASON),
  ]);
  if (!tournament) notFound();

  const emptyTeamTieStandings: PadelTeamTieStandings = { rows: [], roundRobinDone: false, ties: [] };
  const [standings, teams, teamTieStandings] = await Promise.all([
    getPadelTournamentStandingsRows(id, tournament.format, tournament.participants),
    tournament.format === "MIXED" ? getPadelTournamentTeams(id) : Promise.resolve([]),
    tournament.format === "MIXED" ? getPadelTeamTieStandings(id) : Promise.resolve(emptyTeamTieStandings),
  ]);

  const singlesRatingById = new Map(singlesRatings.map((r) => [r.playerId, r.rating]));
  const doublesRatingById = new Map(doublesRatings.map((r) => [r.playerId, r.rating]));
  const singlesPointsById = new Map(singlesSetClubPoints.map((r) => [r.playerId, r.points]));
  const doublesPointsById = new Map(doublesSetClubPoints.map((r) => [r.playerId, r.points]));
  const singlesRankById = Object.fromEntries(singlesSetClubPoints.map((r, i) => [r.playerId, i + 1]));
  const doublesRankById = Object.fromEntries(doublesSetClubPoints.map((r, i) => [r.playerId, i + 1]));
  const previewByMatchId = Object.fromEntries(
    matches
      .filter((m) => m.status === "SCHEDULED")
      .map((m) => [
        m.id,
        buildMatchPreview(m, singlesRatingById, doublesRatingById, singlesPointsById, doublesPointsById),
      ]),
  );

  const rosterPlayerIds = new Set(tournament.participants.map((p) => p.playerId));
  const availablePlayers = allPlayers.filter((p) => !rosterPlayerIds.has(p.id));
  const activeParticipants = tournament.participants.filter((p) => p.withdrawnAt == null);
  const roster = activeParticipants.map((p) => p.player);
  const seededCount = activeParticipants.filter((p) => p.seed !== null).length;
  const unseededCount = activeParticipants.length - seededCount;
  const groupCounts = activeParticipants.reduce<Record<number, number>>((acc, p) => {
    if (p.group != null) acc[p.group] = (acc[p.group] ?? 0) + 1;
    return acc;
  }, {});
  const customGroupNames = new Map(tournament.groups.map((g) => [g.number, g.name]));
  const groupMemberIdsByGroupId = new Map(
    tournament.groups.map((g) => [g.id, g.members.map((m) => m.playerId)]),
  );
  const tournamentHasFinal = hasFinalMatch(matches);
  const completedMatchCount = matches.filter((m) => m.status === "COMPLETED").length;
  const hasAnythingToReset =
    matches.length > 0 ||
    tournament.groups.length > 0 ||
    tournament.participants.some((p) => p.group != null);
  const scheduledMatchCountByPlayerId = matches
    .filter((m) => m.status === "SCHEDULED")
    .reduce<Record<string, number>>((acc, m) => {
      for (const p of m.players) acc[p.playerId] = (acc[p.playerId] ?? 0) + 1;
      return acc;
    }, {});

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold break-words">{tournament.name}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ResetPadelTournamentButton
            id={tournament.id}
            name={tournament.name}
            completedMatchCount={completedMatchCount}
            disabled={!hasAnythingToReset}
          />
          <DeletePadelTournamentButton
            id={tournament.id}
            name={tournament.name}
            completedMatchCount={completedMatchCount}
          />
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList className="w-full overflow-x-auto overflow-y-hidden sm:w-fit">
          <TabsTrigger value="info">Інформація</TabsTrigger>
          <TabsTrigger value="roster">
            {countLabel(tournament.participants.length, PARTICIPANT_FORMS)}
          </TabsTrigger>
          <TabsTrigger value="matches">{countLabel(matches.length, MATCH_FORMS)}</TabsTrigger>
          <TabsTrigger value="standings">Таблиця</TabsTrigger>
          {tournament.format === "MIXED" && <TabsTrigger value="teams">Команди</TabsTrigger>}
        </TabsList>
        <TabsContent value="info" className="pt-4">
          <PadelTournamentForm tournament={tournament} />
        </TabsContent>
        <TabsContent value="roster" className="pt-4">
          <PadelTournamentRoster
            tournamentId={tournament.id}
            format={tournament.format}
            participants={tournament.participants}
            availablePlayers={availablePlayers}
            scheduledMatchCountByPlayerId={scheduledMatchCountByPlayerId}
          />
        </TabsContent>
        <TabsContent value="standings" className="flex flex-col gap-8 pt-4">
          {(tournament.format === "SINGLES" || tournament.format === "DOUBLES") && (
            <div className="flex justify-end">
              <AddPadelTournamentGroupDialog tournamentId={tournament.id} participants={roster} />
            </div>
          )}
          <TournamentStandingsSection
            standings={standings}
            showWinner={tournament.status === "COMPLETED"}
            hasPlayoffFinal={tournamentHasFinal}
            tournamentId={tournament.id}
            tournamentName={tournament.name}
            emptyMessage={
              tournament.format === "DOUBLES" ? "Пар ще не сформовано." : "Учасників ще не додано."
            }
            renderGroupHeaderExtra={(group) =>
              group.id ? (
                <div className="flex items-center gap-1">
                  <EditPadelTournamentGroupDialog
                    tournamentId={tournament.id}
                    groupId={group.id}
                    groupName={group.label}
                    memberIds={groupMemberIdsByGroupId.get(group.id) ?? []}
                    participants={roster}
                  />
                  <DeletePadelTournamentGroupButton
                    tournamentId={tournament.id}
                    groupId={group.id}
                    groupName={group.label}
                  />
                </div>
              ) : null
            }
            sport="PADEL"
          />
          <TournamentPlayoffs
            matches={matches}
            singlesRankById={singlesRankById}
            doublesRankById={doublesRankById}
            sport="PADEL"
          />
        </TabsContent>
        <TabsContent value="matches" className="pt-4">
          <PadelTournamentMatches
            tournamentId={tournament.id}
            format={tournament.format}
            roster={roster}
            matches={matches}
            seededCount={seededCount}
            unseededCount={unseededCount}
            groupCounts={groupCounts}
            customGroupNames={customGroupNames}
            previewByMatchId={previewByMatchId}
            singlesRankById={singlesRankById}
            doublesRankById={doublesRankById}
          />
        </TabsContent>
        {tournament.format === "MIXED" && (
          <TabsContent value="teams" className="flex flex-col gap-8 pt-4">
            <PadelTournamentTeams tournamentId={tournament.id} teams={teams} participants={roster} />
            <TournamentTiesSection
              tournamentId={tournament.id}
              ties={teamTieStandings.ties}
              standingsRows={teamTieStandings.rows}
              roundRobinDone={teamTieStandings.roundRobinDone}
              teams={teams}
              canManage
              createTieDialog={CreatePadelTieDialog}
              deleteTieAction={deletePadelTieAction}
              rubberAction={createPadelRubberAction}
              sport="PADEL"
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
