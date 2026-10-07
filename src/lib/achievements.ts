import type { MatchSide } from "@/generated/prisma/enums";

import { resultForSide } from "./match-result";
import { FINAL_ROUND } from "./playoff-rounds";
import type { MatchUpsetCheck } from "./rating/engine";

/**
 * Below this pre-match win probability for whoever ended up winning, the win
 * counts as a genuine upset (documented in docs/ACHIEVEMENTS.md as "the
 * opponent had ≥80% odds", the same claim from the other side).
 * `MatchUpsetCheck.winnerPreWinProb` (engine.ts) is Glicko-2/OpenSkill's own
 * expected-score formula, which is NOT generally symmetric (it weighs only
 * the opponent's rating deviation, not both sides') - `winProbability(A, B)`
 * and `winProbability(B, A)` don't have to sum to 1. This codebase already
 * treats them as complementary by convention rather than computing both
 * independently - see `buildMatchPreview` (match-preview.ts), which sets
 * `probB: 1 - probA` outright - so "winner's own probability ≤ 20%" and
 * "opponent's probability ≥ 80%" are the same claim *by that convention*,
 * consistent with how every other probability in the app is derived, even
 * though the underlying formula isn't symmetric in the strict mathematical
 * sense.
 */
export const GIANT_KILLER_MAX_WINNER_PROB = 0.2;

/** Distinct tournaments (any format) needed for the "Резидент клубу" badge - see docs/ACHIEVEMENTS.md. */
export const RESIDENT_TOURNAMENTS_THRESHOLD = 20;

/**
 * Which pool of tournaments a final belongs to for the finalist/champion
 * badges - exactly one per match, never overlapping. "womens-tennis" is
 * Tournament.isWomensOnly; padel has no such flag (PadelTournament has no
 * column for it), so there is no women's padel scope.
 */
export const PLACEMENT_SCOPES = ["tennis", "padel", "womens-tennis"] as const;
export type PlacementScope = (typeof PLACEMENT_SCOPES)[number];

const PLACEMENT_MATCH_TYPES = ["singles", "doubles"] as const;
type PlacementKind = "finalist" | "champion";

/**
 * Player.id of Іоганов Денис (not Максим - there are two Іоганови in the
 * club) - the "boss" the "Blue Moon" badges are about, because he
 * almost never loses. A hardcoded production id on purpose: it's a one-off
 * club joke, not worth a DB flag/admin UI. If the player row is ever
 * recreated under a new id, update it here.
 */
export const IOGANOV_PLAYER_ID = "cms37in3h000004i8eoz8ipze";

const IOGANOV_KILLER_IDS: ReadonlySet<AchievementId> = new Set(["ioganov-killer-singles", "ioganov-killer-doubles"]);

export type PlacementAchievementId = `${PlacementKind}-${PlacementScope}-${(typeof PLACEMENT_MATCH_TYPES)[number]}`;

export type AchievementId =
  | "debut"
  | "first-win"
  | "streak-3"
  | "streak-5"
  | PlacementAchievementId
  | "resident"
  | "giant-killer"
  | "ioganov-killer-singles"
  | "ioganov-killer-doubles";

export type Achievement = {
  id: AchievementId;
  label: string;
  description: string;
  earned: boolean;
  /** Custom earned-state icon; absent = the default trophy. Only "moon-ball" (the Blue Moon badges) so far. */
  icon?: "moon-ball";
  /** ISO date the badge was first earned - undefined for an unearned badge, and also for a streak badge (no single match "owns" a streak's completion date is ambiguous by design; see buildPlayerAchievements). */
  earnedAt?: string;
};

/**
 * One decided match from this player's perspective, already normalized
 * across tennis/padel and singles/doubles - see toAchievementMatchInput,
 * which builds this from either sport's raw match rows. Intentionally
 * ignorant of matchType/sport: every badge in the v1 catalog counts across
 * all formats combined (see docs/ACHIEVEMENTS.md), so there's nothing here
 * to distinguish them by.
 */
