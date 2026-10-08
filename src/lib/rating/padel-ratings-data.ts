import { unstable_cache } from "next/cache";
import { cache } from "react";

import type { MatchType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { PADEL_STATS_CACHE_TAG } from "@/lib/padel-stats";

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
import { SNAPSHOT_POOL } from "./ratings-data";
import { computeDoublesSetClubPoints } from "./setclub";
import { computeSinglesSetClubPoints } from "./setclub-singles";

// Padel twin of ratings-data.ts - reuses engine.ts/glicko2.ts/openskill.ts/
// placement.ts/setclub.ts/setclub-singles.ts/rank-trend.ts as-is (all pure
// functions over RatingMatchRow[]/plain data, no Prisma coupling) so only
// the row-fetching (below) needs a separate Padel implementation.
const CACHE_OPTIONS = { tags: [PADEL_STATS_CACHE_TAG], revalidate: 60 };

const padelMatchSelect = {
  id: true,
  tournamentId: true,
  tournament: {
    select: {
      startDate: true,
      participants: { select: { playerId: true, seed: true } },
    },
  },
  winnerSide: true,
  createdAt: true,
  round: true,
  players: { select: { side: true, playerId: true } },
  sets: { select: { sideAGames: true, sideBGames: true } },
} as const;

/**
 * Exported for src/lib/rating/padel-snapshot.ts, which replays the same rows to rebuild PadelRatingSnapshot.
 * `scope` is the same RatingScope as Tennis (ratings-data.ts): "general" is every padel tournament except
 * those marked `isWomensOnly` (PadelTournament.isWomensOnly), "women" is only those - a tournament belongs
 * to exactly one pool. See docs/RATING.md's women's-pool section.
 */
export const fetchPadelRatingMatchRows = unstable_cache(
  async (matchType: MatchType, scope: RatingScope = "general"): Promise<RatingMatchRow[]> => {
    const rows = await prisma.padelMatch.findMany({
      where: {
        status: "COMPLETED",
        winnerSide: { not: null },
        matchType,
        walkover: false,
        tournament: { isWomensOnly: scope === "women" },
      },
      select: padelMatchSelect,
    });
    return rows.map((row) => {
      const seededByPlayer = new Map(
        row.tournament.participants.map((p) => [p.playerId, p.seed !== null]),
      );
      return {
        id: row.id,
        tournamentId: row.tournamentId,
        tournamentStartDate: new Date(row.tournament.startDate).getTime(),
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
  ["padel-rating-match-rows"],
  CACHE_OPTIONS,
);

/** Padel twin of ratings-data.ts's getSinglesHistoryReplay/getDoublesHistoryReplay - see its doc comment (including why `rows` rides along). */
const getPadelSinglesHistoryReplay = cache(async (scope: RatingScope) => {
  const rows = await fetchPadelRatingMatchRows("SINGLES", scope);
  return { rows, ...computeSinglesRatingsWithHistory(rows) };
});
const getPadelDoublesHistoryReplay = cache(async (scope: RatingScope) => {
  const rows = await fetchPadelRatingMatchRows("DOUBLES", scope);
  return { rows, ...computeDoublesRatingsWithHistory(rows) };
});

export async function getPadelSinglesRatings(scope: RatingScope = "general"): Promise<SinglesRatingRow[]> {
  const [{ final }, femaleIds] = await Promise.all([getPadelSinglesHistoryReplay(scope), femaleIdsForScope(scope)]);
  const rows = femaleIds ? [...final.values()].filter((r) => femaleIds.has(r.playerId)) : [...final.values()];
  return rows.sort((a, b) => conservativeRating(b.rating) - conservativeRating(a.rating));
}

export async function getPadelDoublesRatings(scope: RatingScope = "general"): Promise<DoublesRatingRow[]> {
  const [{ final }, femaleIds] = await Promise.all([getPadelDoublesHistoryReplay(scope), femaleIdsForScope(scope)]);
  const rows = femaleIds ? [...final.values()].filter((r) => femaleIds.has(r.playerId)) : [...final.values()];
  return rows.sort((a, b) => conservativeOrdinal(b.rating) - conservativeOrdinal(a.rating));
}

/** Padel twin of ratings-data.ts's getUpsetWins - see its doc comment (cross-request unstable_cache, not just per-request cache()). */
export const getPadelUpsetWins = unstable_cache(
  async (matchType: MatchType, scope: RatingScope = "general"): Promise<MatchUpsetCheck[]> => {
    const { upsets } =
      matchType === "SINGLES" ? await getPadelSinglesHistoryReplay(scope) : await getPadelDoublesHistoryReplay(scope);
    const femaleIds = await femaleIdsForScope(scope);
    if (!femaleIds) return upsets;
    // Same "hide the player, not the match" rule as Tennis's getUpsetWins.
    return upsets
      .map((u) => ({ ...u, winnerIds: u.winnerIds.filter((id) => femaleIds.has(id)) }))
      .filter((u) => u.winnerIds.length > 0);
  },
  ["padel-rating-upset-wins"],
  CACHE_OPTIONS,
);

/** Padel twin of ratings-data.ts's getUpsetWinsByPlayer - see its doc comment. */
export const getPadelUpsetWinsByPlayer = unstable_cache(
  async (matchType: MatchType, scope: RatingScope = "general"): Promise<Record<string, MatchUpsetCheck[]>> => {
    const upsets = await getPadelUpsetWins(matchType, scope);
    const byPlayer: Record<string, MatchUpsetCheck[]> = {};
    for (const upset of upsets) {
      for (const playerId of upset.winnerIds) {
        (byPlayer[playerId] ??= []).push(upset);
      }
    }
    return byPlayer;
  },
  ["padel-rating-upset-wins-by-player"],
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

/** Padel twin of getSinglesRatingsTrend - see its doc comment about sharing the "current" half of the replay (rows included). */
export async function getPadelSinglesRatingsTrend(scope: RatingScope = "general"): Promise<Map<string, number>> {
  const [{ rows, final }, femaleIds] = await Promise.all([getPadelSinglesHistoryReplay(scope), femaleIdsForScope(scope)]);
  return buildRankDeltaMap(
    orderFromSinglesFinal(final, femaleIds),
    sortedSinglesOrder(excludeLatestTournament(rows), femaleIds),
  );
}

/** Padel twin of getDoublesRatingsTrend. */
export async function getPadelDoublesRatingsTrend(scope: RatingScope = "general"): Promise<Map<string, number>> {
  const [{ rows, final }, femaleIds] = await Promise.all([getPadelDoublesHistoryReplay(scope), femaleIdsForScope(scope)]);
  return buildRankDeltaMap(
    orderFromDoublesFinal(final, femaleIds),
    sortedDoublesOrder(excludeLatestTournament(rows), femaleIds),
  );
}

export type PadelRatingHistoryPoint = { tournamentId: string; asOfDate: string; rating: number; spread: number };

/** Padel twin of getPlayerRatingHistory - reads PadelRatingSnapshot, not a live recomputation. */
export const getPlayerPadelRatingHistory = unstable_cache(
  async (playerId: string, matchType: MatchType, scope: RatingScope = "general"): Promise<PadelRatingHistoryPoint[]> => {
    // Snapshots store a WOMEN-pool row for every match participant, including a
    // non-female player filling out a bracket - hidden at read time (see
    // ratings-data.ts's getPlayerRatingHistory), not baked into storage.
    const femaleIds = await femaleIdsForScope(scope);
    if (femaleIds && !femaleIds.has(playerId)) return [];
    const rows = await prisma.padelRatingSnapshot.findMany({
      where: { playerId, matchType, pool: SNAPSHOT_POOL[scope] },
      orderBy: { asOfDate: "asc" },
      select: { tournamentId: true, asOfDate: true, rating: true, spread: true },
    });
    return rows.map((r) => ({ ...r, asOfDate: r.asOfDate.toISOString() }));
  },
  ["padel-player-rating-history"],
  CACHE_OPTIONS,
);

/**
 * Padel twin of getAllRatingHistories - batched sparkline data for the whole
 * /padel/rating table in one query. Plain object, not a Map - see
 * getAllRatingHistories's doc comment for why (unstable_cache's JSON
 * round-trip silently empties a Map).
 */
export const getAllPadelRatingHistories = unstable_cache(
  async (matchType: MatchType, scope: RatingScope = "general"): Promise<Record<string, PadelRatingHistoryPoint[]>> => {
    const [rows, femaleIds] = await Promise.all([
      prisma.padelRatingSnapshot.findMany({
        where: { matchType, pool: SNAPSHOT_POOL[scope] },
        orderBy: { asOfDate: "asc" },
        select: { playerId: true, tournamentId: true, asOfDate: true, rating: true, spread: true },
      }),
      femaleIdsForScope(scope),
    ]);
    const byPlayer: Record<string, PadelRatingHistoryPoint[]> = {};
    for (const { playerId, ...point } of rows) {
      if (femaleIds && !femaleIds.has(playerId)) continue;
      const entry = { ...point, asOfDate: point.asOfDate.toISOString() };
      (byPlayer[playerId] ??= []).push(entry);
    }
    return byPlayer;
  },
  ["all-padel-rating-histories"],
  CACHE_OPTIONS,
);

/** Padel twin of ROLLING_SEASON/SetClubSeason. */
export const PADEL_ROLLING_SEASON = "rolling" as const;
export type PadelSetClubSeason = number | typeof PADEL_ROLLING_SEASON;

/** Padel twin of getSetClubSeasons. */
export async function getPadelSetClubSeasons(matchType: MatchType, scope: RatingScope = "general"): Promise<number[]> {
  const rows = await fetchPadelRatingMatchRows(matchType, scope);
  const years = new Set(rows.map((row) => new Date(row.tournamentStartDate).getUTCFullYear()));
  return [...years].sort((a, b) => b - a);
}

/** Padel twin of getDoublesSetClubPoints. */
export async function getPadelDoublesSetClubPoints(
  season: PadelSetClubSeason,
  scope: RatingScope = "general",
): Promise<SetClubPointsRow[]> {
  const [rows, femaleIds] = await Promise.all([fetchPadelRatingMatchRows("DOUBLES", scope), femaleIdsForScope(scope)]);
  const points = [...computeDoublesSetClubPoints(filterBySeason(rows, season)).values()];
  return sortSetClubPoints(filterEligible(points, femaleIds));
}

/** Padel twin of getSinglesSetClubPoints. */
export async function getPadelSinglesSetClubPoints(
  season: PadelSetClubSeason,
  scope: RatingScope = "general",
): Promise<SetClubPointsRow[]> {
  const [rows, femaleIds] = await Promise.all([fetchPadelRatingMatchRows("SINGLES", scope), femaleIdsForScope(scope)]);
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

/** Padel twin of getSinglesSetClubTrend. */
export async function getPadelSinglesSetClubTrend(
  season: PadelSetClubSeason,
  scope: RatingScope = "general",
): Promise<Map<string, number>> {
  const [matchRows, femaleIds] = await Promise.all([fetchPadelRatingMatchRows("SINGLES", scope), femaleIdsForScope(scope)]);
  const rows = filterBySeason(matchRows, season);
  return buildRankDeltaMap(
    sortedSetClubOrder(rows, computeSinglesSetClubPoints, femaleIds),
    sortedSetClubOrder(excludeLatestTournament(rows), computeSinglesSetClubPoints, femaleIds),
  );
}

/** Padel twin of getDoublesSetClubTrend. */
export async function getPadelDoublesSetClubTrend(
  season: PadelSetClubSeason,
  scope: RatingScope = "general",
): Promise<Map<string, number>> {
  const [matchRows, femaleIds] = await Promise.all([fetchPadelRatingMatchRows("DOUBLES", scope), femaleIdsForScope(scope)]);
  const rows = filterBySeason(matchRows, season);
  return buildRankDeltaMap(
    sortedSetClubOrder(rows, computeDoublesSetClubPoints, femaleIds),
    sortedSetClubOrder(excludeLatestTournament(rows), computeDoublesSetClubPoints, femaleIds),
  );
}
