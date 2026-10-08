import { unstable_cache } from "next/cache";
import { cache } from "react";

import type { MatchType } from "@/generated/prisma/enums";
import type { RatingPool as PrismaRatingPool } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { STATS_CACHE_TAG } from "@/lib/stats";

import {
  computeDoublesRatings,
  computeDoublesRatingsWithHistory,
  computeSinglesRatings,
  computeSinglesRatingsWithHistory,
} from "./engine";
import type { DoublesRatingRow, MatchUpsetCheck, RatingMatchRow, SinglesRatingRow } from "./engine";
import { conservativeRating } from "./glicko2";
import { conservativeOrdinal } from "./openskill";
import type { SetClubPointsRow } from "./placement";
import { buildRankDeltaMap, excludeLatestTournament } from "./rank-trend";
import { femaleIdsForScope, filterBySeason, filterEligible, sortSetClubPoints } from "./rating-pools";
import type { RatingScope } from "./rating-pools";
import { computeDoublesSetClubPoints } from "./setclub";
import { computeSinglesSetClubPoints } from "./setclub-singles";

// Reuses stats.ts's cache tag rather than introducing a new one: ratings are
// derived from the exact same "decided match" row set and invalidated by the
// exact same set of match-mutating actions, so a second tag would just be
// updateTag'd in lockstep everywhere the first one already is.
const CACHE_OPTIONS = { tags: [STATS_CACHE_TAG], revalidate: 60 };

const matchSelect = {
  id: true,
  tournamentId: true,
  tournament: {
    select: {
      startDate: true,
      // Each player's seed status in *this* tournament - used to weight
      // doubles rating credit toward the presumed-stronger partner. Fetched
      // per-match rather than in a separate query: the club is small enough
      // (~20 players, a handful of tournaments) that the duplication across
      // matches in the same tournament is negligible.
      participants: { select: { playerId: true, seed: true } },
    },
  },
  winnerSide: true,
  createdAt: true,
  round: true,
  players: { select: { side: true, playerId: true } },
  sets: { select: { sideAGames: true, sideBGames: true } },
} as const;

export type { RatingScope } from "./rating-pools";

/** Exported for src/lib/rating/snapshot.ts, which replays the same rows to rebuild RatingSnapshot. */
export const fetchRatingMatchRows = unstable_cache(
  async (matchType: MatchType, scope: RatingScope): Promise<RatingMatchRow[]> => {
    const rows = await prisma.match.findMany({
      // A walkover (technical loss from withdrawParticipantAction) is
      // excluded from rating entirely, for both sides - see
      // docs/WITHDRAWAL.md.
      where: {
        status: "COMPLETED",
        winnerSide: { not: null },
        matchType,
        walkover: false,
        tournament: { isWomensOnly: scope === "women" },
      },
      select: matchSelect,
    });
    return rows.map((row) => {
      const seededByPlayer = new Map(
        row.tournament.participants.map((p) => [p.playerId, p.seed !== null]),
      );
      return {
        id: row.id,
        tournamentId: row.tournamentId,
        // Epoch ms, not Date - see the RatingMatchRow doc comment in engine.ts:
        // Date objects don't survive unstable_cache's JSON round-trip on a cache hit.
        tournamentStartDate: new Date(row.tournament.startDate).getTime(),
        // `winnerSide: { not: null }` in the query guarantees this, TS just can't see it.
        winnerSide: row.winnerSide as "A" | "B",
        createdAt: new Date(row.createdAt).getTime(),
        round: row.round,
        tournamentParticipantCount: row.tournament.participants.length,
        players: row.players.map((p) => ({
          side: p.side,
          playerId: p.playerId,
          seeded: seededByPlayer.get(p.playerId) ?? false,
        })),
        sets: row.sets,
      };
    });
  },
  ["rating-match-rows"],
  CACHE_OPTIONS,
);

