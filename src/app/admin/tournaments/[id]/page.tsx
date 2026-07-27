import { notFound } from "next/navigation";

import { DeleteTournamentButton } from "@/components/admin/delete-tournament-button";
import { TournamentForm } from "@/components/admin/tournament-form";
import { TournamentRoster } from "@/components/admin/tournament-roster";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPlayers } from "@/lib/queries/players";
import { getTournamentById } from "@/lib/queries/tournaments";

export default async function AdminTournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tournament, allPlayers] = await Promise.all([getTournamentById(id), getPlayers()]);
  if (!tournament) notFound();

  const rosterPlayerIds = new Set(tournament.participants.map((p) => p.playerId));
  const availablePlayers = allPlayers.filter((p) => !rosterPlayerIds.has(p.id));

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
            Учасники ({tournament.participants.length})
          </TabsTrigger>
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
      </Tabs>
    </div>
  );
}
