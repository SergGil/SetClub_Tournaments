import { TrophyIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import type { MatchWithDetails } from "@/lib/queries/matches";
import { SINGLES_GROUP_LABEL } from "@/lib/randomize-pairs";
import type { MatchPreview } from "@/lib/rating/match-preview";
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

type SidePlayer = { playerId: string; player: { name: string } };

/**
 * Each player's name on this side, individually annotated with `(#rank)`
 * and/or `(rating±spread)` - never a single joined string, so a doubles
 * pair's two different ranks each land next to their own name rather than
 * being merged into one (meaningless) side-level number.
 */
function SideNames({
  players,
  rankByPlayerId,
  historicalByPlayerId,
}: {
  players: SidePlayer[];
  rankByPlayerId?: Record<string, number>;
  historicalByPlayerId?: Record<string, { rating: number; spread: number }>;
}) {
  if (players.length === 0) return <>?</>;
  return (
    <>
      {players.map((p, i) => {
        const rank = rankByPlayerId?.[p.playerId];
        const historical = historicalByPlayerId?.[p.playerId];
        return (
          <span key={p.playerId}>
            {i > 0 && " / "}
            {p.player.name}
            {(rank != null || historical) && (
              <span className="ml-1 text-xs font-normal whitespace-nowrap text-muted-foreground">
                ({rank != null && `#${rank}`}
                {rank != null && historical && " · "}
                {historical && `${historical.rating}±${historical.spread}`})
              </span>
            )}
          </span>
        );
      })}
    </>
  );
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
  players,
  numbers,
  result,
  trophy = false,
  ratingDisplay,
  rankByPlayerId,
  historicalByPlayerId,
}: {
  players: SidePlayer[];
  numbers: { value: number; won: boolean | null; tiebreak: number | null }[];
  result: SideResult;
  /** This side won the tournament's deciding Фінал match. */
  trophy?: boolean;
  /** Replaces the (otherwise empty, no sets yet) score column with each player's current rating - only passed for SCHEDULED matches with a preview. */
  ratingDisplay?: ReactNode;
  /** Each player's rank in the current club-wide rating (singles or doubles, matching this match's format) - shown next to their name regardless of match status. */
  rankByPlayerId?: Record<string, number>;
  /** Rating as of the tournament this (completed, singles) match belongs to - shown next to the name alongside the rank. */
  historicalByPlayerId?: Record<string, { rating: number; spread: number }>;
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
        <SideNames players={players} rankByPlayerId={rankByPlayerId} historicalByPlayerId={historicalByPlayerId} />
        {trophy && <TrophyIcon className="size-3.5 shrink-0 text-amber-500" aria-label="Переможець турніру" />}
      </div>
      <div
        className={cn(
          "flex items-center justify-end gap-2 rounded-r-md px-1.5 py-1",
          result === "win" && "bg-emerald-500/10",
          result === "loss" && "text-muted-foreground/70",
        )}
      >
        {ratingDisplay ??
          numbers.map((n, i) => <SetScore key={i} value={n.value} won={n.won} tiebreak={n.tiebreak} />)}
      </div>
    </>
  );
}

/** Each side player's current rating (±spread), stacked when a side has more than one player (doubles) - fills the score column, which is otherwise empty before a match has been played. */
function SideRatings({
  players,
  ratingByPlayerId,
}: {
  players: { playerId: string; player: { name: string } }[];
  ratingByPlayerId: Record<string, { rating: number; spread: number }>;
}) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      {players.map((p) => {
        const r = ratingByPlayerId[p.playerId];
        if (!r) return null;
        return (
          <span key={p.playerId} className="tabular-nums text-muted-foreground">
            {r.rating}
            <span className="text-[0.7em]">±{r.spread}</span>
          </span>
        );
      })}
    </div>
  );
}

const FAVORITE_WORD = {
  singular: {
    slight: "невеликий фаворит",
    plain: "фаворит",
    clear: "явний фаворит",
    heavy: "безумовний фаворит",
  },
  plural: {
    slight: "невеликі фаворити",
    plain: "фаворити",
    clear: "явні фаворити",
    heavy: "безумовні фаворити",
  },
} as const;

/**
 * Wording gradation for the prediction caption - `favPct` is always ≥50 by
 * construction (it's whichever side's probability is higher), so the bands
 * only need to cover the top half of the range. `isTeam` picks the plural
 * "фаворити" for a doubles pair instead of the singular "фаворит" for one
 * singles player. Kept as plain intensity words (not raw jargon like "62%
 * модель вважає...") so it reads like a sentence a club member would
 * actually say out loud.
 */
function predictionCaption(favPct: number, favName: string, isTeam: boolean) {
  if (favPct < 53) {
    return (
      <>
        Майже рівні шанси — <span className="font-medium text-foreground">{favName}</span> трохи
        попереду ({favPct}%)
      </>
    );
  }
  const words = isTeam ? FAVORITE_WORD.plural : FAVORITE_WORD.singular;
  const intensity = favPct < 60 ? words.slight : favPct < 75 ? words.plain : favPct < 90 ? words.clear : words.heavy;
  return (
    <>
      <span className="font-medium text-foreground">{favName}</span> — {intensity} за поточним
      рейтингом ({favPct}%)
    </>
  );
}

