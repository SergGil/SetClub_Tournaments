// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TournamentBracket } from "@/components/tournament-bracket";
import type { BracketTree } from "@/lib/playoff-bracket-tree";
import type { MatchWithDetails } from "@/lib/queries/matches";

function playerRow(side: "A" | "B", id: string, name: string) {
  return {
    id: `${side}-${id}`,
    matchId: "m1",
    side,
    playerId: id,
    player: { id, name, nickname: null, gender: null, user: null },
  };
}

function buildMatch(overrides: Partial<MatchWithDetails> = {}): MatchWithDetails {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "m1",
    tournamentId: "t1",
    matchType: "SINGLES",
    round: "Фінал",
    scheduledDate: null,
    status: "COMPLETED",
    winnerSide: "A",
    retired: false,
    walkover: false,
    completedAt: now,
    createdAt: now,
    updatedAt: now,
    tournament: { id: "t1", name: "Літній кубок" },
    sets: [{ sideAGames: 6, sideBGames: 2, tiebreakSideAPoints: null, tiebreakSideBPoints: null }],
    players: [playerRow("A", "p1", "Іоганов Денис"), playerRow("B", "p2", "Очеретенко Олександр")],
    ...overrides,
  } as MatchWithDetails;
}

function singleMatchTree(match: MatchWithDetails): BracketTree {
  return {
    columns: [{ round: "Фінал", nodes: [{ match, round: "Фінал", sideA: { playerIds: ["p1"], source: null }, sideB: { playerIds: ["p2"], source: null } }] }],
    bronze: null,
  };
}

describe("TournamentBracket (walkover side labels)", () => {
  it("marks only the losing side as 'тех.', leaving the winner's own row blank", () => {
    const match = buildMatch({ walkover: true, winnerSide: "A", sets: [] });
    render(<TournamentBracket tree={singleMatchTree(match)} />);

    expect(screen.getAllByText("тех.")).toHaveLength(1);
    // The winner's name also appears again in the champion banner below the
    // bracket - the match-box occurrence (the first one) is what matters here.
    const winnerRow = screen.getAllByText("Іоганов Денис")[0].closest("div");
    expect(winnerRow).not.toHaveTextContent("тех.");
    const loserRow = screen.getByText("Очеретенко Олександр").closest("div");
    expect(loserRow).toHaveTextContent("тех.");
  });

  it("shows the real set score on both sides for a normally completed match", () => {
    const match = buildMatch();
    render(<TournamentBracket tree={singleMatchTree(match)} />);

    expect(screen.queryByText("тех.")).not.toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
