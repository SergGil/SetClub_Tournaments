import { MatchSummary } from "@/components/match-summary";
import { FINAL_ROUND, groupPlayoffMatches, isPlayoffRound } from "@/lib/playoff-rounds";
import type { MatchWithDetails } from "@/lib/queries/matches";

/**
 * Renders the tournament's playoff-stage matches (round tagged with one of
 * the curated bracket/placement labels - see playoff-rounds.ts) as a plain
 * list of sections, one per stage, always in the same fixed order (see
 * PLAYOFF_DISPLAY_ORDER) regardless of which stages this tournament actually
 * uses. Renders nothing if there's no playoff stage yet. Purely a read-only
 * summary - these matches also still appear in the regular flat matches
 * list, where they're actually managed.
 */
export function TournamentPlayoffs({
  matches,
  singlesRatingSnapshots,
}: {
  matches: MatchWithDetails[];
  singlesRatingSnapshots?: Record<string, { rating: number; spread: number }>;
}) {
  const playoffMatches = matches.filter((m) => isPlayoffRound(m.round));
  if (playoffMatches.length === 0) return null;

  const groups = groupPlayoffMatches(playoffMatches);

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
                  singlesRatingSnapshots={singlesRatingSnapshots}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