/**
 * Replays the full singles/doubles history once per request for every
 * caller that needs the FULL (non-excluded) row set -
 * `getSinglesRatings`/`getDoublesRatings` (`.final`), `getUpsetWins`
 * (`.upsets`), and the "current" half of `getSinglesRatingsTrend`/
 * `getDoublesRatingsTrend` all share this. A page like players/[id] (and the
 * achievements API route) calls several of these in the same request, and
 * without this they'd each trigger their own independent O(matches)
 * Glicko-2/OpenSkill replay over the exact same rows. `cache()` from "react"
 * dedupes by argument (none here) for the lifetime of one request/render -
 * same pattern as `getTournamentById` in src/lib/queries/tournaments.ts.
 * The trend functions' OTHER half (excludeLatestTournament's subset) is a
 * genuinely different row set and still replays on its own - there's
 * nothing to share it with.
 */
// Returns `rows` alongside the replay itself - a trend function needing
// excludeLatestTournament(rows) then reuses these exact rows instead of
// calling fetchRatingMatchRows a second time. unstable_cache (wrapping
// fetchRatingMatchRows) doesn't guarantee intra-request dedup the way
// cache() does, so a second direct call isn't safely free - it can genuinely
// hit the DB again.
const getSinglesHistoryReplay = cache(async (scope: RatingScope) => {
  const rows = await fetchRatingMatchRows("SINGLES", scope);
  return { rows, ...computeSinglesRatingsWithHistory(rows) };
});
const getDoublesHistoryReplay = cache(async (scope: RatingScope) => {
  const rows = await fetchRatingMatchRows("DOUBLES", scope);
  return { rows, ...computeDoublesRatingsWithHistory(rows) };
});

export async function getSinglesRatings(scope: RatingScope = "general"): Promise<SinglesRatingRow[]> {
  const [{ final }, femaleIds] = await Promise.all([getSinglesHistoryReplay(scope), femaleIdsForScope(scope)]);
  const rows = femaleIds ? [...final.values()].filter((r) => femaleIds.has(r.playerId)) : [...final.values()];
  return rows.sort((a, b) => conservativeRating(b.rating) - conservativeRating(a.rating));
}

export async function getDoublesRatings(scope: RatingScope = "general"): Promise<DoublesRatingRow[]> {
  const [{ final }, femaleIds] = await Promise.all([getDoublesHistoryReplay(scope), femaleIdsForScope(scope)]);
  const rows = femaleIds ? [...final.values()].filter((r) => femaleIds.has(r.playerId)) : [...final.values()];
  return rows.sort((a, b) => conservativeOrdinal(b.rating) - conservativeOrdinal(a.rating));
}

/**
 * Every decided match's pre-match win probability for whoever won - powers
 * the "giant killer" achievement (src/lib/achievements.ts). Wrapped in
 * unstable_cache (not just the per-request cache() above) because, unlike
 * getSinglesRatings/getDoublesRatings, this route's only other caller is the
 * mobile achievements API - which has nothing else in the same request to
 * share the replay with, so without a cross-request cache every profile
 * view/poll (mobile's 60s staleTime) would redo the full club-wide replay.
 * A cache MISS here still calls getSinglesHistoryReplay/getDoublesHistoryReplay,
 * so a request that also calls getSinglesRatings/getDoublesRatings never
 * pays for the replay twice even on a cross-request miss.
 */
export const getUpsetWins = unstable_cache(
  async (matchType: MatchType, scope: RatingScope = "general"): Promise<MatchUpsetCheck[]> => {
    const { upsets } =
      matchType === "SINGLES" ? await getSinglesHistoryReplay(scope) : await getDoublesHistoryReplay(scope);
    const femaleIds = await femaleIdsForScope(scope);
    if (!femaleIds) return upsets;
    // Same "hide the player, not the match" rule as every other list-returning
    // function in this file (see docs/RATING.md's women's-pool section) - a
    // doubles upset with one female and one male winner still credits the
    // female, just never lists the male's id.
    return upsets
      .map((u) => ({ ...u, winnerIds: u.winnerIds.filter((id) => femaleIds.has(id)) }))
      .filter((u) => u.winnerIds.length > 0);
  },
  ["rating-upset-wins"],
  CACHE_OPTIONS,
);

