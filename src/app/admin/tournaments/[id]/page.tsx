import { notFound, redirect } from "next/navigation";

import { AddTournamentGroupDialog } from "@/components/admin/add-tournament-group-dialog";
import { CreateTieDialog } from "@/components/admin/create-tie-dialog";
import { DeleteTournamentButton } from "@/components/admin/delete-tournament-button";
import { DeleteTournamentGroupButton } from "@/components/admin/delete-tournament-group-button";
import { EditTournamentGroupDialog } from "@/components/admin/edit-tournament-group-dialog";
import { ResetTournamentButton } from "@/components/admin/reset-tournament-button";
import { TournamentForm } from "@/components/admin/tournament-form";
import { TournamentMatches } from "@/components/admin/tournament-matches";
import { TournamentRoster } from "@/components/admin/tournament-roster";
import { TournamentTeams } from "@/components/admin/tournament-teams";
import { TournamentPlayoffs } from "@/components/tournament-playoffs";
import { TournamentStandingsSection } from "@/components/tournament-standings";
import { TournamentTiesSection } from "@/components/tournament-ties-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createRubberAction, deleteTieAction } from "@/lib/actions/ties";
import { hasFinalMatch } from "@/lib/playoff-rounds";
import { isDomainAdmin } from "@/lib/permissions";
import { countLabel, MATCH_FORMS, PARTICIPANT_FORMS } from "@/lib/pluralize";
import { getTournamentMatches } from "@/lib/queries/matches";
import { getPlayers } from "@/lib/queries/players";
import { getTournamentTeams } from "@/lib/queries/tournament-teams";
import { getTournamentById } from "@/lib/queries/tournaments";
import { buildMatchPreview } from "@/lib/rating/match-preview";
import {
  getDoublesRatings,
  getDoublesSetClubPoints,
  getSinglesRatings,
  getSinglesSetClubPoints,
  ROLLING_SEASON,
} from "@/lib/rating/ratings-data";
import { getTournamentStandingsRows } from "@/lib/tournament-standings";
import { getTeamTieStandings } from "@/lib/tournament-ties";
import type { TeamTieStandings } from "@/lib/tournament-ties";

export default async function AdminTournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isDomainAdmin("TENNIS"))) {
    redirect("/admin");
  }

  const { id } = await params;
  // getTournamentStandingsRows needs the tournament's format/participants, so
  // it can't start until getTournamentById resolves - but getPlayers and
  // getTournamentMatches don't depend on it, so run those alongside it
  // instead of waiting for it first (each remote DB round trip adds up).
  const [
    tournament,
    allPlayers,
    matches,
    singlesRatings,
    doublesRatings,
    singlesSetClubPoints,
    doublesSetClubPoints,
  ] = await Promise.all([
    getTournamentById(id),
    getPlayers(),
    getTournamentMatches(id),
    getSinglesRatings(),
    getDoublesRatings(),
    getSinglesSetClubPoints(ROLLING_SEASON),
    getDoublesSetClubPoints(ROLLING_SEASON),
  ]);
  if (!tournament) notFound();

  const emptyTeamTieStandings: TeamTieStandings = { rows: [], roundRobinDone: false, ties: [] };
  const [standings, teams, teamTieStandings] = await Promise.all([
    getTournamentStandingsRows(id, tournament.format, tournament.participants),
    tournament.format === "MIXED" ? getTournamentTeams(id) : Promise.resolve([]),
    tournament.format === "MIXED" ? getTeamTieStandings(id) : Promise.resolve(emptyTeamTieStandings),
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
  // A withdrawn participant (see withdrawParticipantAction) is excluded from
  // every "who can this new match/group/draw involve" pool below - they
  // stay visible (with their real record) only in TournamentRoster, which
  // gets the unfiltered `tournament.participants` further down.
  const activeParticipants = tournament.participants.filter((p) => p.withdrawnAt == null);
  const roster = activeParticipants.map((p) => p.player);
  const seededCount = activeParticipants.filter((p) => p.seed !== null).length;
  const unseededCount = activeParticipants.length - seededCount;
  const groupCounts = activeParticipants.reduce<Record<number, number>>((acc, p) => {
    if (p.group != null) acc[p.group] = (acc[p.group] ?? 0) + 1;
    return acc;
  }, {});
  const customGroupNames = new Map(tournament.groups.map((g) => [g.number, g.name]));
  // For EditTournamentGroupDialog's pre-selected player picker - StandingsGroup's
  // own `rows` can't be reused for this (a DOUBLES row's key is a "id1+id2"
  // team key, not one playerId per member), so this reads straight off the
  // TournamentGroup's own membership instead.
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
          <ResetTournamentButton
            id={tournament.id}
            name={tournament.name}
            completedMatchCount={completedMatchCount}
            disabled={!hasAnythingToReset}
          />
          <DeleteTournamentButton
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
          <TournamentForm tournament={tournament} />
        </TabsContent>
        <TabsContent value="roster" className="pt-4">
          <TournamentRoster
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
              <AddTournamentGroupDialog tournamentId={tournament.id} participants={roster} />
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
                  <EditTournamentGroupDialog
                    tournamentId={tournament.id}
                    groupId={group.id}
                    groupName={group.label}
                    memberIds={groupMemberIdsByGroupId.get(group.id) ?? []}
                    participants={roster}
                  />
                  <DeleteTournamentGroupButton
                    tournamentId={tournament.id}
                    groupId={group.id}
                    groupName={group.label}
                  />
                </div>
              ) : null
            }
          />
          <TournamentPlayoffs
            matches={matches}
            singlesRankById={singlesRankById}
            doublesRankById={doublesRankById}
          />
        </TabsContent>
        <TabsContent value="matches" className="pt-4">
          <TournamentMatches
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
            <TournamentTeams tournamentId={tournament.id} teams={teams} participants={roster} />
            <TournamentTiesSection
              tournamentId={tournament.id}
              ties={teamTieStandings.ties}
              standingsRows={teamTieStandings.rows}
              roundRobinDone={teamTieStandings.roundRobinDone}
              teams={teams}
              canManage
              createTieDialog={CreateTieDialog}
              deleteTieAction={deleteTieAction}
              rubberAction={createRubberAction}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
