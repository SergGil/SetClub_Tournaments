import { describe, expect, it } from "vitest";

import type { MatchWithDetails } from "@/lib/queries/matches";
import { buildMatchShareData } from "@/lib/share/match-card-data";

function playerRow(
  side: "A" | "B",
  id: string,
  name: string,
  gender: "MALE" | "FEMALE" | null = null,
) {
  return { id: `${side}-${id}`, matchId: "m1", side, playerId: id, player: { id, name, nickname: null, gender } };
}

function buildMatch(overrides: Partial<MatchWithDetails> = {}): MatchWithDetails {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "m1",
    tournamentId: "t1",
    matchType: "SINGLES",
    round: null,
    scheduledDate: null,
    status: "COMPLETED",
    winnerSide: "A",
    retired: false,
    walkover: false,
    completedAt: now,
    createdAt: now,
    updatedAt: now,
    tournament: { id: "t1", name: "Літній кубок" },
    sets: [],
    players: [playerRow("A", "p1", "Іван"), playerRow("B", "p2", "Петро")],
    ...overrides,
  } as MatchWithDetails;
}

describe("buildMatchShareData", () => {
  it("returns null for a match that hasn't been decided yet", () => {
    expect(buildMatchShareData(buildMatch({ status: "SCHEDULED", winnerSide: null }))).toBeNull();
    expect(buildMatchShareData(buildMatch({ status: "CANCELLED", winnerSide: null }))).toBeNull();
  });

  it("returns null for a COMPLETED match with no winnerSide (shouldn't happen, but nothing to show)", () => {
    expect(buildMatchShareData(buildMatch({ status: "COMPLETED", winnerSide: null }))).toBeNull();
  });

  it("shapes a straight-sets singles win, marking the winning side and each set's score", () => {
    const data = buildMatchShareData(
      buildMatch({
        winnerSide: "A",
        sets: [
          { id: "s1", matchId: "m1", setNumber: 1, sideAGames: 6, sideBGames: 4, tiebreakSideAPoints: null, tiebreakSideBPoints: null },
          { id: "s2", matchId: "m1", setNumber: 2, sideAGames: 6, sideBGames: 3, tiebreakSideAPoints: null, tiebreakSideBPoints: null },
        ],
      }),
    );

    expect(data).toEqual({
      tournamentName: "Літній кубок",
      round: null,
      matchTypeLabel: "1×1",
      badge: null,
      sideA: { names: ["Іван"], isWinner: true, sets: [{ value: 6, tiebreak: null }, { value: 6, tiebreak: null }] },
      sideB: { names: ["Петро"], isWinner: false, sets: [{ value: 4, tiebreak: null }, { value: 3, tiebreak: null }] },
    });
  });

  it("carries each side's own tiebreak points for a 7-6 set", () => {
    const data = buildMatchShareData(
      buildMatch({
        sets: [
          { id: "s1", matchId: "m1", setNumber: 1, sideAGames: 7, sideBGames: 6, tiebreakSideAPoints: 7, tiebreakSideBPoints: 5 },
        ],
      }),
    );

    expect(data?.sideA.sets).toEqual([{ value: 7, tiebreak: 7 }]);
    expect(data?.sideB.sets).toEqual([{ value: 6, tiebreak: 5 }]);
  });

  it("joins doubles pair names into their side's name list", () => {
    const data = buildMatchShareData(
      buildMatch({
        matchType: "DOUBLES",
        players: [
          playerRow("A", "p1", "Іван"),
          playerRow("A", "p3", "Олег"),
          playerRow("B", "p2", "Петро"),
          playerRow("B", "p4", "Данило"),
        ],
      }),
    );

    expect(data?.matchTypeLabel).toBe("2×2");
    expect(data?.sideA.names).toEqual(["Іван", "Олег"]);
    expect(data?.sideB.names).toEqual(["Петро", "Данило"]);
  });

  it("badges a retirement with the retiring (losing) side's gendered wording", () => {
    const data = buildMatchShareData(
      buildMatch({
        winnerSide: "A",
        retired: true,
        players: [playerRow("A", "p1", "Іван"), playerRow("B", "p2", "Марія", "FEMALE")],
      }),
    );
    expect(data?.badge).toBe("Знялась з матчу");
  });

  it("badges a walkover distinctly from a retirement", () => {
    const data = buildMatchShareData(buildMatch({ winnerSide: "A", walkover: true, sets: [] }));
    expect(data?.badge).toBe("Технічна поразка");
  });

  it("normalizes a legacy round label the same way MatchSummary does", () => {
    const data = buildMatchShareData(buildMatch({ round: "Сіяні" }));
    expect(data?.round).toBe("Gold (сіяні)");
  });
});