export type AchievementMatchInput = {
  id: string;
  result: "win" | "loss";
  round: string | null;
  /** Which finalist/champion badge family a final of this match counts toward - see PlacementScope. */
  scope: PlacementScope;
  matchType: "SINGLES" | "DOUBLES";
  tournamentId: string;
  playedAt: Date;
  /**
   * `completedAt ?? createdAt` - a real, second-precision DB timestamp,
   * distinct from `playedAt` (which prefers the date-only `scheduledDate`
   * when set). Used only to break ties among matches sharing the same
   * `playedAt` (routinely several matches on one tournament day) - see
   * buildPlayerAchievements. Never shown to the user; `playedAt` is what a
   * badge's `earnedAt` displays.
   */
  enteredAt: Date;
  /** Only meaningful when result === "win" - see GIANT_KILLER_MAX_WINNER_PROB. */
  isGiantKillerWin: boolean;
  /**
   * A genuine win over IOGANOV_PLAYER_ID: he was on the opposing side, and
   * the match wasn't a walkover (a walkover win means he withdrew, i.e. he
   * was never actually beaten). Feeds the "Blue Moon" badges, split by
   * `matchType`.
   */
  beatIoganov: boolean;
};

/** Minimal shape both Match and PadelMatch rows (with players/sets already included) satisfy - see matchWithDetailsInclude/padelMatchWithDetailsInclude. */
export type RawAchievementMatch = {
  id: string;
  tournamentId: string;
  round: string | null;
  matchType: "SINGLES" | "DOUBLES";
  winnerSide: MatchSide | null;
  walkover: boolean;
  scheduledDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  players: { side: MatchSide; playerId: string }[];
};

/**
 * Normalizes one raw match row (tennis or padel, singles or doubles) into
 * this player's perspective - null when the match doesn't count for
 * anything yet (not decided) or the walkover exclusion applies. Shares
 * resultForSide (match-result.ts) with summarizePlayerStats's decidedRows
 * filter (src/lib/player-stats.ts), so achievement eligibility never
 * disagrees with the stat tiles shown right above them on the profile.
 *
 * `context` is what the raw row itself can't say: which sport it came from,
 * and (tennis only) whether its tournament is women's-only - callers get the
 * latter from getWomensOnlyTournamentIds (queries/tournaments.ts) rather than
 * widening the shared match include.
 */
export function toAchievementMatchInput(
  match: RawAchievementMatch,
  playerId: string,
  isGiantKillerWin: boolean,
  context: { sport: "tennis" | "padel"; womensOnly: boolean },
): AchievementMatchInput | null {
  const side = match.players.find((p) => p.playerId === playerId)?.side ?? null;
  const result = resultForSide(match.winnerSide, side, match.walkover);
  if (!result) return null;
  const beatIoganov =
    result === "win" &&
    !match.walkover &&
    match.players.some((p) => p.playerId === IOGANOV_PLAYER_ID && p.side !== side);
  const scope: PlacementScope =
    context.sport === "padel" ? "padel" : context.womensOnly ? "womens-tennis" : "tennis";
  return {
    id: match.id,
    result,
    round: match.round,
    scope,
    matchType: match.matchType,
    tournamentId: match.tournamentId,
    playedAt: match.scheduledDate ?? match.completedAt ?? match.createdAt,
    enteredAt: match.completedAt ?? match.createdAt,
    isGiantKillerWin: result === "win" && isGiantKillerWin,
    beatIoganov,
  };
}

function iso(date: Date | undefined): string | undefined {
  return date?.toISOString();
}

/**
 * Which of this player's decided wins qualify for the "giant killer" badge -
 * a match id set, built from the four getUpsetWinsByPlayer/
 * getPadelUpsetWinsByPlayer (tennis/padel x singles/doubles) calls a caller
 * makes alongside its own match rows. Each index is already keyed by player
 * id (see getUpsetWinsByPlayer's own doc comment), so this only ever looks
 * at this one player's own handful of upset appearances - no club-wide scan
 * here, that cost is paid once, cached, when the index itself is built.
 * Kept as a separate step from toAchievementMatchInput (rather than baked
 * into it) because the upset data is club-wide-computed while
 * toAchievementMatchInput only ever sees one player's own matches.
 */
export function buildGiantKillerMatchIds(
  playerId: string,
  upsetIndexes: Record<string, MatchUpsetCheck[]>[],
): Set<string> {
  const ids = new Set<string>();
  for (const index of upsetIndexes) {
    for (const upset of index[playerId] ?? []) {
      if (upset.winnerPreWinProb <= GIANT_KILLER_MAX_WINNER_PROB) {
        ids.add(upset.matchId);
      }
    }
  }
  return ids;
}

