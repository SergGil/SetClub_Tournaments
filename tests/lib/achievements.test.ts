import { describe, expect, it } from "vitest";

import {
  buildGiantKillerMatchIds,
  buildPlayerAchievements,
  RESIDENT_TOURNAMENTS_THRESHOLD,
  toAchievementMatchInput,
} from "@/lib/achievements";
import type { AchievementMatchInput, RawAchievementMatch } from "@/lib/achievements";
import { FINAL_ROUND } from "@/lib/playoff-rounds";

function input(overrides: Partial<AchievementMatchInput> & Pick<AchievementMatchInput, "id" | "result" | "playedAt">): AchievementMatchInput {
  // enteredAt defaults to playedAt unless a test explicitly cares about the
  // tiebreak (see the "breaks ties" tests below) - keeps every other test's
  // ordering exactly as playedAt alone would produce.
  return { round: null, tournamentId: "t1", isGiantKillerWin: false, enteredAt: overrides.playedAt, ...overrides };
}

function day(n: number): Date {
  return new Date(2026, 0, n);
}

describe("buildPlayerAchievements", () => {
  it("earns nothing for a player with no decided matches", () => {
    const achievements = buildPlayerAchievements([]);
    expect(achievements.every((a) => !a.earned)).toBe(true);
    expect(achievements.every((a) => a.earnedAt === undefined)).toBe(true);
  });

  it("earns debut and first win on a single win, nothing else", () => {
    const achievements = buildPlayerAchievements([input({ id: "m1", result: "win", playedAt: day(1) })]);
    const byId = Object.fromEntries(achievements.map((a) => [a.id, a]));
    expect(byId.debut.earned).toBe(true);
    expect(byId.debut.earnedAt).toBe(day(1).toISOString());
    expect(byId["first-win"].earned).toBe(true);
    expect(byId["streak-3"].earned).toBe(false);
    expect(byId.finalist.earned).toBe(false);
    expect(byId.champion.earned).toBe(false);
  });

  it("earns debut but not first-win on a single loss", () => {
    const achievements = buildPlayerAchievements([input({ id: "m1", result: "loss", playedAt: day(1) })]);
    const byId = Object.fromEntries(achievements.map((a) => [a.id, a]));
    expect(byId.debut.earned).toBe(true);
    expect(byId["first-win"].earned).toBe(false);
  });

  it("earns streak-3 (not streak-5) after exactly 3 wins in a row, dated to the 3rd win", () => {
    const matches = [
      input({ id: "m1", result: "win", playedAt: day(1) }),
      input({ id: "m2", result: "win", playedAt: day(2) }),
      input({ id: "m3", result: "win", playedAt: day(3) }),
    ];
    const byId = Object.fromEntries(buildPlayerAchievements(matches).map((a) => [a.id, a]));
    expect(byId["streak-3"].earned).toBe(true);
    expect(byId["streak-3"].earnedAt).toBe(day(3).toISOString());
    expect(byId["streak-5"].earned).toBe(false);
  });

  it("earns streak-5 dated to the 5th win, independently of streak-3's own date", () => {
    const matches = Array.from({ length: 5 }, (_, i) =>
      input({ id: `m${i + 1}`, result: "win", playedAt: day(i + 1) }),
    );
    const byId = Object.fromEntries(buildPlayerAchievements(matches).map((a) => [a.id, a]));
    expect(byId["streak-3"].earnedAt).toBe(day(3).toISOString());
    expect(byId["streak-5"].earnedAt).toBe(day(5).toISOString());
  });

  it("a loss resets the running streak but keeps an already-earned streak badge earned", () => {
    const matches = [
      input({ id: "m1", result: "win", playedAt: day(1) }),
      input({ id: "m2", result: "win", playedAt: day(2) }),
      input({ id: "m3", result: "win", playedAt: day(3) }),
      input({ id: "m4", result: "loss", playedAt: day(4) }),
    ];
    const byId = Object.fromEntries(buildPlayerAchievements(matches).map((a) => [a.id, a]));
    expect(byId["streak-3"].earned).toBe(true);
    expect(byId["streak-3"].earnedAt).toBe(day(3).toISOString());
  });

  it("does not count wins interrupted by a loss toward the streak threshold", () => {
    const matches = [
      input({ id: "m1", result: "win", playedAt: day(1) }),
      input({ id: "m2", result: "win", playedAt: day(2) }),
      input({ id: "m3", result: "loss", playedAt: day(3) }),
      input({ id: "m4", result: "win", playedAt: day(4) }),
    ];
    const byId = Object.fromEntries(buildPlayerAchievements(matches).map((a) => [a.id, a]));
    expect(byId["streak-3"].earned).toBe(false);
  });

  it("breaks ties on the same playedAt using enteredAt, not the raw input array order", () => {
    const sameDay = day(1);
    // Fed in "win, win, loss" order, but actually entered (enteredAt)
    // loss, win, win - only 2 in a row, never 3.
    const matches = [
      input({ id: "win-a", result: "win", playedAt: sameDay, enteredAt: new Date(2026, 0, 1, 10) }),
      input({ id: "win-b", result: "win", playedAt: sameDay, enteredAt: new Date(2026, 0, 1, 11) }),
      input({ id: "loss-a", result: "loss", playedAt: sameDay, enteredAt: new Date(2026, 0, 1, 9) }),
    ];
    const byId = Object.fromEntries(buildPlayerAchievements(matches).map((a) => [a.id, a]));
    expect(byId["streak-3"].earned).toBe(false);
  });

  it("credits a same-day streak when enteredAt confirms 3 wins actually landed in a row", () => {
    const sameDay = day(1);
    const matches = [
      input({ id: "loss-a", result: "loss", playedAt: sameDay, enteredAt: new Date(2026, 0, 1, 9) }),
      input({ id: "win-a", result: "win", playedAt: sameDay, enteredAt: new Date(2026, 0, 1, 10) }),
      input({ id: "win-b", result: "win", playedAt: sameDay, enteredAt: new Date(2026, 0, 1, 11) }),
      input({ id: "win-c", result: "win", playedAt: sameDay, enteredAt: new Date(2026, 0, 1, 12) }),
    ];
    const byId = Object.fromEntries(buildPlayerAchievements(matches).map((a) => [a.id, a]));
    expect(byId["streak-3"].earned).toBe(true);
  });

  it("earns finalist on a lost final, and champion only on a won final", () => {
    const finalist = buildPlayerAchievements([
      input({ id: "m1", result: "loss", round: FINAL_ROUND, playedAt: day(1) }),
    ]);
    const byIdFinalist = Object.fromEntries(finalist.map((a) => [a.id, a]));
    expect(byIdFinalist.finalist.earned).toBe(true);
    expect(byIdFinalist.champion.earned).toBe(false);

    const champion = buildPlayerAchievements([
      input({ id: "m1", result: "win", round: FINAL_ROUND, playedAt: day(1) }),
    ]);
    const byIdChampion = Object.fromEntries(champion.map((a) => [a.id, a]));
    expect(byIdChampion.finalist.earned).toBe(true);
    expect(byIdChampion.champion.earned).toBe(true);
  });

  it("earns resident only once the tournament count reaches the threshold, dated to that tournament", () => {
    const belowThreshold = Array.from({ length: RESIDENT_TOURNAMENTS_THRESHOLD - 1 }, (_, i) =>
      input({ id: `m${i}`, result: "loss", tournamentId: `t${i}`, playedAt: day(1) }),
    );
    expect(
      Object.fromEntries(buildPlayerAchievements(belowThreshold).map((a) => [a.id, a])).resident.earned,
    ).toBe(false);

    const atThreshold = Array.from({ length: RESIDENT_TOURNAMENTS_THRESHOLD }, (_, i) =>
      input({ id: `m${i}`, result: "loss", tournamentId: `t${i}`, playedAt: day(i + 1) }),
    );
    const byId = Object.fromEntries(buildPlayerAchievements(atThreshold).map((a) => [a.id, a]));
    expect(byId.resident.earned).toBe(true);
    expect(byId.resident.earnedAt).toBe(day(RESIDENT_TOURNAMENTS_THRESHOLD).toISOString());
  });

  it("earns giant-killer only for a win flagged as a qualifying upset", () => {
    const notFlagged = buildPlayerAchievements([
      input({ id: "m1", result: "win", playedAt: day(1), isGiantKillerWin: false }),
    ]);
    expect(
      Object.fromEntries(notFlagged.map((a) => [a.id, a]))["giant-killer"].earned,
    ).toBe(false);

    const flagged = buildPlayerAchievements([
      input({ id: "m1", result: "win", playedAt: day(1), isGiantKillerWin: true }),
    ]);
    const byId = Object.fromEntries(flagged.map((a) => [a.id, a]));
    expect(byId["giant-killer"].earned).toBe(true);
    expect(byId["giant-killer"].earnedAt).toBe(day(1).toISOString());
  });

  it("is insensitive to input array order (always sorts by playedAt first)", () => {
    const matches = [
      input({ id: "m3", result: "win", playedAt: day(3) }),
      input({ id: "m1", result: "win", playedAt: day(1) }),
      input({ id: "m2", result: "win", playedAt: day(2) }),
    ];
    const byId = Object.fromEntries(buildPlayerAchievements(matches).map((a) => [a.id, a]));
    expect(byId["streak-3"].earnedAt).toBe(day(3).toISOString());
  });
});

