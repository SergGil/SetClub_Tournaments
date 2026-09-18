import { MatchSummary } from "@/components/match-summary";
import { PlayoffViewToggle } from "@/components/playoff-view-toggle";
import { TournamentBracket } from "@/components/tournament-bracket";
import { buildBracketTree } from "@/lib/playoff-bracket-tree";
import type { PlayoffGroup } from "@/lib/playoff-rounds";
import { FINAL_ROUND, groupPlayoffMatches, isPlayoffRound } from "@/lib/playoff-rounds";
import type { MatchWithDetails } from "@/lib/queries/matches";

function GroupedMatches({
  groups,
  singlesRankById,
  doublesRankById,
  sport,
}: {
  groups: PlayoffGroup<MatchWithDetails>[];
  singlesRankById?: Record<string, number>;
  doublesRankById?: Record<string, number>;
  sport: "TENNIS" | "PADEL";
}) {
  return (
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
                singlesRankById={singlesRankById}
                doublesRankById={doublesRankById}
                sport={sport}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Renders the tournament's playoff-stage matches (round tagged with one of
 * the curated bracket/placement labels - see playoff-rounds.ts). List view
 * (grouped by round, one section per stage, always in PLAYOFF_DISPLAY_ORDER)
 * stays the default; a visual bracket tree for the 1/8→1/4→1/2→Фінал stages
 * (+ bronze match) is available behind a "Сітка" toggle whenever it can be
 * built (see buildBracketTree - docs/DESIGN_ROADMAP_2026.md #2). Any playoff
 * match the tree doesn't cover (placement matches like "За 5 місце", "Півфінал
 * за 5-8" - those don't form a single connected tree) still renders as a
 * grouped list below the tree in bracket view too, so switching to "Сітка"
 * never makes a real match disappear. Renders nothing if there's no playoff
 * stage yet. Purely a read-only summary - these matches also still appear in
 * the regular flat matches list, where they're actually managed.
 */
export function TournamentPlayoffs({
  matches,
  singlesRankById,
  doublesRankById,
  sport = "TENNIS",
}: {
  matches: MatchWithDetails[];
  singlesRankById?: Record<string, number>;
  doublesRankById?: Record<string, number>;
  /** Forwarded to MatchSummary - see its own `sport` doc. Defaults to TENNIS for every existing call site. */
  sport?: "TENNIS" | "PADEL";
}) {
  const playoffMatches = matches.filter((m) => isPlayoffRound(m.round));
  if (playoffMatches.length === 0) return null;

  const groups = groupPlayoffMatches(playoffMatches);
  const tree = buildBracketTree(playoffMatches);

  const treeMatchIds = new Set<string>();
  if (tree) {
    for (const col of tree.columns) for (const node of col.nodes) treeMatchIds.add(node.match.id);
    if (tree.bronze) treeMatchIds.add(tree.bronze.id);
  }
  const remainingGroups = tree
    ? groupPlayoffMatches(playoffMatches.filter((m) => !treeMatchIds.has(m.id)))
    : [];

  const list = <GroupedMatches groups={groups} singlesRankById={singlesRankById} doublesRankById={doublesRankById} sport={sport} />;

  const bracket = tree ? (
    <div className="flex flex-col gap-6">
      <TournamentBracket tree={tree} />
      {remainingGroups.length > 0 && (
        <GroupedMatches
          groups={remainingGroups}
          singlesRankById={singlesRankById}
          doublesRankById={doublesRankById}
          sport={sport}
        />
      )}
    </div>
  ) : null;

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">Плей-офф</h2>
      <PlayoffViewToggle list={list} bracket={bracket} />
    </div>
  );
}