/** `label` for the chip title, `tournament(typeGenitive)` for the description ("... фіналу <this>"). */
const SCOPE_LABEL: Record<PlacementScope, { label: string; tournament: (typeGenitive: string) => string }> = {
  tennis: { label: "теніс", tournament: (t) => `${t} тенісного турніру` },
  padel: { label: "падел", tournament: (t) => `${t} падел-турніру` },
  "womens-tennis": { label: "жіночий теніс", tournament: (t) => `${t} жіночого тенісного турніру` },
};

const MATCH_TYPE_LABEL = {
  singles: { label: "одиночний", genitive: "одиночного", matchType: "SINGLES" },
  doubles: { label: "парний", genitive: "парного", matchType: "DOUBLES" },
} as const;

/**
 * Finalist/champion badges, one pair per (scope x singles/doubles) - 12 in
 * total. Built by looping over the same const arrays that define
 * PlacementAchievementId, so the result is exhaustive by construction (the
 * cast below can't hide a missing key). A women's-tennis final counts only
 * toward the women's badges, never the general tennis ones: a match belongs
 * to exactly one scope, mirroring the rating pools (Tournament.isWomensOnly).
 * Feminine labels ("Фіналістка"/"Чемпіонка") for the women's scope.
 */
function buildPlacementAchievements(sorted: AchievementMatchInput[]): Record<PlacementAchievementId, Achievement> {
  const result: Partial<Record<PlacementAchievementId, Achievement>> = {};
  for (const scope of PLACEMENT_SCOPES) {
    for (const type of PLACEMENT_MATCH_TYPES) {
      const finals = sorted.filter(
        (m) => m.round === FINAL_ROUND && m.scope === scope && m.matchType === MATCH_TYPE_LABEL[type].matchType,
      );
      const titleWon = finals.find((m) => m.result === "win");
      const feminine = scope === "womens-tennis";
      const where = `${SCOPE_LABEL[scope].label}, ${MATCH_TYPE_LABEL[type].label}`;
      const tournament = SCOPE_LABEL[scope].tournament(MATCH_TYPE_LABEL[type].genitive);

      const finalistId: PlacementAchievementId = `finalist-${scope}-${type}`;
      result[finalistId] = {
        id: finalistId,
        label: `${feminine ? "Фіналістка" : "Фіналіст"}: ${where}`,
        description: `Дійшов${feminine ? "ла" : ""} до фіналу ${tournament}`,
        earned: finals.length > 0,
        earnedAt: iso(finals[0]?.playedAt),
      };
      const championId: PlacementAchievementId = `champion-${scope}-${type}`;
      result[championId] = {
        id: championId,
        label: `${feminine ? "Чемпіонка" : "Чемпіон"}: ${where}`,
        description: `Виграв${feminine ? "ла" : ""} фінал ${tournament}`,
        earned: Boolean(titleWon),
        earnedAt: iso(titleWon?.playedAt),
      };
    }
  }
  return result as Record<PlacementAchievementId, Achievement>;
}

/**
 * Pure badge catalog for one player, from their already-normalized decided
 * matches (any mix of tennis/padel, singles/doubles - see
 * AchievementMatchInput). No DB access, no engine recomputation - everything
 * here is a scan over data the caller already fetched, same "derive, don't
 * store" approach as player-stats.ts/head-to-head.ts.
 */
