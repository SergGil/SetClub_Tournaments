import { describe, expect, it } from "vitest";

import { buildHeadToHeadMatrix, headToHeadCell } from "@/lib/head-to-head";
import type { HeadToHeadMatchRow } from "@/lib/stats";

describe("buildHeadToHeadMatrix", () => {
  it("returns an empty matrix for no matches", () => {
    const matrix = buildHeadToHeadMatrix([], ["p1", "p2"]);
    expect(headToHeadCell(matrix, "p1", "p2")).toBeUndefined();
  });

  it("records a singles win on both sides of the matchup", () => {
    const rows: HeadToHeadMatchRow[] = [
      { winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }] },
    ];
    const matrix = buildHeadToHeadMatrix(rows, ["p1", "p2"]);
    expect(headToHeadCell(matrix, "p1", "p2")).toEqual({ wins: 1, losses: 0 });
    expect(headToHeadCell(matrix, "p2", "p1")).toEqual({ wins: 0, losses: 1 });
  });

  it("accumulates multiple matches between the same pair", () => {
    const rows: HeadToHeadMatchRow[] = [
      { winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }] },
      { winnerSide: "B", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }] },
    ];
    const matrix = buildHeadToHeadMatrix(rows, ["p1", "p2"]);
    expect(headToHeadCell(matrix, "p1", "p2")).toEqual({ wins: 1, losses: 1 });
    expect(headToHeadCell(matrix, "p2", "p1")).toEqual({ wins: 1, losses: 1 });
  });

  it("credits every winner against every loser individually in doubles", () => {
    const rows: HeadToHeadMatchRow[] = [
      {
        winnerSide: "A",
        players: [
          { side: "A", playerId: "p1" },
          { side: "A", playerId: "p2" },
          { side: "B", playerId: "p3" },
          { side: "B", playerId: "p4" },
        ],
      },
    ];
    const matrix = buildHeadToHeadMatrix(rows, ["p1", "p2", "p3", "p4"]);
    expect(headToHeadCell(matrix, "p1", "p3")).toEqual({ wins: 1, losses: 0 });
    expect(headToHeadCell(matrix, "p1", "p4")).toEqual({ wins: 1, losses: 0 });
    expect(headToHeadCell(matrix, "p2", "p3")).toEqual({ wins: 1, losses: 0 });
    expect(headToHeadCell(matrix, "p2", "p4")).toEqual({ wins: 1, losses: 0 });
  });

  it("does not record teammates against each other", () => {
    const rows: HeadToHeadMatchRow[] = [
      {
        winnerSide: "A",
        players: [
          { side: "A", playerId: "p1" },
          { side: "A", playerId: "p2" },
          { side: "B", playerId: "p3" },
        ],
      },
    ];
    const matrix = buildHeadToHeadMatrix(rows, ["p1", "p2", "p3"]);
    expect(headToHeadCell(matrix, "p1", "p2")).toBeUndefined();
  });

  it("ignores players outside the requested id list", () => {
    const rows: HeadToHeadMatchRow[] = [
      { winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }] },
    ];
    const matrix = buildHeadToHeadMatrix(rows, ["p1"]);
    expect(matrix.get("p1")?.size).toBe(0);
  });

  it("skips a match where one side has no players from the requested list", () => {
    const rows: HeadToHeadMatchRow[] = [
      { winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "outsider" }] },
    ];
    const matrix = buildHeadToHeadMatrix(rows, ["p1", "p2"]);
    expect(matrix.get("p1")?.size).toBe(0);
  });
});
