import { TrophyIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { MatchWithDetails } from "@/lib/queries/matches";
import { SINGLES_GROUP_LABEL } from "@/lib/randomize-pairs";
import { cn } from "@/lib/utils";

const MATCH_TYPE_LABEL = { SINGLES: "1×1", DOUBLES: "2×2" } as const;
const MATCH_TYPE_VARIANT = { SINGLES: "accent", DOUBLES: "teal" } as const;

// The seeded-split singles randomizer stores its group in the `round` field
// (no schema for it otherwise) - badge those two known values distinctly,
// any other round text (e.g. "Фінал") stays plain.
const ROUND_BADGE_VARIANT: Record<string, "warning" | "slate"> = {
  [SINGLES_GROUP_LABEL.SEEDED]: "warning",
  [SINGLES_GROUP_LABEL.UNSEEDED]: "slate",
};

type SideResult = "win" | "loss" | "neutral";

function formatSide(players: MatchWithDetails["players"], side: "A" | "B") {
  return players
    .filter((p) => p.side === side)
    .map((p) => p.player.name)
    .join(" / ");
}

/** Green when this number won its set, red when it lost, plain on a tie. */
function SetScore({
  value,
  won,
  tiebreak,
}: {
  value: number;
  won: boolean | null;
  tiebreak: number | null;
}) {
  return (
    <span
      className={cn(
        "min-w-4 text-right tabular-nums",
        won === true && "text-emerald-600 dark:text-emerald-400",
        won === false && "text-red-600 dark:text-red-500",
      )}
    >
      {value}
      {tiebreak != null && (
        <sup className="ml-0.5 text-[0.7em] text-muted-foreground">{tiebreak}</sup>
      )}
    </span>
  );
}

/**
 * One side per row: name on the left, that side's own per-set games on the
 * right - so on narrow screens each side gets its own line instead of the
 * two names and a combined score competing for space in one row. Renders as
 * a fragment because the parent lays both rows out as a single 2-column
 * grid, which is what keeps the score columns aligned between the two rows.
 */
function SideRow({
  label,
  numbers,
  result,
  trophy = false,
}: {
  label: string;
  numbers: { value: number; won: boolean | null; tiebreak: number | null }[];
  result: SideResult;
  /** This side won the tournament's deciding Фінал match. */
  trophy?: boolean;
}) {
  return (
    <>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-l-md px-1.5 py-1 break-words",
          result === "win" && "bg-emerald-500/10 font-medium",
          result === "loss" && "text-muted-foreground/70",
        )}
      >
        {label || "?"}
        {trophy && <TrophyIcon className="size-3.5 shrink-0 text-amber-500" aria-label="Переможець турніру" />}
      </div>
      <div
        className={cn(
          "flex items-center justify-end gap-2 rounded-r-md px-1.5 py-1",
          result === "win" && "bg-emerald-500/10",
          result === "loss" && "text-muted-foreground/70",
        )}
      >
        {numbers.map((n, i) => (
          <SetScore key={i} value={n.value} won={n.won} tiebreak={n.tiebreak} />
        ))}
      </div>
    </>
  );
}

