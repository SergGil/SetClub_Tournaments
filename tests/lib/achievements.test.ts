import { describe, expect, it } from "vitest";

import {
  IOGANOV_PLAYER_ID,
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
  return {
    round: null,
    scope: "tennis",
    matchType: "SINGLES",
    tournamentId: "t1",
    isGiantKillerWin: false,
    beatIoganov: false,
    enteredAt: overrides.playedAt,
    ...overrides,
  };
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
    expect(byId["finalist-tennis-singles"].earned).toBe(false);
    expect(byId["champion-tennis-singles"].earned).toBe(false);
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
    expect(byIdFinalist["finalist-tennis-singles"].earned).toBe(true);
    expect(byIdFinalist["champion-tennis-singles"].earned).toBe(false);

    const champion = buildPlayerAchievements([
      input({ id: "m1", result: "win", round: FINAL_ROUND, playedAt: day(1) }),
    ]);
    const byIdChampion = Object.fromEntries(champion.map((a) => [a.id, a]));
    expect(byIdChampion["finalist-tennis-singles"].earned).toBe(true);
    expect(byIdChampion["champion-tennis-singles"].earned).toBe(true);
    expect(byIdChampion["champion-tennis-singles"].earnedAt).toBe(day(1).toISOString());
  });

  it("keeps singles and doubles finals apart", () => {
    const byId = Object.fromEntries(
      buildPlayerAchievements([
        input({ id: "m1", result: "win", round: FINAL_ROUND, matchType: "DOUBLES", playedAt: day(1) }),
      ]).map((a) => [a.id, a]),
    );
    expect(byId["champion-tennis-doubles"].earned).toBe(true);
    expect(byId["champion-tennis-singles"].earned).toBe(false);
    expect(byId["finalist-tennis-singles"].earned).toBe(false);
  });

  it("keeps tennis, padel and women's tennis finals apart - a final counts for exactly one scope", () => {
    const earnedIds = (scope: "tennis" | "padel" | "womens-tennis" | "womens-padel") =>
      buildPlayerAchievements([input({ id: "m1", result: "win", round: FINAL_ROUND, scope, playedAt: day(1) })])
        .filter((a) => a.earned && (a.id.startsWith("finalist-") || a.id.startsWith("champion-")))
        .map((a) => a.id)
        .sort();

    expect(earnedIds("tennis")).toEqual(["champion-tennis-singles", "finalist-tennis-singles"]);
    expect(earnedIds("padel")).toEqual(["champion-padel-singles", "finalist-padel-singles"]);
    expect(earnedIds("womens-tennis")).toEqual(["champion-womens-tennis-singles", "finalist-womens-tennis-singles"]);
    expect(earnedIds("womens-padel")).toEqual(["champion-womens-padel-singles", "finalist-womens-padel-singles"]);
  });

  it("only counts finals - a non-final win earns no finalist/champion badge", () => {
    const achievements = buildPlayerAchievements([input({ id: "m1", result: "win", round: "1/2", playedAt: day(1) })]);
    expect(achievements.filter((a) => a.id.startsWith("finalist-") || a.id.startsWith("champion-")).every((a) => !a.earned)).toBe(true);
  });

  it("lists 16 finalist/champion badges (4 scopes x singles/doubles x finalist/champion), women's with feminine labels", () => {
    const achievements = buildPlayerAchievements([]);
    const placement = achievements.filter((a) => a.id.startsWith("finalist-") || a.id.startsWith("champion-"));
    expect(placement).toHaveLength(16);
    const byId = Object.fromEntries(achievements.map((a) => [a.id, a]));
    expect(byId["champion-womens-tennis-doubles"].label).toBe("Чемпіонка: жіночий теніс, парний");
    expect(byId["finalist-womens-padel-singles"].label).toBe("Фіналістка: жіночий падел, одиночний");
    expect(byId["finalist-womens-padel-singles"].description).toBe("Дійшла до фіналу одиночного жіночого падел-турніру");
    expect(byId["finalist-padel-singles"].label).toBe("Фіналіст: падел, одиночний");
    expect(byId["finalist-padel-singles"].description).toBe("Дійшов до фіналу одиночного падел-турніру");
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

  it("earns the Ioganov-killer badges separately for singles and doubles", () => {
    const singles = Object.fromEntries(
      buildPlayerAchievements([
        input({ id: "m1", result: "win", beatIoganov: true, matchType: "SINGLES", playedAt: day(1) }),
      ]).map((a) => [a.id, a]),
    );
    expect(singles["ioganov-killer-singles"].earned).toBe(true);
    expect(singles["ioganov-killer-singles"].earnedAt).toBe(day(1).toISOString());
    expect(singles["ioganov-killer-doubles"].earned).toBe(false);

    const doubles = Object.fromEntries(
      buildPlayerAchievements([
        input({ id: "m1", result: "win", beatIoganov: true, matchType: "DOUBLES", playedAt: day(1) }),
      ]).map((a) => [a.id, a]),
    );
    expect(doubles["ioganov-killer-doubles"].earned).toBe(true);
    expect(doubles["ioganov-killer-singles"].earned).toBe(false);
  });

  it("leaves the Ioganov-killer badges out entirely for Ioganov himself, keeping them for everyone else", () => {
    const forDenys = buildPlayerAchievements([], { playerId: IOGANOV_PLAYER_ID });
    expect(forDenys.some((a) => a.id.startsWith("ioganov-killer-"))).toBe(false);
    expect(forDenys.some((a) => a.id === "giant-killer")).toBe(true);

    const forSomeoneElse = buildPlayerAchievements([], { playerId: "p1" });
    expect(forSomeoneElse.filter((a) => a.id.startsWith("ioganov-killer-"))).toHaveLength(2);
    expect(buildPlayerAchievements([]).filter((a) => a.id.startsWith("ioganov-killer-"))).toHaveLength(2);
  });

  it("shows the women's (tennis and padel) badges only to women (FEMALE), not to men or players with no gender set", () => {
    const womens = (gender: "MALE" | "FEMALE" | null) =>
      buildPlayerAchievements([], { playerId: "p1", gender }).filter((a) => a.id.includes("womens-"));
    expect(womens("FEMALE")).toHaveLength(8);
    expect(womens("MALE")).toHaveLength(0);
    expect(womens(null)).toHaveLength(0);
    // gender omitted = pure-catalog call, nothing filtered.
    expect(buildPlayerAchievements([]).filter((a) => a.id.includes("womens-"))).toHaveLength(8);
    // The general tennis/padel placement badges are unaffected for men.
    const male = buildPlayerAchievements([], { playerId: "p1", gender: "MALE" });
    expect(male.some((a) => a.id === "champion-tennis-singles")).toBe(true);
    expect(male).toHaveLength(24 - 8);
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

const TENNIS = { sport: "tennis", womensOnly: false } as const;

function rawMatch(overrides: Partial<RawAchievementMatch> = {}): RawAchievementMatch {
  return {
    id: "m1",
    tournamentId: "t1",
    round: null,
    matchType: "SINGLES",
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
    expect(toAchievementMatchInput(rawMatch(), "p3", false, TENNIS)).toBeNull();
  });

  it("returns null for an undecided match", () => {
    expect(toAchievementMatchInput(rawMatch({ winnerSide: null }), "p1", false, TENNIS)).toBeNull();
  });

  it("returns null for the withdrawn side of a walkover", () => {
    // p2 is on side B, winnerSide is A (a walkover win for A) - p2 never played this match.
    expect(toAchievementMatchInput(rawMatch({ walkover: true }), "p2", false, TENNIS)).toBeNull();
  });

  it("counts a walkover win normally for the winning side", () => {
    const result = toAchievementMatchInput(rawMatch({ walkover: true }), "p1", false, TENNIS);
    expect(result?.result).toBe("win");
  });

  it("prefers scheduledDate, then completedAt, then createdAt for playedAt", () => {
    const scheduled = toAchievementMatchInput(
      rawMatch({ scheduledDate: day(5), completedAt: day(6), createdAt: day(7) }),
      "p1",
      false,
      TENNIS,
    );
    expect(scheduled?.playedAt).toEqual(day(5));

    const completedOnly = toAchievementMatchInput(
      rawMatch({ scheduledDate: null, completedAt: day(6), createdAt: day(7) }),
      "p1",
      false,
      TENNIS,
    );
    expect(completedOnly?.playedAt).toEqual(day(6));

    const createdOnly = toAchievementMatchInput(
      rawMatch({ scheduledDate: null, completedAt: null, createdAt: day(7) }),
      "p1",
      false,
      TENNIS,
    );
    expect(createdOnly?.playedAt).toEqual(day(7));
  });

  it("sets enteredAt from completedAt/createdAt regardless of scheduledDate, unlike playedAt", () => {
    const withScheduled = toAchievementMatchInput(
      rawMatch({ scheduledDate: day(5), completedAt: day(6), createdAt: day(7) }),
      "p1",
      false,
      TENNIS,
    );
    // playedAt prefers scheduledDate (day 5), but enteredAt never does - it
    // stays completedAt (day 6) so same-day ties still have a real tiebreak.
    expect(withScheduled?.playedAt).toEqual(day(5));
    expect(withScheduled?.enteredAt).toEqual(day(6));

    const noCompletedAt = toAchievementMatchInput(
      rawMatch({ scheduledDate: day(5), completedAt: null, createdAt: day(7) }),
      "p1",
      false,
      TENNIS,
    );
    expect(noCompletedAt?.enteredAt).toEqual(day(7));
  });

  it("derives scope from sport + womensOnly, and matchType from the raw row", () => {
    const raw = rawMatch({ matchType: "DOUBLES" });
    expect(toAchievementMatchInput(raw, "p1", false, TENNIS)).toMatchObject({ scope: "tennis", matchType: "DOUBLES" });
    expect(
      toAchievementMatchInput(raw, "p1", false, { sport: "tennis", womensOnly: true }),
    ).toMatchObject({ scope: "womens-tennis" });
    expect(toAchievementMatchInput(raw, "p1", false, { sport: "padel", womensOnly: true })).toMatchObject({
      scope: "womens-padel",
    });
    expect(toAchievementMatchInput(raw, "p1", false, { sport: "padel", womensOnly: false })).toMatchObject({
      scope: "padel",
    });
  });

  describe("beatIoganov", () => {
    const vsIoganov = (overrides: Partial<RawAchievementMatch> = {}) =>
      rawMatch({
        players: [
          { side: "A", playerId: "p1" },
          { side: "B", playerId: IOGANOV_PLAYER_ID },
        ],
        ...overrides,
      });

    it("is true for a win over Ioganov on the opposing side", () => {
      expect(toAchievementMatchInput(vsIoganov(), "p1", false, TENNIS)?.beatIoganov).toBe(true);
    });

    it("is false for a loss to him", () => {
      expect(toAchievementMatchInput(vsIoganov({ winnerSide: "B" }), "p1", false, TENNIS)?.beatIoganov).toBe(false);
    });

    it("is false when he's the player's own doubles partner, not an opponent", () => {
      const sameSide = rawMatch({
        matchType: "DOUBLES",
        players: [
          { side: "A", playerId: "p1" },
          { side: "A", playerId: IOGANOV_PLAYER_ID },
          { side: "B", playerId: "p2" },
          { side: "B", playerId: "p3" },
        ],
      });
      expect(toAchievementMatchInput(sameSide, "p1", false, TENNIS)?.beatIoganov).toBe(false);
    });

    it("is true for a doubles win with him on the opposing team", () => {
      const doubles = rawMatch({
        matchType: "DOUBLES",
        players: [
          { side: "A", playerId: "p1" },
          { side: "A", playerId: "p2" },
          { side: "B", playerId: IOGANOV_PLAYER_ID },
          { side: "B", playerId: "p3" },
        ],
      });
      expect(toAchievementMatchInput(doubles, "p1", false, TENNIS)?.beatIoganov).toBe(true);
    });

    it("is false for a walkover win (he withdrew, wasn't beaten)", () => {
      expect(toAchievementMatchInput(vsIoganov({ walkover: true }), "p1", false, TENNIS)?.beatIoganov).toBe(false);
    });
  });

  it("only flags isGiantKillerWin true when this player actually won", () => {
    const winner = toAchievementMatchInput(rawMatch(), "p1", true, TENNIS);
    expect(winner?.isGiantKillerWin).toBe(true);

    const loser = toAchievementMatchInput(rawMatch(), "p2", true, TENNIS);
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
      .map((m) => toAchievementMatchInput(m, "p1", false, TENNIS))
      .filter((m): m is NonNullable<typeof m> => m !== null);
    expect(inputs).toHaveLength(3);

    const byId = Object.fromEntries(buildPlayerAchievements(inputs).map((a) => [a.id, a]));
    expect(byId["streak-3"].earned).toBe(true);
  });
});
