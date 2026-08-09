import { unstable_cache } from "next/cache";

import type { MatchType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { STATS_CACHE_TAG } from "@/lib/stats";

import { computeDoublesRatings, computeSinglesRatings } from "./engine";
import type { DoublesRatingRow, RatingMatchRow, SinglesRatingRow } from "./engine";
import { conservativeRating } from "./glicko2";
import { conservativeOrdinal } from "./openskill";
import type { SetClubPointsRow } from "./placement";
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
