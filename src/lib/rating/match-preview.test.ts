import { describe, expect, it } from "vitest";

import { GLICKO2_DEFAULT } from "./glicko2";
import { buildMatchPreview } from "./match-preview";
import { OPENSKILL_DEFAULT } from "./openskill";

const STRONG_SINGLES = { rating: 1700, rd: 60, volatility: 0.06 };
const WEAK_SINGLES = { rating: 1300, rd: 60, volatility: 0.06 };

describe("buildMatchPreview", () => {
  it("gives the higher-rated singles player the bigger win probability", () => {
    const singles = new Map([
      ["strong", STRONG_SINGLES],
      ["weak", WEAK_SINGLES],
    ]);
    const preview = buildMatchPreview(
      {
        matchType: "SINGLES",
        players: [
          { side: "A", playerId: "strong" },
          { side: "B", playerId: "weak" },
        ],
      },
      singles,
      new Map(),
    );
    expect(preview).not.toBeNull();
    expect(preview!.probA).toBeGreaterThan(preview!.probB);
    expect(preview!.probA + preview!.probB).toBeCloseTo(1, 5);
  });

  it("returns null for singles when a player has no rating yet", () => {
    const singles = new Map([["strong", STRONG_SINGLES]]);
    const preview = buildMatchPreview(
      {
        matchType: "SINGLES",
        players: [
          { side: "A", playerId: "strong" },
          { side: "B", playerId: "unrated" },
        ],
      },
      singles,
      new Map(),
    );
    expect(preview).toBeNull();
  });

  it("returns a two-way split for doubles when all four players are rated", () => {
    const doubles = new Map([
      ["p1", OPENSKILL_DEFAULT],
      ["p2", OPENSKILL_DEFAULT],
      ["p3", OPENSKILL_DEFAULT],
      ["p4", OPENSKILL_DEFAULT],
    ]);
    const preview = buildMatchPreview(
      {
        matchType: "DOUBLES",
        players: [
          { side: "A", playerId: "p1" },
          { side: "A", playerId: "p2" },
          { side: "B", playerId: "p3" },
          { side: "B", playerId: "p4" },
        ],
      },
      new Map(),
      doubles,
    );
    expect(preview).not.toBeNull();
    expect(preview!.probA).toBeCloseTo(preview!.probB, 5);
  });

  it("returns null for doubles when one partner has no rating yet", () => {
    const doubles = new Map([
      ["p1", OPENSKILL_DEFAULT],
      ["p3", OPENSKILL_DEFAULT],
      ["p4", OPENSKILL_DEFAULT],
    ]);
    const preview = buildMatchPreview(
      {
        matchType: "DOUBLES",
        players: [
          { side: "A", playerId: "p1" },
          { side: "A", playerId: "p2" },
          { side: "B", playerId: "p3" },
          { side: "B", playerId: "p4" },
        ],
      },
      new Map(),
      doubles,
    );
    expect(preview).toBeNull();
  });

  it("returns null when a side has no players", () => {
    const preview = buildMatchPreview(
      { matchType: "SINGLES", players: [{ side: "A", playerId: "strong" }] },
      new Map([["strong", GLICKO2_DEFAULT]]),
      new Map(),
    );
    expect(preview).toBeNull();
  });
});
