import { unstable_cache } from "next/cache";

import type { MatchType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { STATS_CACHE_TAG } from "@/lib/stats";

import { computeDoublesRatings, computeSinglesRatings } from "./engine";
import type { DoublesRatingRow, RatingMatchRow, SinglesRatingRow } from "./engine";
import { conservativeRating } from "./glicko2";
import { conservativeOrdinal } from "./openskill";
import type { SetClubPointsRow } from "./placement";
import { buildRankDeltaMap, excludeLatestTournament } from "./rank-trend";
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

/** Exported for src/lib/rating/snapshot.ts, which replays the same rows to rebuild RatingSnapshot. */
export const fetchRatingMatchRows = unstable_cache(
  async (matchType: MatchType): Promise<RatingMatchRow[]> => {
    const rows = await prisma.match.findMany({
      // A walkover (technical loss from withdrawParticipantAction) is
      // excluded from rating entirely, for both sides - see
      // docs/WITHDRAWAL.md.
      where: { status: "COMPLETED", winnerSide: { not: null }, matchType, walkover: false },
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

export async function getSinglesRatings(): Promise<SinglesRatingRow[]> {
  const rows = await fetchRatingMatchRows("SINGLES");
  return [...computeSinglesRatings(rows).values()].sort(
    (a, b) => conservativeRating(b.rating) - conservativeRating(a.rating),
  );
}

export async function getDoublesRatings(): Promise<DoublesRatingRow[]> {
  const rows = await fetchRatingMatchRows("DOUBLES");
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

/**
 * How many places each player's Glicko-2 singles rank moved versus the
 * ranking as it stood right before the most recently played tournament (see
 * excludeLatestTournament) - the "did I move up/down" arrow on /rating and
 * the player profile's RatingCard. Recomputed from the same raw match rows
 * as getSinglesRatings, not a separate stored history - consistent with the
 * rest of this file's "always recompute, never a mutable running total"
 * approach (see docs/RATING.md).
 */
export async function getSinglesRatingsTrend(): Promise<Map<string, number>> {
  const rows = await fetchRatingMatchRows("SINGLES");
  return buildRankDeltaMap(sortedSinglesOrder(rows), sortedSinglesOrder(excludeLatestTournament(rows)));
}

/** OpenSkill doubles equivalent of getSinglesRatingsTrend. */
export async function getDoublesRatingsTrend(): Promise<Map<string, number>> {
  const rows = await fetchRatingMatchRows("DOUBLES");
  return buildRankDeltaMap(sortedDoublesOrder(rows), sortedDoublesOrder(excludeLatestTournament(rows)));
}

export type RatingHistoryPoint = { tournamentId: string; asOfDate: string; rating: number; spread: number };

/** One player's rating-over-time history for one format, oldest first - reads RatingSnapshot (see src/lib/rating/snapshot.ts), not a live recomputation. */
export const getPlayerRatingHistory = unstable_cache(
  async (playerId: string, matchType: MatchType): Promise<RatingHistoryPoint[]> => {
    const rows = await prisma.ratingSnapshot.findMany({
      where: { playerId, matchType },
      orderBy: { asOfDate: "asc" },
      select: { tournamentId: true, asOfDate: true, rating: true, spread: true },
    });
    return rows.map((r) => ({ ...r, asOfDate: r.asOfDate.toISOString() }));
  },
  ["player-rating-history"],
  CACHE_OPTIONS,
);

function sortSetClubPoints(rows: SetClubPointsRow[]): SetClubPointsRow[] {
  return [...rows].sort(
    (a, b) => b.points - a.points || b.tournamentsPlayed - a.tournamentsPlayed || a.playerId.localeCompare(b.playerId),
  );
}

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

const ROLLING_WINDOW_MS = 52 * 7 * 24 * 60 * 60 * 1000;

/** Distinct seasons (calendar years, newest first) with at least one completed match of this format - shown as extra pills on /rating alongside the rolling-52-week default (see ROLLING_SEASON). */
export async function getSetClubSeasons(matchType: MatchType): Promise<number[]> {
  const rows = await fetchRatingMatchRows(matchType);
  const years = new Set(rows.map((row) => new Date(row.tournamentStartDate).getUTCFullYear()));
  return [...years].sort((a, b) => b - a);
}

function filterBySeason<T extends { tournamentStartDate: number }>(rows: T[], season: SetClubSeason): T[] {
  return season === ROLLING_SEASON
    ? rows.filter((row) => row.tournamentStartDate >= Date.now() - ROLLING_WINDOW_MS)
    : rows.filter((row) => new Date(row.tournamentStartDate).getUTCFullYear() === season);
}

/** Set Club doubles points for one period - see ROLLING_SEASON and docs/RATING.md. */
export async function getDoublesSetClubPoints(season: SetClubSeason): Promise<SetClubPointsRow[]> {
  const rows = await fetchRatingMatchRows("DOUBLES");
  return sortSetClubPoints([...computeDoublesSetClubPoints(filterBySeason(rows, season)).values()]);
}

/** Set Club singles points for one period - place-ladder + field-size bonus, see ROLLING_SEASON and docs/RATING.md. */
export async function getSinglesSetClubPoints(season: SetClubSeason): Promise<SetClubPointsRow[]> {
  const rows = await fetchRatingMatchRows("SINGLES");
  return sortSetClubPoints([...computeSinglesSetClubPoints(filterBySeason(rows, season)).values()]);
}

function sortedSetClubOrder(rows: RatingMatchRow[], computeSetClubPoints: (rows: RatingMatchRow[]) => Map<string, SetClubPointsRow>): string[] {
  return sortSetClubPoints([...computeSetClubPoints(rows).values()]).map((row) => row.playerId);
}

/**
 * Rank-change equivalent of getSinglesRatingsTrend/getDoublesRatingsTrend for
 * the SET.club points ladder - "previous" excludes the latest tournament
 * *within the already season-filtered row set*, not the club's all-time
 * latest tournament, so a "2024" season view compares against 2024's own
 * previous tournament rather than whatever the newest tournament happens to
 * be club-wide.
 */
export async function getSinglesSetClubTrend(season: SetClubSeason): Promise<Map<string, number>> {
  const rows = filterBySeason(await fetchRatingMatchRows("SINGLES"), season);
  return buildRankDeltaMap(
    sortedSetClubOrder(rows, computeSinglesSetClubPoints),
    sortedSetClubOrder(excludeLatestTournament(rows), computeSinglesSetClubPoints),
  );
}

/** Doubles equivalent of getSinglesSetClubTrend. */
export async function getDoublesSetClubTrend(season: SetClubSeason): Promise<Map<string, number>> {
  const rows = filterBySeason(await fetchRatingMatchRows("DOUBLES"), season);
  return buildRankDeltaMap(
    sortedSetClubOrder(rows, computeDoublesSetClubPoints),
    sortedSetClubOrder(excludeLatestTournament(rows), computeDoublesSetClubPoints),
  );
}