/** Thin win-probability bar for a not-yet-played match - the favorite's share fills `bg-primary`, same visual language as the leaderboard's win% bar. Colored fill is never the only signal: the caption always names the favorite and states the percentage in text. */
function PredictionBar({
  probA,
  probB,
  nameA,
  nameB,
}: {
  probA: number;
  probB: number;
  nameA: string;
  nameB: string;
}) {
  const aIsFavorite = probA >= probB;
  const favPct = Math.round((aIsFavorite ? probA : probB) * 100);
  const favName = (aIsFavorite ? nameA : nameB) || "?";
  const isClose = Math.abs(favPct - 50) < 3;

  return (
    <div className="flex flex-col gap-1.5 pt-0.5">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${favPct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {isClose ? (
          <>
            Майже рівні шанси — <span className="font-medium text-foreground">{favName}</span> трохи
            попереду ({favPct}%)
          </>
        ) : (
          <>
            <span className="font-medium text-foreground">{favName}</span> — фаворит за рейтингом (
            {favPct}%)
          </>
        )}
      </p>
    </div>
  );
}

export function MatchSummary({
  match,
  perspectivePlayerId,
  showTournament = true,
  hideRound = false,
  showChampionTrophy = false,
  preview,
}: {
  match: MatchWithDetails;
  perspectivePlayerId?: string;
  showTournament?: boolean;
  /** Suppress the inline round badge/text - for contexts that already show the round as a group heading. */
  hideRound?: boolean;
  /** Mark the winning side with a trophy - for the tournament's deciding Фінал match. */
  showChampionTrophy?: boolean;
  /** Win-probability preview from current ratings - only rendered while the match is still SCHEDULED (see src/lib/rating/match-preview.ts). */
  preview?: { probA: number; probB: number } | null;
}) {
  const sideA = formatSide(match.players, "A");
  const sideB = formatSide(match.players, "B");

  // A 7-6/6-7 set's tiebreak points are shown next to each side's own set
  // score, so both the winner's and loser's breaker points are visible.
  const aNumbers = match.sets.map((set) => ({
    value: set.sideAGames,
    won: set.sideAGames === set.sideBGames ? null : set.sideAGames > set.sideBGames,
    tiebreak: set.tiebreakSideAPoints,
  }));
  const bNumbers = match.sets.map((set) => ({
    value: set.sideBGames,
    won: set.sideAGames === set.sideBGames ? null : set.sideBGames > set.sideAGames,
    tiebreak: set.tiebreakSideBPoints,
  }));

  // Only a completed match has a winner - a scheduled/cancelled one leaves
  // both rows neutral instead of highlighting a side that hasn't won yet.
  const aResult: SideResult =
    match.winnerSide === "A" ? "win" : match.winnerSide === "B" ? "loss" : "neutral";
  const bResult: SideResult =
    match.winnerSide === "B" ? "win" : match.winnerSide === "A" ? "loss" : "neutral";

  const perspectiveSide = perspectivePlayerId
    ? match.players.find((p) => p.playerId === perspectivePlayerId)?.side
    : undefined;

  const resultBadge = (() => {
    if (match.status === "CANCELLED") return <Badge variant="secondary">Скасовано</Badge>;
    if (match.status === "SCHEDULED") return <Badge variant="info">Заплановано</Badge>;
    if (!perspectiveSide) return <Badge variant="secondary">Завершено</Badge>;
    const won = match.winnerSide === perspectiveSide;
    return (
      <Badge variant={won ? "default" : "destructive"}>{won ? "Перемога" : "Поразка"}</Badge>
    );
  })();

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <Badge variant={MATCH_TYPE_VARIANT[match.matchType]}>
            {MATCH_TYPE_LABEL[match.matchType]}
          </Badge>
          {!hideRound &&
            match.round &&
            (ROUND_BADGE_VARIANT[match.round] ? (
              <Badge variant={ROUND_BADGE_VARIANT[match.round]}>{match.round}</Badge>
            ) : (
              <span>{match.round}</span>
            ))}
          {match.scheduledDate && (
            <span>{new Date(match.scheduledDate).toLocaleDateString("uk-UA")}</span>
          )}
          {match.completedAt && (
            <span>
              {new Date(match.completedAt).toLocaleTimeString("uk-UA", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {match.retired && <Badge variant="warning">Знявся</Badge>}
          {resultBadge}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-center gap-y-0.5">
        <SideRow label={sideA} numbers={aNumbers} result={aResult} trophy={showChampionTrophy && aResult === "win"} />
        <SideRow label={sideB} numbers={bNumbers} result={bResult} trophy={showChampionTrophy && bResult === "win"} />
      </div>
      {match.status === "SCHEDULED" && preview && (
        <PredictionBar probA={preview.probA} probB={preview.probB} nameA={sideA} nameB={sideB} />
      )}
      {showTournament && (
        <Link
          href={`/tournaments/${match.tournament.id}`}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          {match.tournament.name}
        </Link>
      )}
    </div>
  );
}
