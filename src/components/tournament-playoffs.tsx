import { MatchSummary } from "@/components/match-summary";
import { detectPlayoffMode, FINAL_ROUND, groupPlayoffMatches, isPlayoffRound } from "@/lib/playoff-rounds";
import type { MatchWithDetails } from "@/lib/queries/matches";
import { cn } from "@/lib/utils";

/**
 * Renders the tournament's playoff-stage matches (round tagged with one of
 * the curated bracket/placement labels - see playoff-rounds.ts) as either a
 * visual bracket (columns, no connector lines - there's no bracket-slot data
 * to draw them correctly) or a plain grouped list, auto-detected from which
 * round labels are actually present. Renders nothing if there's no playoff
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
      <div
        className={cn(
          "flex gap-4",
          mode === "bracket" ? "flex-row items-start overflow-x-auto pb-2" : "flex-col",
        )}
      >
        {groups.map((group) => (
          <div
            key={group.round}
            className={cn("flex flex-col gap-2", mode === "bracket" && "w-56 shrink-0")}
          >
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
