import { describe, expect, it } from "vitest";

import type { HeadToHead, StandingsRow } from "@/lib/standings-sort";
import { recordHeadToHead, sortRows } from "@/lib/standings-sort";

function row(overrides: Partial<StandingsRow> & { key: string; label: string }): StandingsRow {
  return {
    matchesPlayed: 4,
    wins: 2,
    losses: 2,
    winPct: 50,
    gamesWon: 0,
    gamesLost: 0,
    points: 4,
    ...overrides,
  };
}

describe("sortRows", () => {
  it("ranks by wins first", () => {
    const rows = [row({ key: "a", label: "A", wins: 2 }), row({ key: "b", label: "B", wins: 3 })];
    expect(sortRows(rows, new Map()).map((r) => r.key)).toEqual(["b", "a"]);
  });

  it("breaks a wins tie using head-to-head only once game diff and games won are both tied", () => {
    const rows = [
      row({ key: "dem", label: "Дем'янішин Тарас / Кулеш Ірина", gamesWon: 11, gamesLost: 11 }),
      row({ key: "mat", label: "Матушевський Олег / Баранова Олександра", gamesWon: 11, gamesLost: 11 }),
    ];
    // Same diff (0) and same games won (11) - only head-to-head can separate them.
    const h2h: HeadToHead = new Map();
    recordHeadToHead(h2h, "mat", "dem");

    expect(sortRows(rows, h2h).map((r) => r.key)).toEqual(["mat", "dem"]);
  });

  it("prefers a real game-differential edge over a head-to-head result", () => {
    const rows = [
      // "dem" lost the head-to-head, but has a clearly better differential -
      // the numeric criteria are checked first, so h2h never even applies here.
      row({ key: "dem", label: "Дем'янішин Тарас / Кулеш Ірина", gamesWon: 23, gamesLost: 22 }),
      row({ key: "mat", label: "Матушевський Олег / Баранова Олександра", gamesWon: 18, gamesLost: 21 }),
    ];
    const h2h: HeadToHead = new Map();
    recordHeadToHead(h2h, "mat", "dem");

    expect(sortRows(rows, h2h).map((r) => r.key)).toEqual(["dem", "mat"]);
  });

  it("falls back to game differential when the tied rows never played each other", () => {
    const rows = [
      row({ key: "a", label: "A", gamesWon: 18, gamesLost: 21 }),
      row({ key: "b", label: "B", gamesWon: 23, gamesLost: 22 }),
    ];
    expect(sortRows(rows, new Map()).map((r) => r.key)).toEqual(["b", "a"]);
  });

  it("breaks an equal game-differential tie using total games won", () => {
    // Both 0-diff (10:10 and 11:11), but "b" won more games overall.
    const rows = [
      row({ key: "a", label: "A", gamesWon: 10, gamesLost: 10 }),
      row({ key: "b", label: "B", gamesWon: 11, gamesLost: 11 }),
    ];
    expect(sortRows(rows, new Map()).map((r) => r.key)).toEqual(["b", "a"]);
  });

  it("in a 3-way tie, ranks a lower-games-won row last even with no head-to-head to consult", () => {
    // Mirrors a real "Група за 4-6 місце": all three tied on wins/win% and on
    // a 0 game differential, but two pairs won 11 games each (tied further,
    // so their own head-to-head decides) while the third only won 10.
    const rows = [
      row({ key: "dem", label: "Дем'янішин Тарас / Теребіж Віктор", gamesWon: 10, gamesLost: 10 }),
      row({ key: "mat", label: "Матушевський Олег / Матушевська Олена", gamesWon: 11, gamesLost: 11 }),
      row({ key: "chaura", label: "Чаура Ліна / Очеретенко Олександр", gamesWon: 11, gamesLost: 11 }),
    ];
    const h2h: HeadToHead = new Map();
    recordHeadToHead(h2h, "mat", "chaura");

    expect(sortRows(rows, h2h).map((r) => r.key)).toEqual(["mat", "chaura", "dem"]);
  });

  it("falls back to game differential for a 3-way circular head-to-head tie", () => {
    // A beat B, B beat C, C beat A - head-to-head alone can't resolve this.
    const rows = [
      row({ key: "a", label: "A", gamesWon: 10, gamesLost: 10 }),
      row({ key: "b", label: "B", gamesWon: 5, gamesLost: 10 }),
      row({ key: "c", label: "C", gamesWon: 15, gamesLost: 10 }),
    ];
    const h2h: HeadToHead = new Map();
    recordHeadToHead(h2h, "a", "b");
    recordHeadToHead(h2h, "b", "c");
    recordHeadToHead(h2h, "c", "a");

    expect(sortRows(rows, h2h).map((r) => r.key)).toEqual(["c", "a", "b"]);
  });

  it("ranks by exact win ratio, not the rounded winPct, when match counts differ", () => {
    // 2/15 = 13.3% and 2/16 = 12.5% both round to 13%, so comparing the
    // rounded winPct alone would wrongly treat these as tied and fall
    // through to game differential (which favors "b" here) instead of "a"'s
    // genuinely higher win rate.
    const rows = [
      row({ key: "a", label: "A", wins: 2, matchesPlayed: 15, winPct: 13, gamesWon: 0, gamesLost: 0 }),
      row({ key: "b", label: "B", wins: 2, matchesPlayed: 16, winPct: 13, gamesWon: 10, gamesLost: 0 }),
    ];
    expect(sortRows(rows, new Map()).map((r) => r.key)).toEqual(["a", "b"]);
  });

  it("falls back to name when everything else ties", () => {
    const rows = [row({ key: "b", label: "Б" }), row({ key: "a", label: "А" })];
    expect(sortRows(rows, new Map()).map((r) => r.key)).toEqual(["a", "b"]);
  });
});

describe("recordHeadToHead", () => {
  it("records a symmetric win/loss pair", () => {
    const h2h: HeadToHead = new Map();
    recordHeadToHead(h2h, "winner", "loser");
    expect(h2h.get("winner")?.get("loser")).toEqual({ wins: 1, losses: 0 });
    expect(h2h.get("loser")?.get("winner")).toEqual({ wins: 0, losses: 1 });
  });

  it("accumulates repeated results between the same pair", () => {
    const h2h: HeadToHead = new Map();
    recordHeadToHead(h2h, "a", "b");
    recordHeadToHead(h2h, "b", "a");
    recordHeadToHead(h2h, "a", "b");
    expect(h2h.get("a")?.get("b")).toEqual({ wins: 2, losses: 1 });
  });
});
