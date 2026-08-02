import { describe, expect, it } from "vitest";

import { conservativeRating, GLICKO2_DEFAULT, updateGlicko2Period } from "./glicko2";
import type { Glicko2Rating } from "./glicko2";

describe("updateGlicko2Period", () => {
  it("reproduces Glickman's official Glicko-2 worked example", () => {
    // http://www.glicko.net/glicko/glicko2.pdf, section "Example calculation"
    const player: Glicko2Rating = { rating: 1500, rd: 200, volatility: 0.06 };
    const result = updateGlicko2Period(
      player,
      [
        { opponent: { rating: 1400, rd: 30, volatility: 0.06 }, score: 1 },
        { opponent: { rating: 1550, rd: 100, volatility: 0.06 }, score: 0 },
        { opponent: { rating: 1700, rd: 300, volatility: 0.06 }, score: 0 },
      ],
      0.5,
    );

    expect(result.rating).toBeCloseTo(1464.06, 1);
    expect(result.rd).toBeCloseTo(151.52, 1);
    expect(result.volatility).toBeCloseTo(0.05999, 4);
  });

  it("only inflates RD when a player has no games in the period", () => {
    const player: Glicko2Rating = { rating: 1500, rd: 200, volatility: 0.06 };
    const result = updateGlicko2Period(player, []);

    expect(result.rating).toBe(1500);
    expect(result.volatility).toBe(0.06);
    expect(result.rd).toBeGreaterThan(200);
  });

  it("gives a bigger rating gain for a more dominant win against an equal opponent", () => {
    const player: Glicko2Rating = { ...GLICKO2_DEFAULT };
    const opponent: Glicko2Rating = { ...GLICKO2_DEFAULT };

    const narrowWin = updateGlicko2Period(player, [{ opponent, score: 0.55 }]);
    const dominantWin = updateGlicko2Period(player, [{ opponent, score: 0.95 }]);

    expect(dominantWin.rating - GLICKO2_DEFAULT.rating).toBeGreaterThan(
      narrowWin.rating - GLICKO2_DEFAULT.rating,
    );
  });
});

describe("conservativeRating", () => {
  it("subtracts k times RD from the rating", () => {
    const r: Glicko2Rating = { rating: 1500, rd: 100, volatility: 0.06 };
    expect(conservativeRating(r)).toBe(1300);
    expect(conservativeRating(r, 1)).toBe(1400);
  });
});
