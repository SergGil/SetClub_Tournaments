import { TrophyIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ShareResultButton } from "@/components/share-result-button";
import { Badge } from "@/components/ui/badge";
import { formatDateUTC, formatTimeKyiv } from "@/lib/date-format";
import { emptySlotLabel, MATCH_TYPE_LABEL, normalizeRoundLabel } from "@/lib/match-display";
import type { MatchAdvancementInfo } from "@/lib/match-display";
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
 * ShareResultButton's `shareText` prop) - e.g. "Іван переміг Петра 6:4, 7:6(7:5)
 * (Літній кубок)". Deliberately not reusing MatchSummary's own displayed
 * score formatting: this is a flat, winner-first sentence for a chat
 * message, not a two-column scoreboard. A tiebreak set's own breaker points
 * are appended in parens (winner's first) exactly like the two per-side
 * numbers already shown on the share card image itself (see
 * match-card-image.tsx's tiebreak rendering) - a plain "7:6" would drop the
 * one detail (how close the breaker actually was) a recipient can't
 * recover from the final score alone.
 */
export function matchShareCaption(match: MatchWithDetails, sideAName: string, sideBName: string): string {
  const winnerSide = match.winnerSide;
  if (!winnerSide) return `${sideAName} — ${sideBName} (${match.tournament.name})`;

  const winnerName = winnerSide === "A" ? sideAName : sideBName;
  const loserName = winnerSide === "A" ? sideBName : sideAName;
  const winnerPlayers = match.players.filter((p) => p.side === winnerSide).map((p) => p.player);
  const score = match.sets
    .map((set) => {
      const winnerGames = winnerSide === "A" ? set.sideAGames : set.sideBGames;
      const loserGames = winnerSide === "A" ? set.sideBGames : set.sideAGames;
      const winnerTiebreak = winnerSide === "A" ? set.tiebreakSideAPoints : set.tiebreakSideBPoints;
      const loserTiebreak = winnerSide === "A" ? set.tiebreakSideBPoints : set.tiebreakSideAPoints;
      const tiebreak = winnerTiebreak != null && loserTiebreak != null ? `(${winnerTiebreak}:${loserTiebreak})` : "";
      return `${winnerGames}:${loserGames}${tiebreak}`;
    })
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
  emptyLabel,
  profileBasePath,
}: {
  players: SidePlayer[];
  rankByPlayerId?: Record<string, number>;
  /** Shown instead of a bare "?" when this side has no players yet (a bracket-randomizer slot not decided yet) - see emptySlotLabel. */
  emptyLabel?: string;
  /** "/players" or "/padel/players" - each name links to that player's profile for this sport. */
  profileBasePath: string;
}) {
  if (players.length === 0) return <span className="text-muted-foreground">{emptyLabel ?? "?"}</span>;
  return (
    <div className="flex min-w-0 flex-col">
      {players.map((p) => {
        const rank = rankByPlayerId?.[p.playerId];
        return (
          <span key={p.playerId}>
            <Link href={`${profileBasePath}/${p.playerId}`} className="hover:underline">
              {displayName(p.player)}
            </Link>
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
  emptyLabel,
  profileBasePath,
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
  /** Shown instead of a bare "?" when this side has no players yet - see emptySlotLabel. */
  emptyLabel?: string;
  /** See SideNames. */
  profileBasePath: string;
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
        <SideNames
          players={players}
          rankByPlayerId={rankByPlayerId}
          emptyLabel={emptyLabel}
          profileBasePath={profileBasePath}
        />
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

/**
 * Grammatical agreement for one side of a match: a doubles pair is always
 * plural ("фаворити", "були", "перемогли"); a single player follows their
 * recorded gender, falling back to masculine when it's unknown - the same
 * rule as wonVerb/retiredLabel in player-display.ts ("перемогли"/"Знялися з
 * матчу" for a pair).
 */
type Agreement = "masculine" | "feminine" | "plural";

function sideAgreement(players: { player: { gender?: "MALE" | "FEMALE" | null } }[]): Agreement {
  if (players.length > 1) return "plural";
  return players[0]?.player.gender === "FEMALE" ? "feminine" : "masculine";
}

type Intensity = "slight" | "plain" | "clear" | "heavy";

function intensityFor(favPct: number): Intensity {
  return favPct < 60 ? "slight" : favPct < 75 ? "plain" : favPct < 90 ? "clear" : "heavy";
}

/** "Іван — явний фаворит" (nominative, live caption). */
const FAVORITE_WORD: Record<Agreement, Record<Intensity, string>> = {
  masculine: { slight: "невеликий фаворит", plain: "фаворит", clear: "явний фаворит", heavy: "безумовний фаворит" },
  feminine: {
    slight: "невелика фаворитка",
    plain: "фаворитка",
    clear: "явна фаворитка",
    heavy: "безумовна фаворитка",
  },
  plural: { slight: "невеликі фаворити", plain: "фаворити", clear: "явні фаворити", heavy: "безумовні фаворити" },
};

/** "Іван був явним фаворитом" (instrumental, past-tense caption). */
const PAST_FAVORITE_WORD: Record<Agreement, Record<Intensity, string>> = {
  masculine: {
    slight: "невеликим фаворитом",
    plain: "фаворитом",
    clear: "явним фаворитом",
    heavy: "безумовним фаворитом",
  },
  feminine: {
    slight: "невеликою фавориткою",
    plain: "фавориткою",
    clear: "явною фавориткою",
    heavy: "безумовною фавориткою",
  },
  plural: {
    slight: "невеликими фаворитами",
    plain: "фаворитами",
    clear: "явними фаворитами",
    heavy: "безумовними фаворитами",
  },
};

const WAS: Record<Agreement, string> = { masculine: "був", feminine: "була", plural: "були" };
const WON: Record<Agreement, string> = { masculine: "переміг", feminine: "перемогла", plural: "перемогли" };

/**
 * Wording gradation for the prediction caption - `favPct` is always ≥50 by
 * construction (it's whichever side's probability is higher), so the bands
 * only need to cover the top half of the range. The favorite's agreement
 * picks "фаворит"/"фаворитка"/"фаворити". Kept as plain intensity words (not
 * raw jargon like "62% модель вважає...") so it reads like a sentence a club
 * member would actually say out loud.
 */
function predictionCaption(favPct: number, favName: string, favAgreement: Agreement) {
  // Exactly 50 means the bar itself renders as a visual tie (both segments
  // show "50%") - naming either side as "trochy poperedu" would contradict
  // what's on screen, even though the underlying unrounded probability does
  // lean one way. Only say someone's ahead once the bar itself shows it.
  if (favPct === 50) {
    return "Рівні шанси (50/50)";
  }
  if (favPct < 53) {
    return (
      <>
        Майже рівні шанси — <span className="font-medium text-foreground">{favName}</span> трохи
        попереду ({favPct}%)
      </>
    );
  }
  return (
    <>
      <span className="font-medium text-foreground">{favName}</span> —{" "}
      {FAVORITE_WORD[favAgreement][intensityFor(favPct)]} за поточним рейтингом ({favPct}%)
    </>
  );
}

/**
 * Past-tense twin of predictionCaption, for a completed match's frozen
 * pre-match prediction (Match.preMatchWinProbA): "Перед матчем Іван був
 * явним фаворитом (78%) — і переміг" or "…, але перемогла Марія", with
 * every verb and noun agreeing with that side (see sideAgreement). The
 * outcome is told only when someone was an actual favorite (≥53%) - "і
 * переміг" after a 52/48 coin flip would oversell the prediction.
 */
function pastPredictionCaption({
  favPct,
  favName,
  favAgreement,
  underdogName,
  underdogAgreement,
  favoriteWon,
}: {
  favPct: number;
  favName: string;
  favAgreement: Agreement;
  underdogName: string;
  underdogAgreement: Agreement;
  favoriteWon: boolean;
}) {
  if (favPct === 50) {
    return "Перед матчем шанси були рівні (50/50)";
  }
  if (favPct < 53) {
    return (
      <>
        Перед матчем шанси були майже рівні — <span className="font-medium text-foreground">{favName}</span>{" "}
        {WAS[favAgreement]} трохи попереду ({favPct}%)
      </>
    );
  }
  return (
    <>
      Перед матчем <span className="font-medium text-foreground">{favName}</span> {WAS[favAgreement]}{" "}
      {PAST_FAVORITE_WORD[favAgreement][intensityFor(favPct)]} ({favPct}%)
      {favoriteWon ? (
        <> — і {WON[favAgreement]}</>
      ) : (
        <>
          , але {WON[underdogAgreement]} <span className="font-medium text-foreground">{underdogName}</span>
        </>
      )}
    </>
  );
}

/** Two-segment win-probability bar - each segment carries its own percentage as a direct label, favorite filled `bg-primary`, same convention as the leaderboard's win% bar. The centered caption below names the favorite and repeats the percentage in parentheses. Color is never the only signal. For a completed match (`winnerSide` set) it shows the frozen pre-match prediction instead: a lower, muted bar and a past-tense caption saying whether the prediction came true. */
function PredictionBar({
  probA,
  probB,
  nameA,
  nameB,
  agreementA,
  agreementB,
  winnerSide,
}: {
  probA: number;
  probB: number;
  nameA: string;
  nameB: string;
  /** Each side's grammatical agreement (see sideAgreement) - "фаворит"/"фаворитка"/"фаворити" and the past-tense verbs. */
  agreementA: Agreement;
  agreementB: Agreement;
  /** Set only for a completed match - switches to the past-tense rendering. */
  winnerSide?: "A" | "B";
}) {
  const aIsFavorite = probA >= probB;
  // Clamped to [1, 99] - a big enough rating gap makes the raw model
  // probability round to a literal 100/0%, which would claim a certainty
  // that doesn't exist (the underdog can always win a given match).
  const favPct = Math.min(99, Math.max(1, Math.round((aIsFavorite ? probA : probB) * 100)));
  const underdogPct = 100 - favPct;
  const favName = (aIsFavorite ? nameA : nameB) || "?";
  const favAgreement = aIsFavorite ? agreementA : agreementB;
  const isPast = winnerSide != null;

  return (
    <div className="flex flex-col gap-1.5 pt-0.5">
      <div
        className={cn(
          "flex overflow-hidden rounded-md bg-muted text-xs font-semibold",
          isPast ? "h-5" : "h-6",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 items-center justify-center",
            isPast ? "bg-primary/25 text-foreground" : "bg-primary text-primary-foreground",
          )}
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
      <p className="text-center text-xs text-muted-foreground">
        {isPast
          ? pastPredictionCaption({
              favPct,
              favName,
              favAgreement,
              underdogName: (aIsFavorite ? nameB : nameA) || "?",
              underdogAgreement: aIsFavorite ? agreementB : agreementA,
              favoriteWon: aIsFavorite === (winnerSide === "A"),
            })
          : predictionCaption(favPct, favName, favAgreement)}
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
  singlesRankById,
  doublesRankById,
  sport = "TENNIS",
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
  /** Picks the tournament-name link and the share-card API route - `match` is used both for Tennis and Padel matches via structural typing, and neither can be inferred from the match data itself. Defaults to TENNIS for every existing call site. */
  sport?: "TENNIS" | "PADEL";
}) {
  const sideAPlayers = match.players.filter((p) => p.side === "A");
  const sideBPlayers = match.players.filter((p) => p.side === "B");
  const sideA = formatSide(match.players, "A");
  const sideB = formatSide(match.players, "B");
  const rankByPlayerId = match.matchType === "SINGLES" ? singlesRankById : doublesRankById;
  // Only ever non-empty for a bracket-randomizer's placeholder match (see
  // docs/GROUPS12_PLAYOFF.md, docs/DOUBLES_GROUP_PLAYOFF.md) - every
  // ordinary match's advancementsAsTarget is [].
  const advancementBySide = new Map(
    (match.advancementsAsTarget ?? []).map((a) => [a.side, a] as const),
  );
  const aEmptyLabel =
    sideAPlayers.length === 0
      ? advancementBySide.has("A")
        ? emptySlotLabel(advancementBySide.get("A") as MatchAdvancementInfo)
        : undefined
      : undefined;
  const bEmptyLabel =
    sideBPlayers.length === 0
      ? advancementBySide.has("B")
        ? emptySlotLabel(advancementBySide.get("B") as MatchAdvancementInfo)
        : undefined
      : undefined;
  const shareImageUrl =
    sport === "PADEL" ? `/api/share/padel-match/${match.id}` : `/api/share/match/${match.id}`;
  const tournamentHref =
    sport === "PADEL" ? `/padel/tournaments/${match.tournament.id}` : `/tournaments/${match.tournament.id}`;
  const profileBasePath = sport === "PADEL" ? "/padel/players" : "/players";

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
              imageUrl={shareImageUrl}
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
          emptyLabel={aEmptyLabel}
          profileBasePath={profileBasePath}
        />
        <SideRow
          players={sideBPlayers}
          numbers={bNumbers}
          result={bResult}
          trophy={showChampionTrophy && bResult === "win"}
          rankByPlayerId={rankByPlayerId}
          emptyLabel={bEmptyLabel}
          profileBasePath={profileBasePath}
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
            agreementA={sideAgreement(sideAPlayers)}
            agreementB={sideAgreement(sideBPlayers)}
          />
        ) : (
          <p className="pt-0.5 text-xs text-muted-foreground">
            Прогноз недоступний — хтось із гравців ще не грав{" "}
            {match.matchType === "SINGLES" ? "одиночні" : "парні"} матчі.
          </p>
        ))}
      {/* The same prediction, frozen when the result was first saved (see
          Match.preMatchWinProbA) - shown on every completed match card that
          has one, with no per-page wiring. A walkover was never played, so
          it gets no "did the favorite win" verdict even if a value exists. */}
      {match.status === "COMPLETED" &&
        match.winnerSide &&
        !match.walkover &&
        match.preMatchWinProbA != null && (
          <PredictionBar
            probA={match.preMatchWinProbA}
            probB={1 - match.preMatchWinProbA}
            nameA={sideA}
            nameB={sideB}
            agreementA={sideAgreement(sideAPlayers)}
            agreementB={sideAgreement(sideBPlayers)}
            winnerSide={match.winnerSide}
          />
        )}
      {showTournament && (
        <Link
          href={tournamentHref}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          {match.tournament.name}
        </Link>
      )}
    </div>
  );
}
