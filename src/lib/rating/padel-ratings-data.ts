import { unstable_cache } from "next/cache";

import type { MatchType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { PADEL_STATS_CACHE_TAG } from "@/lib/padel-stats";

import { computeDoublesRatings, computeSinglesRatings } from "./engine";
import type { DoublesRatingRow, RatingMatchRow, SinglesRatingRow } from "./engine";
import { conservativeRating } from "./glicko2";
import { conservativeOrdinal } from "./openskill";
import type { SetClubPointsRow } from "./placement";
import { buildRankDeltaMap, excludeLatestTournament } from "./rank-trend";
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

/** Exported for src/lib/rating/padel-snapshot.ts, which replays the same rows to rebuild PadelRatingSnapshot. */
export const fetchPadelRatingMatchRows = unstable_cache(
  async (matchType: MatchType): Promise<RatingMatchRow[]> => {
    const rows = await prisma.padelMatch.findMany({
      where: { status: "COMPLETED", winnerSide: { not: null }, matchType, walkover: false },
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

export async function getPadelSinglesRatings(): Promise<SinglesRatingRow[]> {
  const rows = await fetchPadelRatingMatchRows("SINGLES");
  return [...computeSinglesRatings(rows).values()].sort(
    (a, b) => conservativeRating(b.rating) - conservativeRating(a.rating),
  );
}

export async function getPadelDoublesRatings(): Promise<DoublesRatingRow[]> {
  const rows = await fetchPadelRatingMatchRows("DOUBLES");
  return [...computeDoublesRatings(rows).values()].sort(
    (a, b) => conservativeOrdinal(b.rating) - conservativeOrdinal(a.rating),
  );
}

function sortedSinglesOrder(rows: RatingMatchRow[]): string[] {
  return [...computeSinglesRatings(rows).values()]
    .sort((a, b) => conservativeRating(b.rating) - conservativeRating(a.rating))
    .map((row) => row.playerId);
}

function sortedDoublesOrder(rows: RatingMatchRow[]): string[] {
  return [...computeDoublesRatings(rows).values()]
    .sort((a, b) => conservativeOrdinal(b.rating) - conservativeOrdinal(a.rating))
    .map((row) => row.playerId);
}

/** Padel twin of getSinglesRatingsTrend. */
export async function getPadelSinglesRatingsTrend(): Promise<Map<string, number>> {
  const rows = await fetchPadelRatingMatchRows("SINGLES");
  return buildRankDeltaMap(sortedSinglesOrder(rows), sortedSinglesOrder(excludeLatestTournament(rows)));
}

/** Padel twin of getDoublesRatingsTrend. */
export async function getPadelDoublesRatingsTrend(): Promise<Map<string, number>> {
  const rows = await fetchPadelRatingMatchRows("DOUBLES");
  return buildRankDeltaMap(sortedDoublesOrder(rows), sortedDoublesOrder(excludeLatestTournament(rows)));
}

export type PadelRatingHistoryPoint = { tournamentId: string; asOfDate: string; rating: number; spread: number };

/** Padel twin of getPlayerRatingHistory - reads PadelRatingSnapshot, not a live recomputation. */
export const getPlayerPadelRatingHistory = unstable_cache(
  async (playerId: string, matchType: MatchType): Promise<PadelRatingHistoryPoint[]> => {
    const rows = await prisma.padelRatingSnapshot.findMany({
      where: { playerId, matchType },
      orderBy: { asOfDate: "asc" },
      select: { tournamentId: true, asOfDate: true, rating: true, spread: true },
    });
    return rows.map((r) => ({ ...r, asOfDate: r.asOfDate.toISOString() }));
  },
  ["padel-player-rating-history"],
  CACHE_OPTIONS,
);

function sortSetClubPoints(rows: SetClubPointsRow[]): SetClubPointsRow[] {
  return [...rows].sort(
    (a, b) => b.points - a.points || b.tournamentsPlayed - a.tournamentsPlayed || a.playerId.localeCompare(b.playerId),
  );
}

/** Padel twin of ROLLING_SEASON/SetClubSeason. */
export const PADEL_ROLLING_SEASON = "rolling" as const;
export type PadelSetClubSeason = number | typeof PADEL_ROLLING_SEASON;

const ROLLING_WINDOW_MS = 52 * 7 * 24 * 60 * 60 * 1000;

/** Padel twin of getSetClubSeasons. */
export async function getPadelSetClubSeasons(matchType: MatchType): Promise<number[]> {
  const rows = await fetchPadelRatingMatchRows(matchType);
  const years = new Set(rows.map((row) => new Date(row.tournamentStartDate).getUTCFullYear()));
  return [...years].sort((a, b) => b - a);
}

function filterBySeason<T extends { tournamentStartDate: number }>(rows: T[], season: PadelSetClubSeason): T[] {
  return season === PADEL_ROLLING_SEASON
    ? rows.filter((row) => row.tournamentStartDate >= Date.now() - ROLLING_WINDOW_MS)
    : rows.filter((row) => new Date(row.tournamentStartDate).getUTCFullYear() === season);
}

/** Padel twin of getDoublesSetClubPoints. */
export async function getPadelDoublesSetClubPoints(season: PadelSetClubSeason): Promise<SetClubPointsRow[]> {
  const rows = await fetchPadelRatingMatchRows("DOUBLES");
  return sortSetClubPoints([...computeDoublesSetClubPoints(filterBySeason(rows, season)).values()]);
}

/** Padel twin of getSinglesSetClubPoints. */
export async function getPadelSinglesSetClubPoints(season: PadelSetClubSeason): Promise<SetClubPointsRow[]> {
  const rows = await fetchPadelRatingMatchRows("SINGLES");
  return sortSetClubPoints([...computeSinglesSetClubPoints(filterBySeason(rows, season)).values()]);
}

function sortedSetClubOrder(rows: RatingMatchRow[], computeSetClubPoints: (rows: RatingMatchRow[]) => Map<string, SetClubPointsRow>): string[] {
  return sortSetClubPoints([...computeSetClubPoints(rows).values()]).map((row) => row.playerId);
}

/** Padel twin of getSinglesSetClubTrend. */
export async function getPadelSinglesSetClubTrend(season: PadelSetClubSeason): Promise<Map<string, number>> {
  const rows = filterBySeason(await fetchPadelRatingMatchRows("SINGLES"), season);
  return buildRankDeltaMap(
    sortedSetClubOrder(rows, computeSinglesSetClubPoints),
    sortedSetClubOrder(excludeLatestTournament(rows), computeSinglesSetClubPoints),
  );
}

/** Padel twin of getDoublesSetClubTrend. */
export async function getPadelDoublesSetClubTrend(season: PadelSetClubSeason): Promise<Map<string, number>> {
  const rows = filterBySeason(await fetchPadelRatingMatchRows("DOUBLES"), season);
  return buildRankDeltaMap(
    sortedSetClubOrder(rows, computeDoublesSetClubPoints),
    sortedSetClubOrder(excludeLatestTournament(rows), computeDoublesSetClubPoints),
  );
}
