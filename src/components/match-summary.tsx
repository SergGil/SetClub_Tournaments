import { TrophyIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ShareResultButton } from "@/components/share-result-button";
import { Badge } from "@/components/ui/badge";
import { formatDateUTC, formatTimeKyiv } from "@/lib/date-format";
import { MATCH_TYPE_LABEL, normalizeRoundLabel } from "@/lib/match-display";
import { displayName, retiredLabel, wonVerb } from "@/lib/player-display";
import type { MatchWithDetails } from "@/lib/queries/matches";
import { SINGLES_GROUP_LABEL } from "@/lib/randomize-pairs";
import type { MatchPreview } from "@/lib/rating/match-preview";
import { cn } from "@/lib/utils";

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
    .map((p) => displayName(p.player))
    .join(" / ");
}

/**
 * The natural-language caption for a completed match's Web Share text (see
 * ShareResultButton's `shareText` prop) - e.g. "Іван переміг Петра 6:4, 6:2
 * (Літній кубок)". Deliberately not reusing MatchSummary's own displayed
 * score formatting: this is a flat, winner-first sentence for a chat
 * message, not a two-column scoreboard.
 */
function matchShareCaption(match: MatchWithDetails, sideAName: string, sideBName: string): string {
  const winnerSide = match.winnerSide;
  if (!winnerSide) return `${sideAName} — ${sideBName} (${match.tournament.name})`;

  const winnerName = winnerSide === "A" ? sideAName : sideBName;
  const loserName = winnerSide === "A" ? sideBName : sideAName;
  const winnerPlayers = match.players.filter((p) => p.side === winnerSide).map((p) => p.player);
  const score = match.sets
    .map((set) => (winnerSide === "A" ? `${set.sideAGames}:${set.sideBGames}` : `${set.sideBGames}:${set.sideAGames}`))
    .join(", ");

  return `${winnerName} ${wonVerb(winnerPlayers)} ${loserName}${score ? ` ${score}` : ""} (${match.tournament.name})`;
}

type SidePlayer = { playerId: string; player: { name: string; nickname: string | null } };

/**
 * Each player's name on this side, individually annotated with `(#rank)` -
 * never a single joined string, so a doubles pair's two different ranks each
 * land next to their own name rather than being merged into one
 * (meaningless) side-level number. Each player gets its own line (not
 * joined with " / " in a shared text flow) - the same fix already applied
 * to the home page's ResultTile, for the same reason: on a narrow screen,
 * two names sharing one inline flow can wrap mid-name with the rank
 * annotation landing next to the wrong player.
 */
function SideNames({
  players,
  rankByPlayerId,
}: {
  players: SidePlayer[];
  rankByPlayerId?: Record<string, number>;
}) {
  if (players.length === 0) return <span>?</span>;
  return (
    <div className="flex min-w-0 flex-col">
      {players.map((p) => {
        const rank = rankByPlayerId?.[p.playerId];
        return (
          <span key={p.playerId}>
            {displayName(p.player)}
            {rank != null && (
              <span className="ml-1 text-xs font-normal whitespace-nowrap text-muted-foreground">
                (#{rank})
              </span>
            )}
          </span>
        );
      })}
    </div>
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
}: {
  players: SidePlayer[];
  numbers: { value: number; won: boolean | null; tiebreak: number | null }[];
  result: SideResult;
  /** This side won the tournament's deciding Фінал match. */
  trophy?: boolean;
  /** Replaces the (otherwise empty, no sets yet) score column with each player's current SET.club points - only passed for SCHEDULED matches with a preview. */
  ratingDisplay?: ReactNode;
  /** Each player's rank in the current club-wide SET.club points (singles or doubles, matching this match's format) - shown next to their name regardless of match status. */
  rankByPlayerId?: Record<string, number>;
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
        <SideNames players={players} rankByPlayerId={rankByPlayerId} />
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
  // Clamped to [1, 99] - a big enough rating gap makes the raw model
  // probability round to a literal 100/0%, which would claim a certainty
  // that doesn't exist (the underdog can always win a given match).
  const favPct = Math.min(99, Math.max(1, Math.round((aIsFavorite ? probA : probB) * 100)));
  const underdogPct = 100 - favPct;
  const favName = (aIsFavorite ? nameA : nameB) || "?";

  return (
    <div className="flex flex-col gap-1.5 pt-0.5">
      <div className="flex h-6 overflow-hidden rounded-md bg-muted text-xs font-semibold">
        <div
          className="flex min-w-0 items-center justify-center bg-primary text-primary-foreground"
          style={{ width: `${favPct}%` }}
        >
          {favPct}%
        </div>
        {/* Below ~8% the segment is too narrow to hold its own "N%" label -
            the label would overflow the zero/near-zero-width flex slot (flex
            items don't shrink past their content by default) and get
            clipped mid-character by the bar's rounded corners. */}
        <div
          className="flex min-w-0 items-center justify-center text-foreground"
          style={{ width: `${underdogPct}%` }}
        >
          {underdogPct >= 8 && `${underdogPct}%`}
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
  /** Current club-wide singles SET.club rank per playerId (1-based) - shown next to the name on every SINGLES match regardless of status. */
  singlesRankById?: Record<string, number>;
  /** Current club-wide doubles SET.club rank per playerId (1-based) - shown next to the name on every DOUBLES match regardless of status. */
  doublesRankById?: Record<string, number>;
}) {
  const sideAPlayers = match.players.filter((p) => p.side === "A");
  const sideBPlayers = match.players.filter((p) => p.side === "B");
  const sideA = formatSide(match.players, "A");
  const sideB = formatSide(match.players, "B");
  const rankByPlayerId = match.matchType === "SINGLES" ? singlesRankById : doublesRankById;

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

  const retiringPlayers =
    match.winnerSide === "A" ? sideBPlayers : match.winnerSide === "B" ? sideAPlayers : [];

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
            (() => {
              const roundLabel = normalizeRoundLabel(match.round);
              return ROUND_BADGE_VARIANT[roundLabel] ? (
                <Badge variant={ROUND_BADGE_VARIANT[roundLabel]}>{roundLabel}</Badge>
              ) : (
                <span>{roundLabel}</span>
              );
            })()}
          {match.scheduledDate && <span>{formatDateUTC(new Date(match.scheduledDate))}</span>}
          {match.completedAt && <span>{formatTimeKyiv(new Date(match.completedAt))}</span>}
        </div>
        <div className="flex items-center gap-2">
          {match.retired && (
            <Badge variant="warning">{retiredLabel(retiringPlayers.map((p) => p.player))}</Badge>
          )}
          {match.walkover && <Badge variant="warning">Технічна поразка</Badge>}
          {resultBadge}
          {match.status === "COMPLETED" && (
            <ShareResultButton
              imageUrl={`/api/share/match/${match.id}`}
              fileName={`set-club-match-${match.id}.png`}
              title="Поділитися результатом матчу"
              shareText={matchShareCaption(match, sideA, sideB)}
            />
          )}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-center gap-y-0.5">
        <SideRow
          players={sideAPlayers}
          numbers={aNumbers}
          result={aResult}
          trophy={showChampionTrophy && aResult === "win"}
          rankByPlayerId={rankByPlayerId}
        />
        <SideRow
          players={sideBPlayers}
          numbers={bNumbers}
          result={bResult}
          trophy={showChampionTrophy && bResult === "win"}
          rankByPlayerId={rankByPlayerId}
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
