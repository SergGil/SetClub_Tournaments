// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TournamentPlayoffs } from "@/components/tournament-playoffs";
import type { MatchWithDetails } from "@/lib/queries/matches";

function buildMatch(id: string, round: string | null): MatchWithDetails {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id,
    tournamentId: "t1",
    matchType: "SINGLES",
    round,
    scheduledDate: null,
    status: "COMPLETED",
    winnerSide: "A",
    retired: false,
    completedAt: now,
    createdAt: now,
    updatedAt: now,
    tournament: { id: "t1", name: "Кубок" },
    sets: [{ setNumber: 1, sideAGames: 6, sideBGames: 4, tiebreakSideAPoints: null, tiebreakSideBPoints: null }],
    players: [
      { id: "a", matchId: id, side: "A", playerId: "p1", player: { id: "p1", name: "Іван" } },
      { id: "b", matchId: id, side: "B", playerId: "p2", player: { id: "p2", name: "Петро" } },
    ],
  } as MatchWithDetails;
}

describe("TournamentPlayoffs", () => {
  it("renders nothing when no match has a playoff round", () => {
    const { container } = render(
      <TournamentPlayoffs matches={[buildMatch("m1", null), buildMatch("m2", "Група 1")]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("groups playoff matches under fixed-order stage headings, skipping unused stages", () => {
    render(
      <TournamentPlayoffs
        matches={[buildMatch("m1", "Фінал"), buildMatch("m2", "1/2"), buildMatch("m3", "1/2")]}
      />,
    );
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    // Deepest/most important stage first (see PLAYOFF_DISPLAY_ORDER) - Фінал
    // before the semifinal that fed it, regardless of input order.
    expect(headings).toEqual(["Фінал", "1/2"]);
  });

  it("only shows the champion trophy on the Фінал match", () => {
    const { container } = render(
      <TournamentPlayoffs matches={[buildMatch("m1", "Фінал"), buildMatch("m2", "За 3 місце")]} />,
    );
    expect(container.querySelectorAll('[aria-label="Переможець турніру"]')).toHaveLength(1);
  });

  it("ignores non-playoff round text like a randomizer's custom group label", () => {
    const { container } = render(<TournamentPlayoffs matches={[buildMatch("m1", "Група 1")]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