describe("buildGiantKillerMatchIds", () => {
  it("includes a match only when the win probability clears the bar, ignoring other players' index entries", () => {
    const ids = buildGiantKillerMatchIds("p1", [
      {
        p1: [
          { matchId: "m1", winnerIds: ["p1"], winnerPreWinProb: 0.15 },
          { matchId: "m3", winnerIds: ["p1"], winnerPreWinProb: 0.5 }, // not an upset
        ],
        // p2's own bucket - getUpsetWinsByPlayer would never put this under p1.
        p2: [{ matchId: "m2", winnerIds: ["p2"], winnerPreWinProb: 0.1 }],
      },
    ]);
    expect(ids).toEqual(new Set(["m1"]));
  });

  it("returns an empty set when the player has no entry in the index at all", () => {
    expect(buildGiantKillerMatchIds("p1", [{}])).toEqual(new Set());
  });

  it("merges upsets across multiple format/type indexes (e.g. tennis + padel singles/doubles)", () => {
    const ids = buildGiantKillerMatchIds("p1", [
      { p1: [{ matchId: "tennis-singles-1", winnerIds: ["p1"], winnerPreWinProb: 0.1 }] },
      { p1: [{ matchId: "padel-doubles-1", winnerIds: ["p1", "p9"], winnerPreWinProb: 0.05 }] },
    ]);
    expect(ids).toEqual(new Set(["tennis-singles-1", "padel-doubles-1"]));
  });
});

