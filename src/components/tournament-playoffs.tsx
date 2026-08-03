import { MatchSummary } from "@/components/match-summary";
import { detectPlayoffMode, FINAL_ROUND, groupPlayoffMatches, isPlayoffRound } from "@/lib/playoff-rounds";
import type { MatchWithDetails } from "@/lib/queries/matches";

/**
 * Renders the tournament's playoff-stage matches (round tagged with one of
 * the curated bracket/placement labels - see playoff-rounds.ts) as a plain
 * list of sections, one per stage, ordered bracket-first or placement-first
 * depending on which round labels are actually present (see
 * detectPlayoffMode/groupPlayoffMatches) - just the ordering, not the
 * layout, differs between the two. Renders nothing if there's no playoff
 * stage yet. Purely a read-only summary - these matches also still appear in
 * the regular flat matches list, where they're actually managed.
 */
export function TournamentPlayoffs({ matches }: { matches: MatchWithDetails[] }) {
  const playoffMatches = matches.filter((m) => isPlayoffRound(m.round));
  const mode = detectPlayoffMode(playoffMatches.map((m) => m.round));
  if (!mode) return null;

  const groups = groupPlayoffMatches(playoffMatches, mode);

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">Плей-офф</h2>
      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <div key={group.round} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground">{group.round}</h3>
            <div className="flex flex-col gap-2">
              {group.matches.map((match) => (
                <MatchSummary
                  key={match.id}
                  match={match}
                  showTournament={false}
                  hideRound
                  showChampionTrophy={group.round === FINAL_ROUND}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
