import { describe, expect, it, vi } from "vitest";

// tournament-ties.ts imports @/lib/queries/matches (for matchWithDetailsInclude),
// which imports @/lib/db - a real Prisma client requires DATABASE_URL at
// module load, so it needs stubbing even though these tests only exercise
// the pure buildTieTeamRows function.
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { buildTieTeamRows } from "@/lib/tournament-ties";
import type { TournamentTieWithRubbers } from "@/lib/tournament-ties";

function setRow(sideAGames: number, sideBGames: number, setNumber = 1) {
  return { id: `s${setNumber}`, matchId: "m1", setNumber, sideAGames, sideBGames, tiebreakSideAPoints: null, tiebreakSideBPoints: null };
}

function rubber(overrides: Partial<TournamentTieWithRubbers["rubbers"][number]> = {}) {
  return {
    id: "m1",
    status: "COMPLETED",
    winnerSide: "A",
    retired: false,
    sets: [setRow(6, 4)],
    ...overrides,
  } as TournamentTieWithRubbers["rubbers"][number];
}

function tie(overrides: Partial<TournamentTieWithRubbers> = {}): TournamentTieWithRubbers {
  return {
    id: "tie1",
    label: null,
    teamA: { id: "teamA", name: "Команда А", members: [] },
    teamB: { id: "teamB", name: "Команда Б", members: [] },
    rubbers: [],
    ...overrides,
  } as TournamentTieWithRubbers;
}

describe("buildTieTeamRows", () => {
  it("gives every team with at least one tie a row, even at 0-0", () => {
    const { rows } = buildTieTeamRows([tie({ rubbers: [] })]);
    expect(rows.map((r) => r.key).sort()).toEqual(["teamA", "teamB"]);
    expect(rows.every((r) => r.wins === 0 && r.losses === 0)).toBe(true);
  });

  it("does not decide a tie until every one of its rubbers is completed", () => {
    const { rows } = buildTieTeamRows([
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
    // Games from the already-completed rubber still count, though.
    expect(teamA.gamesWon).toBe(6);
  });

  it("credits the team that won more rubbers once the tie is fully decided", () => {
    const { rows, h2h } = buildTieTeamRows([
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
    const { rows } = buildTieTeamRows([
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
    const { rows } = buildTieTeamRows([
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
    // A straight-sets win is worth 2 points under computeMatchPoints.
    expect(teamA.points).toBe(2);
    expect(teamB.points).toBe(0);
  });

  it("accumulates across multiple ties between the same two teams", () => {
    const { rows } = buildTieTeamRows([
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

  it("returns no rows at all when there are no ties - the empty-tournament, feature-invisible case", () => {
    const { rows, h2h } = buildTieTeamRows([]);
    expect(rows).toEqual([]);
    expect(h2h.size).toBe(0);
  });
});