function rawMatch(overrides: Partial<RawAchievementMatch> = {}): RawAchievementMatch {
  return {
    id: "m1",
    tournamentId: "t1",
    round: null,
    winnerSide: "A",
    walkover: false,
    scheduledDate: null,
    completedAt: null,
    createdAt: day(1),
    players: [
      { side: "A", playerId: "p1" },
      { side: "B", playerId: "p2" },
    ],
    ...overrides,
  };
}

describe("toAchievementMatchInput", () => {
  it("returns null when the player isn't part of the match", () => {
    expect(toAchievementMatchInput(rawMatch(), "p3", false)).toBeNull();
  });

  it("returns null for an undecided match", () => {
    expect(toAchievementMatchInput(rawMatch({ winnerSide: null }), "p1", false)).toBeNull();
  });

  it("returns null for the withdrawn side of a walkover", () => {
    // p2 is on side B, winnerSide is A (a walkover win for A) - p2 never played this match.
    expect(toAchievementMatchInput(rawMatch({ walkover: true }), "p2", false)).toBeNull();
  });

  it("counts a walkover win normally for the winning side", () => {
    const result = toAchievementMatchInput(rawMatch({ walkover: true }), "p1", false);
    expect(result?.result).toBe("win");
  });

  it("prefers scheduledDate, then completedAt, then createdAt for playedAt", () => {
    const scheduled = toAchievementMatchInput(
      rawMatch({ scheduledDate: day(5), completedAt: day(6), createdAt: day(7) }),
      "p1",
      false,
    );
    expect(scheduled?.playedAt).toEqual(day(5));

    const completedOnly = toAchievementMatchInput(
      rawMatch({ scheduledDate: null, completedAt: day(6), createdAt: day(7) }),
      "p1",
      false,
    );
    expect(completedOnly?.playedAt).toEqual(day(6));

    const createdOnly = toAchievementMatchInput(
      rawMatch({ scheduledDate: null, completedAt: null, createdAt: day(7) }),
      "p1",
      false,
    );
    expect(createdOnly?.playedAt).toEqual(day(7));
  });

  it("sets enteredAt from completedAt/createdAt regardless of scheduledDate, unlike playedAt", () => {
    const withScheduled = toAchievementMatchInput(
      rawMatch({ scheduledDate: day(5), completedAt: day(6), createdAt: day(7) }),
      "p1",
      false,
    );
    // playedAt prefers scheduledDate (day 5), but enteredAt never does - it
    // stays completedAt (day 6) so same-day ties still have a real tiebreak.
    expect(withScheduled?.playedAt).toEqual(day(5));
    expect(withScheduled?.enteredAt).toEqual(day(6));

    const noCompletedAt = toAchievementMatchInput(
      rawMatch({ scheduledDate: day(5), completedAt: null, createdAt: day(7) }),
      "p1",
      false,
    );
    expect(noCompletedAt?.enteredAt).toEqual(day(7));
  });

  it("only flags isGiantKillerWin true when this player actually won", () => {
    const winner = toAchievementMatchInput(rawMatch(), "p1", true);
    expect(winner?.isGiantKillerWin).toBe(true);

    const loser = toAchievementMatchInput(rawMatch(), "p2", true);
    expect(loser?.isGiantKillerWin).toBe(false);
  });
});

