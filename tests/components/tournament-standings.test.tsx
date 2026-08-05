// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TournamentStandingsSection } from "@/components/tournament-standings";
import type { StandingsRow } from "@/lib/tournament-standings";

function row(overrides: Partial<StandingsRow> & { key: string; label: string }): StandingsRow {
  return {
    matchesPlayed: 2,
    wins: 1,
    losses: 1,
    winPct: 50,
    gamesWon: 10,
    gamesLost: 8,
    points: 2,
    ...overrides,
  };
}

describe("TournamentStandingsSection (ungrouped)", () => {
  it("shows the empty-state message with no rows", () => {
    render(<TournamentStandingsSection standings={{ grouped: false, rows: [], roundRobinDone: false }} showWinner />);
    expect(screen.getByText("Учасників ще не додано.")).toBeInTheDocument();
  });

  it("crowns the top row once the round robin is done, even before the tournament is flipped to COMPLETED", () => {
    const rows = [row({ key: "p1", label: "Іван", wins: 3 }), row({ key: "p2", label: "Петро", wins: 1 })];
    // showWinner=false here on purpose - it's the "tournament is COMPLETED"
    // signal, which this scenario deliberately isn't (yet) - roundRobinDone
    // alone should already be enough to show the trophy.
    const { container, rerender } = render(
      <TournamentStandingsSection standings={{ grouped: false, rows, roundRobinDone: false }} showWinner={false} />,
    );
    expect(container.querySelector('[aria-label="Переможець"]')).not.toBeInTheDocument();

    rerender(
      <TournamentStandingsSection standings={{ grouped: false, rows, roundRobinDone: true }} showWinner={false} />,
    );
    expect(container.querySelector('[aria-label="Переможець"]')).toBeInTheDocument();
  });

  it("suppresses the trophy when a playoff final already decided the champion", () => {
    const rows = [row({ key: "p1", label: "Іван", wins: 3 })];
    const { container } = render(
      <TournamentStandingsSection
        standings={{ grouped: false, rows, roundRobinDone: true }}
        showWinner
        hasPlayoffFinal
      />,
    );
    expect(container.querySelector('[aria-label="Переможець"]')).not.toBeInTheDocument();
  });

  it("links a row to its player page when given an href", () => {
    const rows = [row({ key: "p1", label: "Іван", href: "/players/p1", wins: 0 })];
    render(<TournamentStandingsSection standings={{ grouped: false, rows, roundRobinDone: false }} showWinner />);
    expect(screen.getByRole("link", { name: "Іван" })).toHaveAttribute("href", "/players/p1");
  });
});

describe("TournamentStandingsSection (grouped)", () => {
  it("shows both group titles only when two independent splits are active at once", () => {
    render(
      <TournamentStandingsSection
        standings={{
          grouped: true,
          groupings: [
            {
              title: "За групами",
              groups: [{ label: "Група 1", rows: [row({ key: "p1", label: "Іван" })], roundRobinDone: false }],
            },
            {
              title: "За сіяністю",
              groups: [
                { label: "Gold (сіяні)", rows: [row({ key: "p2", label: "Петро" })], roundRobinDone: false },
              ],
            },
          ],
        }}
        showWinner
      />,
    );
    expect(screen.getByText("За групами")).toBeInTheDocument();
    expect(screen.getByText("За сіяністю")).toBeInTheDocument();
    expect(screen.getByText("Gold (сіяні)")).toBeInTheDocument();
  });
});
