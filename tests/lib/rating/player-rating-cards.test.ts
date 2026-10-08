import { describe, expect, it, vi } from "vitest";

// ratings-data pulls in the Prisma client; only its threshold constant matters here.
vi.mock("@/lib/rating/ratings-data", () => ({ PROVISIONAL_MATCH_THRESHOLD: 10 }));

import type { DoublesRatingRow, SinglesRatingRow } from "@/lib/rating/engine";
import { conservativeRating } from "@/lib/rating/glicko2";
import { conservativeOrdinal, displaySpread } from "@/lib/rating/openskill";
import { buildDoublesRatingCard, buildSinglesRatingCard } from "@/lib/rating/player-rating-cards";
import { PROVISIONAL_MATCH_THRESHOLD } from "@/lib/rating/ratings-data";

const ENOUGH = PROVISIONAL_MATCH_THRESHOLD;

function singles(playerId: string, rating: number, matchesPlayed = ENOUGH): SinglesRatingRow {
  return { playerId, rating: { rating, rd: 50, volatility: 0.06 }, matchesPlayed };
}

function doubles(playerId: string, mu: number, matchesPlayed = ENOUGH): DoublesRatingRow {
  return { playerId, rating: { mu, sigma: 4 }, matchesPlayed };
}

const setClub = [
  { playerId: "a", points: 90, tournamentsPlayed: 5 },
  { playerId: "b", points: 60, tournamentsPlayed: 4 },
  { playerId: "c", points: 30, tournamentsPlayed: 2 },
];

describe("buildSinglesRatingCard", () => {
  it("returns null for a player with no rating row", () => {
    expect(buildSinglesRatingCard("ghost", [singles("a", 1700)], new Map(), [], new Map())).toBeNull();
  });

  it("builds a ranked card: rounded conservative rating/spread, rank, trend and total", () => {
    const rows = [singles("a", 1800), singles("b", 1700), singles("c", 1600)];
    const card = buildSinglesRatingCard("b", rows, new Map([["b", 2]]), [], new Map());
    expect(card).toMatchObject({
      rating: Math.round(conservativeRating(rows[1].rating)),
      spread: 50,
      rank: 2,
      rankDelta: 2,
      total: 3,
      isProvisional: false,
      setClub: null,
    });
  });

  it("gives a provisional player (too few matches) no rank, and leaves them out of the total", () => {
    const rows = [singles("a", 1800), singles("b", 1700), singles("new", 1750, ENOUGH - 1)];
    const card = buildSinglesRatingCard("new", rows, new Map(), [], new Map());
    expect(card).toMatchObject({ rank: null, isProvisional: true, total: 2 });
  });

  it("ranks among established players only - a provisional row above doesn't push the rank down", () => {
    const rows = [singles("new", 1900, 1), singles("a", 1800), singles("b", 1700)];
    expect(buildSinglesRatingCard("a", rows, new Map(), [], new Map())?.rank).toBe(1);
  });

  it("attaches the SET.club standing when the player has points, with its own rank, trend and total", () => {
    const card = buildSinglesRatingCard("b", [singles("b", 1700)], new Map(), setClub, new Map([["b", -1]]));
    expect(card?.setClub).toEqual({ points: 60, rank: 2, rankDelta: -1, total: 3 });
  });

  it("has no SET.club block for a player absent from the points table", () => {
    const card = buildSinglesRatingCard("z", [singles("z", 1500)], new Map(), setClub, new Map());
    expect(card?.setClub).toBeNull();
  });

  it("leaves rankDelta undefined when the trend map has no entry", () => {
    expect(buildSinglesRatingCard("a", [singles("a", 1800)], new Map(), [], new Map())?.rankDelta).toBeUndefined();
  });
});

describe("buildDoublesRatingCard", () => {
  it("returns null for a player with no rating row", () => {
    expect(buildDoublesRatingCard("ghost", [doubles("a", 28)], new Map(), [], new Map())).toBeNull();
  });

  it("builds a ranked card from the OpenSkill ordinal and displayed spread", () => {
    const rows = [doubles("a", 30), doubles("b", 25)];
    const card = buildDoublesRatingCard("a", rows, new Map([["a", 1]]), setClub, new Map());
    expect(card).toMatchObject({
      rating: Math.round(conservativeOrdinal(rows[0].rating)),
      spread: Math.round(displaySpread(4)),
      rank: 1,
      rankDelta: 1,
      total: 2,
      isProvisional: false,
    });
    expect(card?.setClub).toMatchObject({ rank: 1, points: 90, total: 3 });
  });

  it("marks a player under the provisional threshold as unranked", () => {
    const rows = [doubles("a", 30), doubles("new", 29, 2)];
    const card = buildDoublesRatingCard("new", rows, new Map(), [], new Map());
    expect(card).toMatchObject({ rank: null, isProvisional: true, total: 1 });
  });
});