export function buildPlayerAchievements(
  matches: AchievementMatchInput[],
  options: { playerId?: string; gender?: "MALE" | "FEMALE" | null } = {},
): Achievement[] {
  // Ties on the same playedAt (several matches the same tournament day, a
  // routine case) break on enteredAt (completedAt/createdAt) - the order
  // scores were actually saved, which is the best signal the data has for
  // "what happened first" short of collecting real per-match timestamps.
  // Still not guaranteed to match true play order (an admin can enter a
  // day's results out of order), the same "no reliable ordering between
  // matches within one tournament" limitation computeSinglesRatingsWithHistory's
  // own doc comment (engine.ts) accepts for the rating engine itself - but
  // it's a real, meaningful signal rather than arbitrary input-array order.
  const sorted = [...matches].sort(
    (a, b) => a.playedAt.getTime() - b.playedAt.getTime() || a.enteredAt.getTime() - b.enteredAt.getTime(),
  );
  const wins = sorted.filter((m) => m.result === "win");

  // First match/win a streak or tournament-count badge crosses its
  // threshold - not the same as "the longest streak ever" or "total
  // tournaments now", but the date each badge was first earned.
  let running = 0;
  let streak3At: Date | undefined;
  let streak5At: Date | undefined;
  const seenTournaments = new Set<string>();
  let residentAt: Date | undefined;
  for (const m of sorted) {
    running = m.result === "win" ? running + 1 : 0;
    if (running >= 3 && !streak3At) streak3At = m.playedAt;
    if (running >= 5 && !streak5At) streak5At = m.playedAt;
    seenTournaments.add(m.tournamentId);
    if (seenTournaments.size >= RESIDENT_TOURNAMENTS_THRESHOLD && !residentAt) residentAt = m.playedAt;
  }

  const placement = buildPlacementAchievements(sorted);
  const giantKillerWin = wins.find((m) => m.isGiantKillerWin);
  const ioganovSinglesWin = wins.find((m) => m.beatIoganov && m.matchType === "SINGLES");
  const ioganovDoublesWin = wins.find((m) => m.beatIoganov && m.matchType === "DOUBLES");

  // A Record keyed by the full AchievementId union (not a plain array
  // literal) so adding a new id to that union without adding its entry here
  // is a compile error - "Property '...' is missing" - rather than a badge
  // that silently never appears for anyone.
  const catalog: Record<AchievementId, Achievement> = {
    debut: {
      id: "debut",
      label: "Дебют",
      description: "Зіграв перший матч у клубі",
      earned: sorted.length > 0,
      earnedAt: iso(sorted[0]?.playedAt),
    },
    "first-win": {
      id: "first-win",
      label: "Перша перемога",
      description: "Виграв перший матч",
      earned: wins.length > 0,
      earnedAt: iso(wins[0]?.playedAt),
    },
    "streak-3": {
      id: "streak-3",
      label: "Серія",
      description: "3 перемоги поспіль",
      earned: Boolean(streak3At),
      earnedAt: iso(streak3At),
    },
    "streak-5": {
      id: "streak-5",
      label: "Гаряча серія",
      description: "5 перемог поспіль",
      earned: Boolean(streak5At),
      earnedAt: iso(streak5At),
    },
    ...placement,
    resident: {
      id: "resident",
      label: "Резидент клубу",
      description: `Зіграв у ${RESIDENT_TOURNAMENTS_THRESHOLD}+ турнірах`,
      earned: Boolean(residentAt),
      earnedAt: iso(residentAt),
    },
    "giant-killer": {
      id: "giant-killer",
      label: "Вбивця фаворитів",
      description: "Виграв матч, де суперник був фаворитом 80%+",
      earned: Boolean(giantKillerWin),
      earnedAt: iso(giantKillerWin?.playedAt),
    },
    "ioganov-killer-singles": {
      id: "ioganov-killer-singles",
      icon: "moon-ball",
      label: "Blue Moon: solo",
      description: "Переміг Дениса Іоганова в одиночному матчі - раз на блакитний місяць",
      earned: Boolean(ioganovSinglesWin),
      earnedAt: iso(ioganovSinglesWin?.playedAt),
    },
    "ioganov-killer-doubles": {
      id: "ioganov-killer-doubles",
      icon: "moon-ball",
      label: "Blue Moon: duo",
      description: "Переміг у парному матчі, де Денис Іоганов грав за суперників - раз на блакитний місяць",
      earned: Boolean(ioganovDoublesWin),
      earnedAt: iso(ioganovDoublesWin?.playedAt),
    },
  };

  // Object.values on a Record built with these exact string-literal keys
  // preserves declaration order (all non-numeric-like keys - JS insertion
  // order), so the badge display order matches the catalog above unchanged.
  let all = Object.values(catalog);
  // The "Blue Moon" badges are about beating Іоганов Денис - for him they're
  // meaningless (he can't beat himself), so they're left out of his list
  // entirely rather than shown locked forever, which also keeps his "N з M"
  // counter honest. `playerId` is optional only so pure-catalog callers/tests
  // needn't pass one; both real call sites do.
  if (options.playerId === IOGANOV_PLAYER_ID) all = all.filter((a) => !IOGANOV_KILLER_IDS.has(a.id));
  // Women's-tennis finalist/champion badges are shown only to women
  // (Player.gender === "FEMALE", the same strict rule as the women's rating
  // pool - getFemalePlayerIds). `gender` undefined = "not specified" (no
  // filtering, for pure-catalog callers/tests); null = a player with no
  // gender set, who is treated like a man here: hidden, not shown locked.
  if (options.gender !== undefined && options.gender !== "FEMALE") {
    all = all.filter((a) => !a.id.includes("-womens-tennis-"));
  }
  return all;
}