describe("combining tennis and padel matches (the headline feature)", () => {
  it("continues a win streak across sports, exactly as players/[id]/page.tsx and the achievements API route merge them ([...matches, ...padelMatches])", () => {
    // toAchievementMatchInput is deliberately format-agnostic (see its own
    // doc comment) - a "tennis" Match row and a "padel" PadelMatch row both
    // satisfy RawAchievementMatch, id namespaces don't collide (separate
    // Prisma cuid() sequences), and there's nothing sport-specific for it to
    // key on. This test proves the real call site's concatenation, not just
    // the two pure functions in isolation.
    const tennisWin1 = rawMatch({ id: "tennis-1", createdAt: day(1) });
    const tennisWin2 = rawMatch({ id: "tennis-2", createdAt: day(2) });
    const padelWin = rawMatch({ id: "padel-1", tournamentId: "padel-t1", createdAt: day(3) });

    const inputs = [tennisWin1, tennisWin2, padelWin]
      .map((m) => toAchievementMatchInput(m, "p1", false))
      .filter((m): m is NonNullable<typeof m> => m !== null);
    expect(inputs).toHaveLength(3);

    const byId = Object.fromEntries(buildPlayerAchievements(inputs).map((a) => [a.id, a]));
    expect(byId["streak-3"].earned).toBe(true);
  });
});