/**
 * getUpsetWins, indexed by player id - one entry's `winnerIds` can put it
 * under more than one key (doubles). buildGiantKillerMatchIds
 * (src/lib/achievements.ts) only ever needs one player's own handful of
 * upset wins, not a full club-wide scan on every profile view - this builds
 * the index once (cached, cross-request, same as getUpsetWins itself) and
 * reuses it, so the O(all decided matches) work happens once per revalidate
 * window rather than once per profile view. Plain Record, not a Map - same
 * unstable_cache JSON round-trip reasoning as getAllRatingHistories.
 */
export const getUpsetWinsByPlayer = unstable_cache(
  async (matchType: MatchType, scope: RatingScope = "general"): Promise<Record<string, MatchUpsetCheck[]>> => {
    const upsets = await getUpsetWins(matchType, scope);
    const byPlayer: Record<string, MatchUpsetCheck[]> = {};
    for (const upset of upsets) {
      for (const playerId of upset.winnerIds) {
        (byPlayer[playerId] ??= []).push(upset);
      }
    }
    return byPlayer;
  },
  ["rating-upset-wins-by-player"],
  CACHE_OPTIONS,
);

function orderFromSinglesFinal(final: Map<string, SinglesRatingRow>, femaleIds: Set<string> | null): string[] {
  return [...final.values()]
    .filter((row) => !femaleIds || femaleIds.has(row.playerId))
    .sort((a, b) => conservativeRating(b.rating) - conservativeRating(a.rating))
    .map((row) => row.playerId);
}

function orderFromDoublesFinal(final: Map<string, DoublesRatingRow>, femaleIds: Set<string> | null): string[] {
  return [...final.values()]
    .filter((row) => !femaleIds || femaleIds.has(row.playerId))
    .sort((a, b) => conservativeOrdinal(b.rating) - conservativeOrdinal(a.rating))
    .map((row) => row.playerId);
}

function sortedSinglesOrder(rows: RatingMatchRow[], femaleIds: Set<string> | null): string[] {
  return orderFromSinglesFinal(computeSinglesRatings(rows), femaleIds);
}

function sortedDoublesOrder(rows: RatingMatchRow[], femaleIds: Set<string> | null): string[] {
  return orderFromDoublesFinal(computeDoublesRatings(rows), femaleIds);
}

/**
 * How many places each player's Glicko-2 singles rank moved versus the
 * ranking as it stood right before the most recently played tournament (see
 * excludeLatestTournament) - the "did I move up/down" arrow on /rating and
 * the player profile's RatingCard. Recomputed from the same raw match rows
 * as getSinglesRatings, not a separate stored history - consistent with the
 * rest of this file's "always recompute, never a mutable running total"
 * approach (see docs/RATING.md).
 */
export async function getSinglesRatingsTrend(scope: RatingScope = "general"): Promise<Map<string, number>> {
  // "Current" order (and its rows) reuse the shared per-request replay
  // (getSinglesRatings/getUpsetWins on the same page get it for free) rather
  // than a second fetchRatingMatchRows call - "previous" necessarily
  // recomputes over its own excludeLatestTournament subset, a genuinely
  // different row set that can't share the cache key above.
  const [{ rows, final }, femaleIds] = await Promise.all([getSinglesHistoryReplay(scope), femaleIdsForScope(scope)]);
  return buildRankDeltaMap(
    orderFromSinglesFinal(final, femaleIds),
    sortedSinglesOrder(excludeLatestTournament(rows), femaleIds),
  );
}

/** OpenSkill doubles equivalent of getSinglesRatingsTrend. */
export async function getDoublesRatingsTrend(scope: RatingScope = "general"): Promise<Map<string, number>> {
  const [{ rows, final }, femaleIds] = await Promise.all([getDoublesHistoryReplay(scope), femaleIdsForScope(scope)]);
  return buildRankDeltaMap(
    orderFromDoublesFinal(final, femaleIds),
    sortedDoublesOrder(excludeLatestTournament(rows), femaleIds),
  );
}

