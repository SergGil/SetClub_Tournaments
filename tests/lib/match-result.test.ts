import { describe, expect, it } from "vitest";

import {
  computeMatchPoints,
  determineMatchWinner,
  determineSetWinner,
  isTiebreakSet,
  isValidClassicSet,
  isValidGameTiebreak,
  isValidProSet,
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

describe("computeMatchPoints", () => {
  it("gives the winner a flat 2 points and the loser 0 for a single-set match", () => {
    expect(computeMatchPoints([{ sideAGames: 6, sideBGames: 4 }])).toEqual({ A: 2, B: 0 });
    expect(computeMatchPoints([{ sideAGames: 3, sideBGames: 6 }])).toEqual({ A: 0, B: 2 });
  });

  it("awards 1 point per set won in a multi-set match, even to the loser", () => {
    // A wins 2-1: A took two sets (2 points), B took one (1 point).
    const sets = [
      { sideAGames: 6, sideBGames: 4 },
      { sideAGames: 4, sideBGames: 6 },
      { sideAGames: 7, sideBGames: 5 },
    ];
    expect(computeMatchPoints(sets)).toEqual({ A: 2, B: 1 });
  });

  it("gives a straight-sets multi-set win all the points, none to the loser", () => {
    const sets = [
      { sideAGames: 6, sideBGames: 2 },
      { sideAGames: 6, sideBGames: 3 },
    ];
    expect(computeMatchPoints(sets)).toEqual({ A: 2, B: 0 });
  });

  it("skips a tied set instead of crediting either side", () => {
    const sets = [
      { sideAGames: 6, sideBGames: 6 },
      { sideAGames: 6, sideBGames: 2 },
      { sideAGames: 6, sideBGames: 3 },
    ];
    expect(computeMatchPoints(sets)).toEqual({ A: 2, B: 0 });
  });

  it("returns zero for both sides with no sets and no winnerSide fallback", () => {
    expect(computeMatchPoints([])).toEqual({ A: 0, B: 0 });
  });

  it("falls back to a flat 2 points for the winnerSide when there are no sets (walkover, or retired before any set finished)", () => {
    expect(computeMatchPoints([], "A")).toEqual({ A: 2, B: 0 });
    expect(computeMatchPoints([], "B")).toEqual({ A: 0, B: 2 });
  });

  it("ignores the winnerSide fallback once there's at least one set to score from, for a non-retired match", () => {
    // B actually won the only set, even though "A" is passed as a fallback -
    // the fallback must never override a real set result for a normal
    // (non-retired) match.
    expect(computeMatchPoints([{ sideAGames: 3, sideBGames: 6 }], "A")).toEqual({ A: 0, B: 2 });
  });

  it("always trusts winnerSide for a retired match, even with a set recorded that would otherwise say the opposite", () => {
    // The admin explicitly picked "A" as the winner (whoever didn't retire)
    // - a retired match's own recorded set doesn't have to form a complete,
    // legal result and must never override that explicit choice, unlike a
    // normal match where the fallback is ignored once a set exists.
    expect(computeMatchPoints([{ sideAGames: 3, sideBGames: 6 }], "A", true)).toEqual({ A: 2, B: 0 });
  });

  it("always trusts winnerSide for a retired match with a tied (e.g. 0-0) recorded set", () => {
    // A tied set has no set-winner at all (determineSetWinner returns null)
    // - without the retired flag this would give both sides 0 points
    // despite a real, recorded winner.
    expect(computeMatchPoints([{ sideAGames: 0, sideBGames: 0 }], "B", true)).toEqual({ A: 0, B: 2 });
  });

  it("still derives points from sets normally for a retired match with none recorded", () => {
    // No sets and retired: true behaves the same as the plain no-sets
    // fallback (retired is just an additional trigger for the same branch).
    expect(computeMatchPoints([], "A", true)).toEqual({ A: 2, B: 0 });
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

describe("isValidProSet", () => {
  it("accepts 8-0 through 8-6", () => {
    for (let loser = 0; loser <= 6; loser++) {
      expect(isValidProSet(8, loser)).toBe(true);
      expect(isValidProSet(loser, 8)).toBe(true);
    }
  });

  it("accepts 9-7", () => {
    expect(isValidProSet(9, 7)).toBe(true);
    expect(isValidProSet(7, 9)).toBe(true);
  });

  it("accepts 9-8 (a 7-point tiebreak at 8-8)", () => {
    expect(isValidProSet(9, 8)).toBe(true);
    expect(isValidProSet(8, 9)).toBe(true);
  });

  it("rejects 8-7 (should have continued to 9-7 or a tiebreak)", () => {
    expect(isValidProSet(8, 7)).toBe(false);
  });

  it("rejects a tied set", () => {
    expect(isValidProSet(8, 8)).toBe(false);
  });

  it("never overlaps with a valid classic (6-game) set score", () => {
    for (let a = 0; a <= 7; a++) {
      for (let b = 0; b <= 7; b++) {
        if (isValidClassicSet(a, b)) expect(isValidProSet(a, b)).toBe(false);
      }
    }
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

  it("allows a Pro Set (8-game) score regardless of whether super tiebreaks are allowed", () => {
    expect(isValidSetScore({ sideAGames: 8, sideBGames: 4 }, false)).toBe(true);
    expect(isValidSetScore({ sideAGames: 9, sideBGames: 8 }, true)).toBe(true);
  });
});

describe("isTiebreakSet", () => {
  it("recognizes 7-6 in either direction", () => {
    expect(isTiebreakSet(7, 6)).toBe(true);
    expect(isTiebreakSet(6, 7)).toBe(true);
  });

  it("recognizes 9-8 in either direction (a Pro Set decided by a breaker)", () => {
    expect(isTiebreakSet(9, 8)).toBe(true);
    expect(isTiebreakSet(8, 9)).toBe(true);
  });

  it("rejects any other score", () => {
    expect(isTiebreakSet(6, 4)).toBe(false);
    expect(isTiebreakSet(7, 5)).toBe(false);
    expect(isTiebreakSet(10, 7)).toBe(false);
    expect(isTiebreakSet(8, 6)).toBe(false);
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

  it("also works for a Pro Set decided by a breaker at 8-8 (recorded as 9-8)", () => {
    expect(isValidSetTiebreak({ sideAGames: 9, sideBGames: 8 }, 7, 5)).toBe(true);
    expect(isValidSetTiebreak({ sideAGames: 8, sideBGames: 9 }, 5, 7)).toBe(true);
    expect(isValidSetTiebreak({ sideAGames: 9, sideBGames: 8 }, 5, 7)).toBe(false);
  });
});
