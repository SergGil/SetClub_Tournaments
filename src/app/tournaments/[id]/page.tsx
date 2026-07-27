import { PencilIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchSummary } from "@/components/match-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/permissions";
import { getTournamentMatches } from "@/lib/queries/matches";
import { getTournamentById } from "@/lib/queries/tournaments";
import { TOURNAMENT_FORMAT_LABEL, TOURNAMENT_STATUS_LABEL } from "@/lib/validation/tournament";

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tournament, matches, session] = await Promise.all([
    getTournamentById(id),
    getTournamentMatches(id),
    getSession(),
  ]);
  if (!tournament) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{tournament.name}</h1>
            <Badge variant="secondary">{TOURNAMENT_STATUS_LABEL[tournament.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {TOURNAMENT_FORMAT_LABEL[tournament.format]} ·{" "}
            {new Date(tournament.startDate).toLocaleDateString("uk-UA")} –{" "}
            {new Date(tournament.endDate).toLocaleDateString("uk-UA")}
          </p>
          {tournament.description && <p className="mt-3 max-w-xl text-sm">{tournament.description}</p>}
        </div>
        {session?.user?.role === "ADMIN" && (
          <Button variant="outline" render={<Link href={`/admin/tournaments/${tournament.id}`} />}>
            <PencilIcon /> Керувати
          </Button>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">
          Учасники ({tournament.participants.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          {tournament.participants.map((entry) => (
            <Link key={entry.playerId} href={`/players/${entry.playerId}`}>
              <Badge variant="outline" className="text-sm">
                {entry.player.name}
              </Badge>
            </Link>
          ))}
          {tournament.participants.length === 0 && (
            <p className="text-sm text-muted-foreground">Учасників ще не додано.</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Матчі ({matches.length})</h2>
        <div className="flex flex-col gap-2">
          {matches.map((match) => (
            <MatchSummary key={match.id} match={match} showTournament={false} />
          ))}
          {matches.length === 0 && (
            <p className="text-sm text-muted-foreground">Матчів ще не заплановано.</p>
          )}
        </div>
      </div>
    </div>
  );
}