/** Two-segment win-probability bar for a not-yet-played match - each segment carries its own percentage as a direct label, favorite filled `bg-primary`, same convention as the leaderboard's win% bar. The centered caption below names the favorite and repeats the percentage in parentheses. Color is never the only signal. */
function PredictionBar({
  probA,
  probB,
  nameA,
  nameB,
  isTeam,
}: {
  probA: number;
  probB: number;
  nameA: string;
  nameB: string;
  /** Doubles pair on both sides - picks plural "фаворити" wording over singular "фаворит". */
  isTeam: boolean;
}) {
  const aIsFavorite = probA >= probB;
  const favPct = Math.round((aIsFavorite ? probA : probB) * 100);
  const underdogPct = 100 - favPct;
  const favName = (aIsFavorite ? nameA : nameB) || "?";

  return (
    <div className="flex flex-col gap-1.5 pt-0.5">
      <div className="flex h-6 overflow-hidden rounded-md bg-muted text-xs font-semibold">
        <div
          className="flex items-center justify-center bg-primary text-primary-foreground"
          style={{ width: `${favPct}%` }}
        >
          {favPct}%
        </div>
        <div className="flex items-center justify-center text-muted-foreground" style={{ width: `${underdogPct}%` }}>
          {underdogPct}%
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">{predictionCaption(favPct, favName, isTeam)}</p>
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
  singlesRatingSnapshots,
  singlesRankById,
  doublesRankById,
}: {
  match: MatchWithDetails;
  perspectivePlayerId?: string;
  showTournament?: boolean;
  /** Suppress the inline round badge/text - for contexts that already show the round as a group heading. */
  hideRound?: boolean;
  /** Mark the winning side with a trophy - for the tournament's deciding Фінал match. */
  showChampionTrophy?: boolean;
  /** Win-probability preview from current ratings - only rendered while the match is still SCHEDULED (see src/lib/rating/match-preview.ts). */
  preview?: MatchPreview | null;
  /** Every singles rating snapshot, keyed `${tournamentId}:${playerId}` (see getSinglesRatingSnapshotsByTournament) - only rendered for COMPLETED SINGLES matches, looked up by this match's own tournament. */
  singlesRatingSnapshots?: Record<string, { rating: number; spread: number }>;
  /** Current club-wide singles rank per playerId (1-based) - shown next to the name on every SINGLES match regardless of status. */
  singlesRankById?: Record<string, number>;
  /** Current club-wide doubles rank per playerId (1-based) - shown next to the name on every DOUBLES match regardless of status. */
  doublesRankById?: Record<string, number>;
}) {
  const sideAPlayers = match.players.filter((p) => p.side === "A");
  const sideBPlayers = match.players.filter((p) => p.side === "B");
  const sideA = formatSide(match.players, "A");
  const sideB = formatSide(match.players, "B");
  const showRatings = match.status === "SCHEDULED" && Boolean(preview);
  const showHistoricalRating =
    match.status === "COMPLETED" && match.matchType === "SINGLES" && Boolean(singlesRatingSnapshots);
  const rankByPlayerId = match.matchType === "SINGLES" ? singlesRankById : doublesRankById;
  const historicalByPlayerId: Record<string, { rating: number; spread: number }> | undefined =
    showHistoricalRating
      ? Object.fromEntries(
          match.players.flatMap((p) => {
            const r = singlesRatingSnapshots![`${match.tournament.id}:${p.playerId}`];
            return r ? [[p.playerId, r]] : [];
          }),
        )
      : undefined;

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
        <SideRow
          players={sideAPlayers}
          numbers={aNumbers}
          result={aResult}
          trophy={showChampionTrophy && aResult === "win"}
          ratingDisplay={
            showRatings && preview ? (
              <SideRatings players={sideAPlayers} ratingByPlayerId={preview.ratingByPlayerId} />
            ) : undefined
          }
          rankByPlayerId={rankByPlayerId}
          historicalByPlayerId={historicalByPlayerId}
        />
        <SideRow
          players={sideBPlayers}
          numbers={bNumbers}
          result={bResult}
          trophy={showChampionTrophy && bResult === "win"}
          ratingDisplay={
            showRatings && preview ? (
              <SideRatings players={sideBPlayers} ratingByPlayerId={preview.ratingByPlayerId} />
            ) : undefined
          }
          rankByPlayerId={rankByPlayerId}
          historicalByPlayerId={historicalByPlayerId}
        />
      </div>
      {match.status === "SCHEDULED" &&
        preview !== undefined &&
        (preview ? (
          <PredictionBar
            probA={preview.probA}
            probB={preview.probB}
            nameA={sideA}
            nameB={sideB}
            isTeam={match.matchType === "DOUBLES"}
          />
        ) : (
          <p className="pt-0.5 text-xs text-muted-foreground">
            Прогноз недоступний — хтось із гравців ще не грав{" "}
            {match.matchType === "SINGLES" ? "одиночні" : "парні"} матчі.
          </p>
        ))}
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
