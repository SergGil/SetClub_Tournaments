import type { ActionState } from "@/lib/actions/matches";
import { TieCard } from "@/components/tie-card";
import { TournamentStandings } from "@/components/tournament-standings";
import { countLabel, TIE_FORMS } from "@/lib/pluralize";
import type { StandingsRow } from "@/lib/standings-sort";
import type { TournamentTieWithRubbers } from "@/lib/tournament-ties";

type Teams = { id: string; name: string }[];

/**
 * Team/tie play for MIXED tournaments (see docs/TOURNAMENT_TEAMS.md) - shared
 * between the admin "Команди" tab and the public tournament page, and reused
 * unchanged by both Tennis and Padel. Renders nothing when no tie has been
 * created yet, so a tournament that never opts into team play (every
 * SINGLES/DOUBLES tournament, and every MIXED one that doesn't use teams)
 * shows literally nothing new.
 *
 * `createTieDialog`/`deleteTieAction`/`rubberAction` are the sport-specific
 * pieces (Tennis's CreateTieDialog/deleteTieAction/createRubberAction, or
 * Padel's CreatePadelTieDialog/deletePadelTieAction/createPadelRubberAction)
 * - only needed when canManage is true, same "parameterize the varying bit
 * via props" pattern as PhotoLightbox's deleteAction prop.
 */
export function TournamentTiesSection({
  tournamentId,
  ties,
  standingsRows,
  roundRobinDone,
  teams = [],
  canManage = false,
  createTieDialog: CreateTieDialogComponent,
  deleteTieAction,
  rubberAction,
  sport = "TENNIS",
}: {
  tournamentId: string;
  ties: TournamentTieWithRubbers[];
  standingsRows: StandingsRow[];
  roundRobinDone: boolean;
  /** Only needed when canManage - the "Створити зустріч" dialog's team picker. */
  teams?: Teams;
  canManage?: boolean;
  createTieDialog?: React.ComponentType<{ tournamentId: string; teams: Teams }>;
  deleteTieAction?: (tournamentId: string, tieId: string) => Promise<{ error?: string }>;
  rubberAction?: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  /** Forwarded to each TieCard/MatchSummary - see MatchSummary's own `sport` doc. Defaults to TENNIS for every existing call site. */
  sport?: "TENNIS" | "PADEL";
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
        {canManage && CreateTieDialogComponent && (
          <CreateTieDialogComponent tournamentId={tournamentId} teams={teams} />
        )}
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
              deleteTieAction={deleteTieAction}
              rubberAction={rubberAction}
              sport={sport}
            />
          ))}
        </div>
      )}
    </div>
  );
}
