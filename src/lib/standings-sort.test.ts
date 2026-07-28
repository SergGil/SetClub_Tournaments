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
    ...overrides,
  };
}

describe("sortRows", () => {
  it("ranks by wins first", () => {
    const rows = [row({ key: "a", label: "A", wins: 2 }), row({ key: "b", label: "B", wins: 3 })];
    expect(sortRows(rows, new Map()).map((r) => r.key)).toEqual(["b", "a"]);
  });

  it("breaks a wins tie using the head-to-head result between exactly two tied rows", () => {
    const rows = [
      row({ key: "dem", label: "Дем'янішин Тарас / Кулеш Ірина", gamesWon: 18, gamesLost: 21 }),
      row({ key: "mat", label: "Матушевський Олег / Баранова Олександра", gamesWon: 23, gamesLost: 22 }),
    ];
    // Матушевський beat Дем'янішин head-to-head, despite a worse game differential.
    const h2h: HeadToHead = new Map();
    recordHeadToHead(h2h, "mat", "dem");

    expect(sortRows(rows, h2h).map((r) => r.key)).toEqual(["mat", "dem"]);
  });

  it("falls back to game differential when the tied rows never played each other", () => {
    const rows = [
      row({ key: "a", label: "A", gamesWon: 18, gamesLost: 21 }),
      row({ key: "b", label: "B", gamesWon: 23, gamesLost: 22 }),
    ];
    expect(sortRows(rows, new Map()).map((r) => r.key)).toEqual(["b", "a"]);
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
