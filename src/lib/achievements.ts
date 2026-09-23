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

export type AchievementId =
  | "debut"
  | "first-win"
  | "streak-3"
  | "streak-5"
  | "finalist"
  | "champion"
  | "resident"
  | "giant-killer";

export type Achievement = {
  id: AchievementId;
  label: string;
  description: string;
  earned: boolean;
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
};

/** Minimal shape both Match and PadelMatch rows (with players/sets already included) satisfy - see matchWithDetailsInclude/padelMatchWithDetailsInclude. */
export type RawAchievementMatch = {
  id: string;
  tournamentId: string;
  round: string | null;
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
 */
export function toAchievementMatchInput(
  match: RawAchievementMatch,
  playerId: string,
  isGiantKillerWin: boolean,
): AchievementMatchInput | null {
  const side = match.players.find((p) => p.playerId === playerId)?.side ?? null;
  const result = resultForSide(match.winnerSide, side, match.walkover);
  if (!result) return null;
  return {
    id: match.id,
    result,
    round: match.round,
    tournamentId: match.tournamentId,
    playedAt: match.scheduledDate ?? match.completedAt ?? match.createdAt,
    enteredAt: match.completedAt ?? match.createdAt,
    isGiantKillerWin: result === "win" && isGiantKillerWin,
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

/**
 * Pure badge catalog for one player, from their already-normalized decided
 * matches (any mix of tennis/padel, singles/doubles - see
 * AchievementMatchInput). No DB access, no engine recomputation - everything
 * here is a scan over data the caller already fetched, same "derive, don't
 * store" approach as player-stats.ts/head-to-head.ts.
 */
export function buildPlayerAchievements(matches: AchievementMatchInput[]): Achievement[] {
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

  const finalMatches = sorted.filter((m) => m.round === FINAL_ROUND);
  const championMatch = finalMatches.find((m) => m.result === "win");
  const giantKillerWin = wins.find((m) => m.isGiantKillerWin);

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
    finalist: {
      id: "finalist",
      label: "Фіналіст",
      description: "Дійшов до фіналу турніру",
      earned: finalMatches.length > 0,
      earnedAt: iso(finalMatches[0]?.playedAt),
    },
    champion: {
      id: "champion",
      label: "Чемпіон",
      description: "Виграв фінал турніру",
      earned: Boolean(championMatch),
      earnedAt: iso(championMatch?.playedAt),
    },
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
  };

  // Object.values on a Record built with these exact string-literal keys
  // preserves declaration order (all non-numeric-like keys - JS insertion
  // order), so the badge display order matches the catalog above unchanged.
  return Object.values(catalog);
}
