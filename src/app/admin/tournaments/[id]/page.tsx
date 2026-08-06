import { notFound } from "next/navigation";

import { AddTournamentGroupDialog } from "@/components/admin/add-tournament-group-dialog";
import { DeleteTournamentButton } from "@/components/admin/delete-tournament-button";
import { DeleteTournamentGroupButton } from "@/components/admin/delete-tournament-group-button";
import { TournamentForm } from "@/components/admin/tournament-form";
import { TournamentMatches } from "@/components/admin/tournament-matches";
import { TournamentRoster } from "@/components/admin/tournament-roster";
import { TournamentPlayoffs } from "@/components/tournament-playoffs";
import { TournamentStandingsSection } from "@/components/tournament-standings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasFinalMatch } from "@/lib/playoff-rounds";
import { countLabel, MATCH_FORMS, PARTICIPANT_FORMS } from "@/lib/pluralize";
import { getTournamentMatches } from "@/lib/queries/matches";
import { getPlayers } from "@/lib/queries/players";
import { getTournamentById } from "@/lib/queries/tournaments";
import { buildMatchPreview } from "@/lib/rating/match-preview";
import {
  getDoublesRatings,
  getSinglesRatings,
  getSinglesRatingSnapshotsByTournament,
} from "@/lib/rating/ratings-data";
import { getTournamentStandingsRows } from "@/lib/tournament-standings";

export default async function AdminTournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // getTournamentStandingsRows needs the tournament's format/participants, so
  // it can't start until getTournamentById resolves - but getPlayers and
  // getTournamentMatches don't depend on it, so run those alongside it
  // instead of waiting for it first (each remote DB round trip adds up).
  const [tournament, allPlayers, matches, singlesRatings, doublesRatings, singlesRatingSnapshots] =
    await Promise.all([
      getTournamentById(id),
      getPlayers(),
      getTournamentMatches(id),
      getSinglesRatings(),
      getDoublesRatings(),
      getSinglesRatingSnapshotsByTournament(),
    ]);
  if (!tournament) notFound();

  const standings = await getTournamentStandingsRows(id, tournament.format, tournament.participants);

  const singlesRatingById = new Map(singlesRatings.map((r) => [r.playerId, r.rating]));
  const doublesRatingById = new Map(doublesRatings.map((r) => [r.playerId, r.rating]));
  const singlesRankById = Object.fromEntries(singlesRatings.map((r, i) => [r.playerId, i + 1]));
  const doublesRankById = Object.fromEntries(doublesRatings.map((r, i) => [r.playerId, i + 1]));
  const previewByMatchId = Object.fromEntries(
    matches
      .filter((m) => m.status === "SCHEDULED")
      .map((m) => [m.id, buildMatchPreview(m, singlesRatingById, doublesRatingById)]),
  );

  const rosterPlayerIds = new Set(tournament.participants.map((p) => p.playerId));
  const availablePlayers = allPlayers.filter((p) => !rosterPlayerIds.has(p.id));
  const roster = tournament.participants.map((p) => p.player);
  const hasSeededPlayer = tournament.participants.some((p) => p.seed !== null);
  const seededCount = tournament.participants.filter((p) => p.seed !== null).length;
  const unseededCount = tournament.participants.length - seededCount;
  const groupCounts = tournament.participants.reduce<Record<number, number>>((acc, p) => {
    if (p.group != null) acc[p.group] = (acc[p.group] ?? 0) + 1;
    return acc;
  }, {});
  const customGroupNames = new Map(tournament.groups.map((g) => [g.number, g.name]));
  const tournamentHasFinal = hasFinalMatch(matches);
  const completedMatchCount = matches.filter((m) => m.status === "COMPLETED").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold break-words">{tournament.name}</h2>
        <DeleteTournamentButton
          id={tournament.id}
          name={tournament.name}
          completedMatchCount={completedMatchCount}
        />
      </div>

      <Tabs defaultValue="info">
        <TabsList className="w-full overflow-x-auto overflow-y-hidden sm:w-fit">
          <TabsTrigger value="info">Інформація</TabsTrigger>
          <TabsTrigger value="roster">
            {countLabel(tournament.participants.length, PARTICIPANT_FORMS)}
          </TabsTrigger>
          <TabsTrigger value="matches">{countLabel(matches.length, MATCH_FORMS)}</TabsTrigger>
          <TabsTrigger value="standings">Таблиця</TabsTrigger>
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
            emptyMessage={
              tournament.format === "DOUBLES" ? "Пар ще не сформовано." : "Учасників ще не додано."
            }
            renderGroupHeaderExtra={(group) =>
              group.id ? (
                <DeleteTournamentGroupButton
                  tournamentId={tournament.id}
                  groupId={group.id}
                  groupName={group.label}
                />
              ) : null
            }
          />
          <TournamentPlayoffs
            matches={matches}
            singlesRatingSnapshots={singlesRatingSnapshots}
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
            hasSeededPlayer={hasSeededPlayer}
            seededCount={seededCount}
            unseededCount={unseededCount}
            groupCounts={groupCounts}
            customGroupNames={customGroupNames}
            previewByMatchId={previewByMatchId}
            singlesRatingSnapshots={singlesRatingSnapshots}
            singlesRankById={singlesRankById}
            doublesRankById={doublesRankById}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
