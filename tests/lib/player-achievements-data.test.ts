import { beforeEach, describe, expect, it, vi } from "vitest";

const { tennisUpsets, padelUpsets, tennisTitles, padelTitles } = vi.hoisted(() => ({
  tennisUpsets: vi.fn(),
  padelUpsets: vi.fn(),
  tennisTitles: vi.fn(),
  padelTitles: vi.fn(),
}));
vi.mock("@/lib/rating/ratings-data", () => ({ getUpsetWinsByPlayer: tennisUpsets }));
vi.mock("@/lib/rating/padel-ratings-data", () => ({ getPadelUpsetWinsByPlayer: padelUpsets }));
vi.mock("@/lib/tournament-titles", () => ({
  getRoundRobinTitles: tennisTitles,
  getPadelRoundRobinTitles: padelTitles,
}));

import type { RawAchievementMatch } from "@/lib/achievements";
import { loadPlayerAchievements } from "@/lib/player-achievements-data";

function match(overrides: Partial<RawAchievementMatch> & { id: string }): RawAchievementMatch {
  return {
    tournamentId: "t1",
    round: null,
    matchType: "SINGLES",
    winnerSide: "A",
    walkover: false,
    scheduledDate: null,
    completedAt: new Date(2026, 0, 5),
    createdAt: new Date(2026, 0, 5),
    players: [
      { side: "A", playerId: "p1" },
      { side: "B", playerId: "p2" },
    ],
    ...overrides,
  };
}

const base = { playerId: "p1", gender: null, matches: [match({ id: "m1" })], womensOnlyTournamentIds: new Set<string>() };

beforeEach(() => {
  vi.clearAllMocks();
  tennisUpsets.mockResolvedValue({});
  padelUpsets.mockResolvedValue({});
  tennisTitles.mockResolvedValue([]);
  padelTitles.mockResolvedValue([]);
});

describe("loadPlayerAchievements", () => {
  it("asks only the general pool (singles + doubles) when the player has no women's-tournament match", async () => {
    await loadPlayerAchievements({ ...base, sport: "tennis" });
    expect(tennisUpsets.mock.calls).toEqual([
      ["SINGLES", "general"],
      ["DOUBLES", "general"],
    ]);
    expect(padelUpsets).not.toHaveBeenCalled();
  });

  it("also asks the women's pool when the player played a women-only tournament", async () => {
    await loadPlayerAchievements({
      ...base,
      sport: "tennis",
      gender: "FEMALE",
      womensOnlyTournamentIds: new Set(["t1"]),
    });
    expect(tennisUpsets.mock.calls).toEqual([
      ["SINGLES", "general"],
      ["DOUBLES", "general"],
      ["SINGLES", "women"],
      ["DOUBLES", "women"],
    ]);
  });

  it("uses the padel upset and title lookups (and never the tennis ones) for the padel sport", async () => {
    await loadPlayerAchievements({ ...base, sport: "padel" });
    expect(padelUpsets).toHaveBeenCalledTimes(2);
    expect(tennisUpsets).not.toHaveBeenCalled();
    expect(padelTitles).toHaveBeenCalledTimes(1);
    expect(tennisTitles).not.toHaveBeenCalled();
  });

  it("asks the tennis title index once for the tennis sport", async () => {
    await loadPlayerAchievements({ ...base, sport: "tennis" });
    expect(tennisTitles).toHaveBeenCalledTimes(1);
    expect(padelTitles).not.toHaveBeenCalled();
  });

  it("earns champion + finalist from a round-robin title naming the player, in the tournament's own scope, ignoring other players' titles", async () => {
    const decidedAt = new Date(2026, 10, 8).getTime();
    tennisTitles.mockResolvedValue([
      // A women's-only doubles round robin p1 won with p9.
      { tournamentId: "rr-women", matchType: "DOUBLES", winnerIds: ["p9", "p1"], decidedAt },
      // Someone else's singles title - not p1's.
      { tournamentId: "rr-other", matchType: "SINGLES", winnerIds: ["p2"], decidedAt },
    ]);
    const achievements = await loadPlayerAchievements({
      ...base,
      sport: "tennis",
      gender: "FEMALE",
      womensOnlyTournamentIds: new Set(["rr-women"]),
    });
    const byId = Object.fromEntries(achievements.map((a) => [a.id, a]));
    expect(byId["champion-womens-tennis-doubles"].earned).toBe(true);
    expect(byId["champion-womens-tennis-doubles"].earnedAt).toBe(new Date(decidedAt).toISOString());
    expect(byId["finalist-womens-tennis-doubles"].earned).toBe(true);
    // Scope is the tournament's, not "tennis" in general.
    expect(byId["champion-tennis-doubles"].earned).toBe(false);
    // p2's title never reaches p1.
    expect(byId["champion-tennis-singles"].earned).toBe(false);
    expect(byId["champion-womens-tennis-singles"].earned).toBe(false);
  });

  it("returns the badge catalog for the sport, with debut + first win earned from a single win", async () => {
    const achievements = await loadPlayerAchievements({ ...base, sport: "tennis" });
    const byId = Object.fromEntries(achievements.map((a) => [a.id, a]));
    expect(byId.debut.earned).toBe(true);
    expect(byId["first-win"].earned).toBe(true);
    expect(byId["streak-3"].earned).toBe(false);
  });

  it("earns the giant-killer badge when an upset index lists a low-probability win for the player", async () => {
    tennisUpsets.mockResolvedValue({ p1: [{ matchId: "m1", winnerPreWinProb: 0.1 }] });
    const achievements = await loadPlayerAchievements({ ...base, sport: "tennis" });
    expect(achievements.find((a) => a.id === "giant-killer")?.earned).toBe(true);
  });

  it("ignores an upset that wasn't improbable enough", async () => {
    tennisUpsets.mockResolvedValue({ p1: [{ matchId: "m1", winnerPreWinProb: 0.45 }] });
    const achievements = await loadPlayerAchievements({ ...base, sport: "tennis" });
    expect(achievements.find((a) => a.id === "giant-killer")?.earned).toBe(false);
  });

  it("copes with no matches at all", async () => {
    const achievements = await loadPlayerAchievements({ ...base, matches: [], sport: "padel" });
    expect(achievements.every((a) => !a.earned)).toBe(true);
  });
});
