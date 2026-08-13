import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { buildPadelTieTeamRows } from "@/lib/padel-tournament-ties";
import type { PadelTournamentTieWithRubbers } from "@/lib/padel-tournament-ties";

function setRow(sideAGames: number, sideBGames: number, setNumber = 1) {
  return { id: `s${setNumber}`, matchId: "m1", setNumber, sideAGames, sideBGames, tiebreakSideAPoints: null, tiebreakSideBPoints: null };
}

function rubber(overrides: Partial<PadelTournamentTieWithRubbers["rubbers"][number]> = {}) {
  return {
    id: "m1",
    status: "COMPLETED",
    winnerSide: "A",
    retired: false,
    sets: [setRow(6, 4)],
    ...overrides,
  } as PadelTournamentTieWithRubbers["rubbers"][number];
}

function tie(overrides: Partial<PadelTournamentTieWithRubbers> = {}): PadelTournamentTieWithRubbers {
  return {
    id: "tie1",
    label: null,
    teamA: { id: "teamA", name: "Команда А", members: [] },
    teamB: { id: "teamB", name: "Команда Б", members: [] },
    rubbers: [],
    ...overrides,
  } as PadelTournamentTieWithRubbers;
}

describe("buildPadelTieTeamRows", () => {
  it("gives every team with at least one tie a row, even at 0-0", () => {
    const { rows } = buildPadelTieTeamRows([tie({ rubbers: [] })]);
    expect(rows.map((r) => r.key).sort()).toEqual(["teamA", "teamB"]);
    expect(rows.every((r) => r.wins === 0 && r.losses === 0)).toBe(true);
  });

  it("does not decide a tie until every one of its rubbers is completed", () => {
    const { rows } = buildPadelTieTeamRows([
      tie({
        rubbers: [
          rubber({ id: "m1", winnerSide: "A" }),
          rubber({ id: "m2", status: "SCHEDULED", winnerSide: null }),
        ],
      }),
    ]);
    const teamA = rows.find((r) => r.key === "teamA")!;
    const teamB = rows.find((r) => r.key === "teamB")!;
    expect(teamA.wins).toBe(0);
    expect(teamB.losses).toBe(0);
    expect(teamA.gamesWon).toBe(6);
  });

  it("credits the team that won more rubbers once the tie is fully decided", () => {
    const { rows, h2h } = buildPadelTieTeamRows([
      tie({
        rubbers: [
          rubber({ id: "m1", winnerSide: "A" }),
          rubber({ id: "m2", winnerSide: "A" }),
          rubber({ id: "m3", winnerSide: "B" }),
        ],
      }),
    ]);
    const teamA = rows.find((r) => r.key === "teamA")!;
    const teamB = rows.find((r) => r.key === "teamB")!;
    expect(teamA.wins).toBe(1);
    expect(teamA.losses).toBe(0);
    expect(teamB.wins).toBe(0);
    expect(teamB.losses).toBe(1);
    expect(h2h.get("teamA")?.get("teamB")).toEqual({ wins: 1, losses: 0 });
  });

  it("leaves both teams without a decision when the tie ends in an even split", () => {
    const { rows } = buildPadelTieTeamRows([
      tie({
        rubbers: [
          rubber({ id: "m1", winnerSide: "A" }),
          rubber({ id: "m2", winnerSide: "B" }),
        ],
      }),
    ]);
    expect(rows.every((r) => r.wins === 0 && r.losses === 0)).toBe(true);
  });

  it("aggregates games and points from both sides of every completed rubber", () => {
    const { rows } = buildPadelTieTeamRows([
      tie({
        rubbers: [
          rubber({
            id: "m1",
            winnerSide: "A",
            sets: [setRow(6, 4, 1), setRow(6, 2, 2)],
          }),
        ],
      }),
    ]);
    const teamA = rows.find((r) => r.key === "teamA")!;
    const teamB = rows.find((r) => r.key === "teamB")!;
    expect(teamA.gamesWon).toBe(12);
    expect(teamA.gamesLost).toBe(6);
    expect(teamB.gamesWon).toBe(6);
    expect(teamB.gamesLost).toBe(12);
    expect(teamA.points).toBe(2);
    expect(teamB.points).toBe(0);
  });

  it("accumulates across multiple ties between the same two teams", () => {
    const { rows } = buildPadelTieTeamRows([
      tie({ id: "tie1", rubbers: [rubber({ id: "m1", winnerSide: "A" })] }),
      tie({ id: "tie2", rubbers: [rubber({ id: "m2", winnerSide: "B" })] }),
    ]);
    const teamA = rows.find((r) => r.key === "teamA")!;
    const teamB = rows.find((r) => r.key === "teamB")!;
    expect(teamA.wins).toBe(1);
    expect(teamA.losses).toBe(1);
    expect(teamB.wins).toBe(1);
    expect(teamB.losses).toBe(1);
  });

  it("returns no rows at all when there are no ties", () => {
    const { rows, h2h } = buildPadelTieTeamRows([]);
    expect(rows).toEqual([]);
    expect(h2h.size).toBe(0);
  });
});