export type RatingHistoryPoint = { tournamentId: string; asOfDate: string; rating: number; spread: number };

/** RatingScope -> RatingSnapshot.pool (see the schema comment on that column) - also reused by snapshot.ts, the single source of truth for this mapping. */
export const SNAPSHOT_POOL: Record<RatingScope, PrismaRatingPool> = { general: "GENERAL", women: "WOMEN" };

/** One player's rating-over-time history for one format, oldest first - reads RatingSnapshot (see src/lib/rating/snapshot.ts), not a live recomputation. */
export const getPlayerRatingHistory = unstable_cache(
  async (playerId: string, matchType: MatchType, scope: RatingScope = "general"): Promise<RatingHistoryPoint[]> => {
    // refreshRatingSnapshots stores a WOMEN-pool row for every match
    // participant, including a non-female player filling out a bracket (see
    // fetchRatingMatchRows) - snapshots are a pure display cache, so this
    // (like every other list-returning function in this file) hides him at
    // read time rather than baking the gender check into what gets stored,
    // which would go stale the moment his Player.gender is edited.
    const femaleIds = await femaleIdsForScope(scope);
    if (femaleIds && !femaleIds.has(playerId)) return [];
    const rows = await prisma.ratingSnapshot.findMany({
      where: { playerId, matchType, pool: SNAPSHOT_POOL[scope] },
      orderBy: { asOfDate: "asc" },
      select: { tournamentId: true, asOfDate: true, rating: true, spread: true },
    });
    return rows.map((r) => ({ ...r, asOfDate: r.asOfDate.toISOString() }));
  },
  ["player-rating-history"],
  CACHE_OPTIONS,
);

/**
 * Every player's rating history for one format in a single query, keyed by
 * playerId - powers the /rating table's sparkline column (docs/DESIGN_ROADMAP_2026.md
 * #1). Calling getPlayerRatingHistory once per row would be an N+1 query
 * against the whole club roster; this fetches the entire RatingSnapshot table
 * for the format once and groups it in memory instead.
 *
 * Returns a plain object, not a Map - unstable_cache round-trips its return
 * value through JSON (see fetchRatingMatchRows's tournamentStartDate comment
 * for the same gotcha with Date), and JSON.stringify(map) silently produces
 * "{}", losing every entry.
 */
export const getAllRatingHistories = unstable_cache(
  async (matchType: MatchType, scope: RatingScope = "general"): Promise<Record<string, RatingHistoryPoint[]>> => {
    const [rows, femaleIds] = await Promise.all([
      prisma.ratingSnapshot.findMany({
        where: { matchType, pool: SNAPSHOT_POOL[scope] },
        orderBy: { asOfDate: "asc" },
        select: { playerId: true, tournamentId: true, asOfDate: true, rating: true, spread: true },
      }),
      femaleIdsForScope(scope),
    ]);
    const byPlayer: Record<string, RatingHistoryPoint[]> = {};
    for (const { playerId, ...point } of rows) {
      // See getPlayerRatingHistory's comment - same read-time hiding, not baked into storage.
      if (femaleIds && !femaleIds.has(playerId)) continue;
      const entry = { ...point, asOfDate: point.asOfDate.toISOString() };
      (byPlayer[playerId] ??= []).push(entry);
    }
    return byPlayer;
  },
  ["all-rating-histories"],
  CACHE_OPTIONS,
);

/**
 * The default SET.club period (see docs/RATING.md's "Загальний" section) -
 * a rolling 52-week window from "now", ATP-Rankings-style: a tournament's
 * points count for exactly 52 weeks from its startDate, then age out on
 * their own as time passes, rather than every player's points resetting to
 * zero on January 1st. The specific-calendar-year values `getSetClubSeasons`
 * returns are an additional, opt-in historical view alongside this default.
 */
export const ROLLING_SEASON = "rolling" as const;
export type SetClubSeason = number | typeof ROLLING_SEASON;

