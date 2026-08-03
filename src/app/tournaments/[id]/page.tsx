import { PencilIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchSummary } from "@/components/match-summary";
import { TournamentPlayoffs } from "@/components/tournament-playoffs";
import { TournamentStandingsSection } from "@/components/tournament-standings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FINAL_ROUND } from "@/lib/playoff-rounds";
import { getSession } from "@/lib/permissions";
import { countLabel, MATCH_FORMS, PARTICIPANT_FORMS } from "@/lib/pluralize";
import { getTournamentMatches } from "@/lib/queries/matches";
import { getTournamentById } from "@/lib/queries/tournaments";
import { getTournamentStandingsRows } from "@/lib/tournament-standings";
import {
  COURT_SURFACE_LABEL,
  COURT_SURFACE_VARIANT,
  TOURNAMENT_FORMAT_LABEL,
  TOURNAMENT_STATUS_LABEL,
  TOURNAMENT_STATUS_VARIANT,
} from "@/lib/validation/tournament";

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await getTournamentById(id);
  if (!tournament) notFound();

  const [matches, standings, session] = await Promise.all([
    getTournamentMatches(id),
    getTournamentStandingsRows(id, tournament.format, tournament.participants),
    getSession(),
  ]);
  // A Фінал playoff match decides the champion on its own - showing the
  // standings-table trophy too would be misleading whenever the round-robin
  // leader isn't the one who actually won the final.
  const hasFinalMatch = matches.some((m) => m.round === FINAL_ROUND);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{tournament.name}</h1>
            <Badge variant={TOURNAMENT_STATUS_VARIANT[tournament.status]}>
              {TOURNAMENT_STATUS_LABEL[tournament.status]}
            </Badge>
            <Badge variant={COURT_SURFACE_VARIANT[tournament.surface]}>
              {COURT_SURFACE_LABEL[tournament.surface]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-foreground/80">
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
          {countLabel(tournament.participants.length, PARTICIPANT_FORMS)}
        </h2>
        <TournamentStandingsSection
          standings={standings}
          showWinner={tournament.status === "COMPLETED"}
          hasPlayoffFinal={hasFinalMatch}
          emptyMessage={
            tournament.format === "DOUBLES" ? "Пар ще не сформовано." : "Учасників ще не додано."
          }
        />
      </div>

      <TournamentPlayoffs matches={matches} />

      <div>
        <h2 className="mb-3 text-lg font-semibold">{countLabel(matches.length, MATCH_FORMS)}</h2>
        <div className="flex flex-col gap-2">
          {matches.map((match) => (
            <MatchSummary key={match.id} match={match} showTournament={false} />
          ))}
          {matches.length === 0 && (
            <p className="text-sm text-foreground/80">Матчів ще не заплановано.</p>
          )}
        </div>
      </div>
    </div>
  );
}
