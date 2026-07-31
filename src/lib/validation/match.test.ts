import { describe, expect, it } from "vitest";

import { matchFormSchema, scoreFormSchema } from "@/lib/validation/match";

describe("matchFormSchema", () => {
  const base = {
    tournamentId: "t1",
    round: "",
    scheduledDate: "",
  };

  it("accepts a valid singles match", () => {
    const result = matchFormSchema.safeParse({
      ...base,
      matchType: "SINGLES",
      sideAPlayerIds: ["p1"],
      sideBPlayerIds: ["p2"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.round).toBeNull();
      expect(result.data.scheduledDate).toBeNull();
    }
  });

  it("accepts a valid doubles match", () => {
    const result = matchFormSchema.safeParse({
      ...base,
      matchType: "DOUBLES",
      sideAPlayerIds: ["p1", "p2"],
      sideBPlayerIds: ["p3", "p4"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a singles match with two players on a side", () => {
    const result = matchFormSchema.safeParse({
      ...base,
      matchType: "SINGLES",
      sideAPlayerIds: ["p1", "p2"],
      sideBPlayerIds: ["p3"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a doubles match with only one player on a side", () => {
    const result = matchFormSchema.safeParse({
      ...base,
      matchType: "DOUBLES",
      sideAPlayerIds: ["p1"],
      sideBPlayerIds: ["p2", "p3"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched player counts between sides", () => {
    const result = matchFormSchema.safeParse({
      ...base,
      matchType: "DOUBLES",
      sideAPlayerIds: ["p1", "p2"],
      sideBPlayerIds: ["p3"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a player appearing on both sides", () => {
    const result = matchFormSchema.safeParse({
      ...base,
      matchType: "SINGLES",
      sideAPlayerIds: ["p1"],
      sideBPlayerIds: ["p1"],
    });
    expect(result.success).toBe(false);
  });

  it("keeps a provided round and scheduled date", () => {
    const result = matchFormSchema.safeParse({
      ...base,
      round: "Фінал",
      scheduledDate: "2026-05-01",
      matchType: "SINGLES",
      sideAPlayerIds: ["p1"],
      sideBPlayerIds: ["p2"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.round).toBe("Фінал");
      expect(result.data.scheduledDate).toBe("2026-05-01");
    }
  });
});

describe("scoreFormSchema", () => {
  it("accepts a valid set of scores", () => {
    const result = scoreFormSchema.safeParse({
      matchId: "m1",
      sets: [
        { sideAGames: 6, sideBGames: 4 },
        { sideAGames: 3, sideBGames: 6 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty sets array", () => {
    expect(scoreFormSchema.safeParse({ matchId: "m1", sets: [] }).success).toBe(true);
  });

  it("rejects negative game counts", () => {
    const result = scoreFormSchema.safeParse({
      matchId: "m1",
      sets: [{ sideAGames: -1, sideBGames: 4 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than five sets", () => {
    const sets = Array.from({ length: 6 }, () => ({ sideAGames: 6, sideBGames: 0 }));
    expect(scoreFormSchema.safeParse({ matchId: "m1", sets }).success).toBe(false);
  });

  it("rejects an impossible set score like 8-8", () => {
    const result = scoreFormSchema.safeParse({
      matchId: "m1",
      sets: [{ sideAGames: 8, sideBGames: 8 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a 1st/2nd set that looks like a super tiebreak", () => {
    const result = scoreFormSchema.safeParse({
      matchId: "m1",
      sets: [{ sideAGames: 10, sideBGames: 7 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a super tiebreak as the 3rd (decisive) set", () => {
    const result = scoreFormSchema.safeParse({
      matchId: "m1",
      sets: [
        { sideAGames: 6, sideBGames: 4 },
        { sideAGames: 4, sideBGames: 6 },
        { sideAGames: 10, sideBGames: 7 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("still rejects a genuinely invalid 3rd set", () => {
    const result = scoreFormSchema.safeParse({
      matchId: "m1",
      sets: [
        { sideAGames: 6, sideBGames: 4 },
        { sideAGames: 4, sideBGames: 6 },
        { sideAGames: 9, sideBGames: 9 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a tiebreak loser score on a 7-6 set", () => {
    const result = scoreFormSchema.safeParse({
      matchId: "m1",
      sets: [{ sideAGames: 7, sideBGames: 6, tiebreakLoserPoints: 5 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a tiebreak loser score on a set that isn't 7-6", () => {
    const result = scoreFormSchema.safeParse({
      matchId: "m1",
      sets: [{ sideAGames: 6, sideBGames: 4, tiebreakLoserPoints: 5 }],
    });
    expect(result.success).toBe(false);
  });

  it("bypasses set-legality checks entirely when retired is true", () => {
    const result = scoreFormSchema.safeParse({
      matchId: "m1",
      retired: true,
      retiredWinnerSide: "A",
      sets: [
        { sideAGames: 6, sideBGames: 4 },
        { sideAGames: 4, sideBGames: 2 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("requires an explicit winner when retired is true", () => {
    const result = scoreFormSchema.safeParse({
      matchId: "m1",
      retired: true,
      sets: [{ sideAGames: 4, sideBGames: 2 }],
    });
    expect(result.success).toBe(false);
  });

  it("ignores a stale retiredWinnerSide when retired is false", () => {
    const result = scoreFormSchema.safeParse({
      matchId: "m1",
      retired: false,
      retiredWinnerSide: "A",
      sets: [{ sideAGames: 6, sideBGames: 4 }],
    });
    expect(result.success).toBe(true);
  });

  it("defaults retired to false when omitted", () => {
    const result = scoreFormSchema.safeParse({
      matchId: "m1",
      sets: [{ sideAGames: 4, sideBGames: 2 }],
    });
    expect(result.success).toBe(false);
  });
});