/** Below this many completed matches, a player's rating is still converging (high sigma/RD) and
 * doesn't get a numbered rank in the official (Glicko-2/OpenSkill) tables - shown in a separate
 * "still forming" section instead, sorted the same way, until they cross the threshold. Shared by
 * /rating, /padel/rating, and the player profile's own rank display so all three agree on the
 * same cutoff. */
export const PROVISIONAL_MATCH_THRESHOLD = 10;

/** Distinct seasons (calendar years, newest first) with at least one completed match of this format - shown as extra pills on /rating alongside the rolling-52-week default (see ROLLING_SEASON). */
export async function getSetClubSeasons(matchType: MatchType, scope: RatingScope = "general"): Promise<number[]> {
  const rows = await fetchRatingMatchRows(matchType, scope);
  const years = new Set(rows.map((row) => new Date(row.tournamentStartDate).getUTCFullYear()));
  return [...years].sort((a, b) => b - a);
}

/** Set Club doubles points for one period - see ROLLING_SEASON and docs/RATING.md. */
export async function getDoublesSetClubPoints(
  season: SetClubSeason,
  scope: RatingScope = "general",
): Promise<SetClubPointsRow[]> {
  const [rows, femaleIds] = await Promise.all([fetchRatingMatchRows("DOUBLES", scope), femaleIdsForScope(scope)]);
  const points = [...computeDoublesSetClubPoints(filterBySeason(rows, season)).values()];
  return sortSetClubPoints(filterEligible(points, femaleIds));
}

/** Set Club singles points for one period - place-ladder + field-size bonus, see ROLLING_SEASON and docs/RATING.md. */
export async function getSinglesSetClubPoints(
  season: SetClubSeason,
  scope: RatingScope = "general",
): Promise<SetClubPointsRow[]> {
  const [rows, femaleIds] = await Promise.all([fetchRatingMatchRows("SINGLES", scope), femaleIdsForScope(scope)]);
  const points = [...computeSinglesSetClubPoints(filterBySeason(rows, season)).values()];
  return sortSetClubPoints(filterEligible(points, femaleIds));
}

function sortedSetClubOrder(
  rows: RatingMatchRow[],
  computeSetClubPoints: (rows: RatingMatchRow[]) => Map<string, SetClubPointsRow>,
  femaleIds: Set<string> | null,
): string[] {
  const points = [...computeSetClubPoints(rows).values()];
  return sortSetClubPoints(filterEligible(points, femaleIds)).map((row) => row.playerId);
}

/**
 * Rank-change equivalent of getSinglesRatingsTrend/getDoublesRatingsTrend for
 * the SET.club points ladder - "previous" excludes the latest tournament
 * *within the already season-filtered row set*, not the club's all-time
 * latest tournament, so a "2024" season view compares against 2024's own
 * previous tournament rather than whatever the newest tournament happens to
 * be club-wide.
 */
export async function getSinglesSetClubTrend(
  season: SetClubSeason,
  scope: RatingScope = "general",
): Promise<Map<string, number>> {
  const [matchRows, femaleIds] = await Promise.all([fetchRatingMatchRows("SINGLES", scope), femaleIdsForScope(scope)]);
  const rows = filterBySeason(matchRows, season);
  return buildRankDeltaMap(
    sortedSetClubOrder(rows, computeSinglesSetClubPoints, femaleIds),
    sortedSetClubOrder(excludeLatestTournament(rows), computeSinglesSetClubPoints, femaleIds),
  );
}

/** Doubles equivalent of getSinglesSetClubTrend. */
export async function getDoublesSetClubTrend(
  season: SetClubSeason,
  scope: RatingScope = "general",
): Promise<Map<string, number>> {
  const [matchRows, femaleIds] = await Promise.all([fetchRatingMatchRows("DOUBLES", scope), femaleIdsForScope(scope)]);
  const rows = filterBySeason(matchRows, season);
  return buildRankDeltaMap(
    sortedSetClubOrder(rows, computeDoublesSetClubPoints, femaleIds),
    sortedSetClubOrder(excludeLatestTournament(rows), computeDoublesSetClubPoints, femaleIds),
  );
}
