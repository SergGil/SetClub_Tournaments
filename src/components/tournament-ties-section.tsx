import { CreateTieDialog } from "@/components/admin/create-tie-dialog";
import { TieCard } from "@/components/tie-card";
import { TournamentStandings } from "@/components/tournament-standings";
import { countLabel, TIE_FORMS } from "@/lib/pluralize";
import type { StandingsRow } from "@/lib/standings-sort";
import type { TournamentTieWithRubbers } from "@/lib/tournament-ties";

/**
 * Team/tie play for MIXED tournaments (see docs/TOURNAMENT_TEAMS.md) - shared
 * between the admin "Команди" tab and the public tournament page. Renders
 * nothing when no tie has been created yet, so a tournament that never opts
 * into team play (every SINGLES/DOUBLES tournament, and every MIXED one that
 * doesn't use teams) shows literally nothing new.
 */
export function TournamentTiesSection({
  tournamentId,
  ties,
  standingsRows,
  roundRobinDone,
  teams = [],
  canManage = false,
}: {
  tournamentId: string;
  ties: TournamentTieWithRubbers[];
  standingsRows: StandingsRow[];
  roundRobinDone: boolean;
  /** Only needed when canManage - the "Створити зустріч" dialog's team picker. */
  teams?: { id: string; name: string }[];
  canManage?: boolean;
}) {
  // Public page: stay fully invisible until at least one tie exists - same
  // "invisible until the admin opts in" precedent as placedTable/custom
  // groups. Admin tab: always render, so "Створити зустріч" (disabled below
  // 2 teams) and the empty state are visible while setting things up.
  if (!canManage && ties.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{countLabel(ties.length, TIE_FORMS)}</h2>
        {canManage && <CreateTieDialog tournamentId={tournamentId} teams={teams} />}
      </div>

      {standingsRows.length > 0 && (
        <TournamentStandings rows={standingsRows} showWinner={false} roundRobinDone={roundRobinDone} />
      )}

      {ties.length === 0 ? (
        <p className="text-sm text-foreground/80">Зустрічей ще не створено.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {ties.map((tie) => (
            <TieCard
              key={tie.id}
              tournamentId={tournamentId}
              tieId={tie.id}
              label={tie.label}
              teamA={tie.teamA}
              teamB={tie.teamB}
              rubbers={tie.rubbers}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
