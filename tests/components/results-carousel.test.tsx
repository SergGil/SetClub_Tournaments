// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResultsCarousel } from "@/components/results-carousel";
import type { MatchWithDetails } from "@/lib/queries/matches";

beforeEach(() => {
  // jsdom doesn't implement scrollBy - the component calls it on arrow clicks.
  Element.prototype.scrollBy = vi.fn();
});

function buildMatch(id: string, winnerName: string, loserName: string): MatchWithDetails {
  const now = new Date("2026-03-15T00:00:00.000Z");
  return {
    id,
    tournamentId: "t1",
    matchType: "SINGLES",
    round: null,
    scheduledDate: now,
    status: "COMPLETED",
    winnerSide: "A",
    retired: false,
    completedAt: now,
    createdAt: now,
    updatedAt: now,
    tournament: { id: "t1", name: "Кубок" },
    sets: [{ id: "s1", matchId: id, setNumber: 1, sideAGames: 6, sideBGames: 4, tiebreakSideAPoints: null, tiebreakSideBPoints: null }],
    players: [
      { id: "a", matchId: id, side: "A", playerId: "w1", player: { id: "w1", name: winnerName } },
      { id: "b", matchId: id, side: "B", playerId: "l1", player: { id: "l1", name: loserName } },
    ],
  } as MatchWithDetails;
}

describe("ResultsCarousel", () => {
  it("links each tile to its tournament and shows the winner-perspective score", () => {
    render(<ResultsCarousel matches={[buildMatch("m1", "Іван", "Петро")]} />);
    const tile = screen.getByRole("link", { name: /Іван/ });
    expect(tile).toHaveAttribute("href", "/tournaments/t1");
    expect(screen.getByText("Петро")).toBeInTheDocument();
    expect(screen.getByText("6:4")).toBeInTheDocument();
  });

  it("starts with the left arrow disabled and the right arrow enabled", () => {
    render(<ResultsCarousel matches={[buildMatch("m1", "Іван", "Петро"), buildMatch("m2", "Олег", "Данило")]} />);
    expect(screen.getByRole("button", { name: "Прокрутити ліворуч" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Прокрутити праворуч" })).toBeEnabled();
  });

  it("re-evaluates the edge buttons as the strip scrolls", () => {
    render(<ResultsCarousel matches={[buildMatch("m1", "Іван", "Петро"), buildMatch("m2", "Олег", "Данило")]} />);
    const scroller = screen.getByRole("link", { name: /Іван/ }).parentElement!;

    Object.defineProperty(scroller, "scrollLeft", { value: 60, configurable: true });
    Object.defineProperty(scroller, "clientWidth", { value: 200, configurable: true });
    Object.defineProperty(scroller, "scrollWidth", { value: 260, configurable: true });
    fireEvent.scroll(scroller);

    expect(screen.getByRole("button", { name: "Прокрутити ліворуч" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Прокрутити праворуч" })).toBeDisabled();
  });

  it("scrolls by a fixed step when an arrow is clicked", () => {
    render(<ResultsCarousel matches={[buildMatch("m1", "Іван", "Петро"), buildMatch("m2", "Олег", "Данило")]} />);
    fireEvent.click(screen.getByRole("button", { name: "Прокрутити праворуч" }));
    expect(Element.prototype.scrollBy).toHaveBeenCalledWith({ left: 280, behavior: "smooth" });
  });
});
