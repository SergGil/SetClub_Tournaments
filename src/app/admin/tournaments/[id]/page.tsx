import { notFound } from "next/navigation";

import { DeleteTournamentButton } from "@/components/admin/delete-tournament-button";
import { TournamentForm } from "@/components/admin/tournament-form";
import { TournamentMatches } from "@/components/admin/tournament-matches";
import { TournamentRoster } from "@/components/admin/tournament-roster";
import { TournamentStandings } from "@/components/tournament-standings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { countLabel, MATCH_FORMS, PARTICIPANT_FORMS } from "@/lib/pluralize";
import { getTournamentMatches } from "@/lib/queries/matches";
import { getPlayers } from "@/lib/queries/players";
import { getTournamentById } from "@/lib/queries/tournaments";
import { getTournamentStandingsRows } from "@/lib/tournament-standings";

export default async function AdminTournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await getTournamentById(id);
  if (!tournament) notFound();

  const [allPlayers, matches, standingsRows] = await Promise.all([
    getPlayers(),
    getTournamentMatches(id),
    getTournamentStandingsRows(id, tournament.format, tournament.participants),
  ]);

  const rosterPlayerIds = new Set(tournament.participants.map((p) => p.playerId));
  const availablePlayers = allPlayers.filter((p) => !rosterPlayerIds.has(p.id));
  const roster = tournament.participants.map((p) => p.player);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{tournament.name}</h2>
        <DeleteTournamentButton id={tournament.id} name={tournament.name} />
      </div>

      <Tabs defaultValue="info">
        <TabsList>
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
            participants={tournament.participants}
            availablePlayers={availablePlayers}
          />
        </TabsContent>
        <TabsContent value="standings" className="pt-4">
          <TournamentStandings rows={standingsRows} showWinner={tournament.status === "COMPLETED"} />
        </TabsContent>
        <TabsContent value="matches" className="pt-4">
          <TournamentMatches
            tournamentId={tournament.id}
            format={tournament.format}
            roster={roster}
            matches={matches}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
