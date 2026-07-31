import { describe, expect, it } from "vitest";

import {
  determineMatchWinner,
  determineSetWinner,
  isTiebreakSet,
  isValidClassicSet,
  isValidGameTiebreak,
  isValidSetScore,
  isValidSetTiebreak,
  isValidSuperTiebreak,
} from "@/lib/match-result";

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

describe("isValidClassicSet", () => {
  it("accepts 6-0 through 6-4", () => {
    for (let loser = 0; loser <= 4; loser++) {
      expect(isValidClassicSet(6, loser)).toBe(true);
      expect(isValidClassicSet(loser, 6)).toBe(true);
    }
  });

  it("accepts 7-5", () => {
    expect(isValidClassicSet(7, 5)).toBe(true);
    expect(isValidClassicSet(5, 7)).toBe(true);
  });

  it("accepts 7-6 (a 7-point tiebreak)", () => {
    expect(isValidClassicSet(7, 6)).toBe(true);
    expect(isValidClassicSet(6, 7)).toBe(true);
  });

  it("rejects 6-5 (should have continued to 7-5 or a tiebreak)", () => {
    expect(isValidClassicSet(6, 5)).toBe(false);
  });

  it("rejects a tied set", () => {
    expect(isValidClassicSet(6, 6)).toBe(false);
  });

  it("rejects scores outside any legal pattern", () => {
    expect(isValidClassicSet(8, 6)).toBe(false);
    expect(isValidClassicSet(8, 8)).toBe(false);
    expect(isValidClassicSet(5, 3)).toBe(false);
  });
});

describe("isValidSuperTiebreak", () => {
  it("accepts 10-x for x from 0 to 8", () => {
    for (let loser = 0; loser <= 8; loser++) {
      expect(isValidSuperTiebreak(10, loser)).toBe(true);
    }
  });

  it("rejects 10-9 (must win by 2)", () => {
    expect(isValidSuperTiebreak(10, 9)).toBe(false);
  });

  it("accepts deuce-style scores beyond 10, always won by exactly 2", () => {
    expect(isValidSuperTiebreak(11, 9)).toBe(true);
    expect(isValidSuperTiebreak(12, 10)).toBe(true);
  });

  it("rejects a win margin greater than 2 past 10", () => {
    expect(isValidSuperTiebreak(11, 8)).toBe(false);
  });

  it("rejects a score below the 10-point threshold", () => {
    expect(isValidSuperTiebreak(9, 7)).toBe(false);
  });
});

describe("isValidSetScore", () => {
  it("allows a classic set regardless of whether super tiebreaks are allowed", () => {
    expect(isValidSetScore({ sideAGames: 6, sideBGames: 4 }, false)).toBe(true);
    expect(isValidSetScore({ sideAGames: 6, sideBGames: 4 }, true)).toBe(true);
  });

  it("rejects a super-tiebreak score when super tiebreaks aren't allowed for this set", () => {
    expect(isValidSetScore({ sideAGames: 10, sideBGames: 7 }, false)).toBe(false);
  });

  it("allows a super-tiebreak score when explicitly permitted", () => {
    expect(isValidSetScore({ sideAGames: 10, sideBGames: 7 }, true)).toBe(true);
  });

  it("rejects a nonsensical score like 8-8 either way", () => {
    expect(isValidSetScore({ sideAGames: 8, sideBGames: 8 }, false)).toBe(false);
    expect(isValidSetScore({ sideAGames: 8, sideBGames: 8 }, true)).toBe(false);
  });
});

describe("isTiebreakSet", () => {
  it("recognizes 7-6 in either direction", () => {
    expect(isTiebreakSet(7, 6)).toBe(true);
    expect(isTiebreakSet(6, 7)).toBe(true);
  });

  it("rejects any other score", () => {
    expect(isTiebreakSet(6, 4)).toBe(false);
    expect(isTiebreakSet(7, 5)).toBe(false);
    expect(isTiebreakSet(10, 7)).toBe(false);
  });
});

describe("isValidGameTiebreak", () => {
  it("accepts 7-x for x from 0 to 5", () => {
    for (let loser = 0; loser <= 5; loser++) {
      expect(isValidGameTiebreak(7, loser)).toBe(true);
    }
  });

  it("rejects 7-6 (must win by 2)", () => {
    expect(isValidGameTiebreak(7, 6)).toBe(false);
  });

  it("accepts deuce-style scores beyond 7, always won by exactly 2", () => {
    expect(isValidGameTiebreak(8, 6)).toBe(true);
    expect(isValidGameTiebreak(10, 8)).toBe(true);
  });

  it("rejects a win margin greater than 2 past 7", () => {
    expect(isValidGameTiebreak(8, 5)).toBe(false);
  });

  it("rejects a score below the 7-point threshold", () => {
    expect(isValidGameTiebreak(6, 4)).toBe(false);
  });
});

describe("isValidSetTiebreak", () => {
  it("accepts a breaker whose winner matches the set's winner", () => {
    expect(isValidSetTiebreak({ sideAGames: 7, sideBGames: 6 }, 7, 5)).toBe(true);
    expect(isValidSetTiebreak({ sideAGames: 6, sideBGames: 7 }, 5, 7)).toBe(true);
  });

  it("rejects a breaker whose winner doesn't match who won the set", () => {
    // Side A won the set 7-6, but the breaker score given says B won it.
    expect(isValidSetTiebreak({ sideAGames: 7, sideBGames: 6 }, 5, 7)).toBe(false);
  });

  it("rejects an illegal breaker score even if the winner matches", () => {
    expect(isValidSetTiebreak({ sideAGames: 7, sideBGames: 6 }, 7, 6)).toBe(false);
  });

  it("rejects a tied breaker score", () => {
    expect(isValidSetTiebreak({ sideAGames: 7, sideBGames: 6 }, 7, 7)).toBe(false);
  });
});
