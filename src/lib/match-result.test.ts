import { describe, expect, it } from "vitest";

import { determineMatchWinner, determineSetWinner } from "@/lib/match-result";

describe("determineSetWinner", () => {
  it("picks the side with more games", () => {
    expect(determineSetWinner({ sideAGames: 6, sideBGames: 4 })).toBe("A");
    expect(determineSetWinner({ sideAGames: 3, sideBGames: 6 })).toBe("B");
  });

  it("returns null for a tied set", () => {
    expect(determineSetWinner({ sideAGames: 6, sideBGames: 6 })).toBeNull();
  });
});

describe("determineMatchWinner", () => {
  it("wins in straight sets", () => {
    const sets = [
      { sideAGames: 6, sideBGames: 4 },
      { sideAGames: 6, sideBGames: 3 },
    ];
    expect(determineMatchWinner(sets)).toBe("A");
  });

  it("wins after dropping a set (best of 3)", () => {
    const sets = [
      { sideAGames: 4, sideBGames: 6 },
      { sideAGames: 6, sideBGames: 2 },
      { sideAGames: 7, sideBGames: 5 },
    ];
    expect(determineMatchWinner(sets)).toBe("A");
  });

  it("returns null when sets are evenly split", () => {
    const sets = [
      { sideAGames: 6, sideBGames: 4 },
      { sideAGames: 4, sideBGames: 6 },
    ];
    expect(determineMatchWinner(sets)).toBeNull();
  });

  it("returns null when there are no sets", () => {
    expect(determineMatchWinner([])).toBeNull();
  });

  it("ignores tied sets when counting", () => {
    const sets = [
      { sideAGames: 6, sideBGames: 6 },
      { sideAGames: 6, sideBGames: 2 },
    ];
    expect(determineMatchWinner(sets)).toBe("A");
  });
});
