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
});
