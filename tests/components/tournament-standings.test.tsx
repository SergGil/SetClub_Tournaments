// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TournamentStandingsSection, tournamentShareCaption } from "@/components/tournament-standings";
import type { PlacedStandingsRow, StandingsRow } from "@/lib/tournament-standings";

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

function placedRow(
  overrides: Partial<PlacedStandingsRow> & { key: string; label: string; place: number | null },
): PlacedStandingsRow {
  return { ...row(overrides), ...overrides };
}

describe("TournamentStandingsSection (ungrouped)", () => {
  it("shows the empty-state message with no rows", () => {
    render(<TournamentStandingsSection standings={{ mode: "individual", rows: [], roundRobinDone: false }} showWinner />);
    expect(screen.getByText("Учасників ще не додано.")).toBeInTheDocument();
  });

  it("crowns the top row once the round robin is done, even before the tournament is flipped to COMPLETED", () => {
    const rows = [row({ key: "p1", label: "Іван", wins: 3 }), row({ key: "p2", label: "Петро", wins: 1 })];
    // showWinner=false here on purpose - it's the "tournament is COMPLETED"
    // signal, which this scenario deliberately isn't (yet) - roundRobinDone
    // alone should already be enough to show the trophy.
    const { container, rerender } = render(
      <TournamentStandingsSection standings={{ mode: "individual", rows, roundRobinDone: false }} showWinner={false} />,
    );
    expect(container.querySelector('[aria-label="Переможець"]')).not.toBeInTheDocument();

    rerender(
      <TournamentStandingsSection standings={{ mode: "individual", rows, roundRobinDone: true }} showWinner={false} />,
    );
    expect(container.querySelector('[aria-label="Переможець"]')).toBeInTheDocument();
  });

  it("suppresses the trophy when a playoff final already decided the champion", () => {
    const rows = [row({ key: "p1", label: "Іван", wins: 3 })];
    const { container } = render(
      <TournamentStandingsSection
        standings={{ mode: "individual", rows, roundRobinDone: true }}
        showWinner
        hasPlayoffFinal
      />,
    );
    expect(container.querySelector('[aria-label="Переможець"]')).not.toBeInTheDocument();
  });

  it("links a row to its player page when given an href", () => {
    const rows = [row({ key: "p1", label: "Іван", href: "/players/p1", wins: 0 })];
    render(<TournamentStandingsSection standings={{ mode: "individual", rows, roundRobinDone: false }} showWinner />);
    expect(screen.getByRole("link", { name: "Іван" })).toHaveAttribute("href", "/players/p1");
  });

  it("shows the trophy next to a winning row that also links to its player page", () => {
    const rows = [row({ key: "p1", label: "Іван", href: "/players/p1", wins: 3 })];
    const { container } = render(
      <TournamentStandingsSection standings={{ mode: "individual", rows, roundRobinDone: true }} showWinner />,
    );
    expect(container.querySelector('[aria-label="Переможець"]')).toBeInTheDocument();
  });
});

describe("TournamentStandingsSection (grouped)", () => {
  it("shows both group titles only when two independent splits are active at once", () => {
    render(
      <TournamentStandingsSection
        standings={{
          mode: "grouped",
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

  it("renders renderGroupHeaderExtra only for groups that carry an id (custom groups)", () => {
    render(
      <TournamentStandingsSection
        standings={{
          mode: "grouped",
          groupings: [
            {
              title: "За групами",
              groups: [{ label: "Група A", rows: [row({ key: "p1", label: "Іван" })], roundRobinDone: false }],
            },
            {
              title: "Додаткові групи",
              groups: [
                {
                  label: "Плейофф",
                  rows: [row({ key: "p2", label: "Петро" })],
                  roundRobinDone: false,
                  id: "group-1",
                },
              ],
            },
          ],
        }}
        showWinner
        renderGroupHeaderExtra={(group) => (group.id ? <button>Видалити {group.label}</button> : null)}
      />,
    );
    expect(screen.queryByRole("button", { name: "Видалити Група A" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Видалити Плейофф" })).toBeInTheDocument();
  });

  it("omits the grouping heading when a grouping has no title", () => {
    render(
      <TournamentStandingsSection
        standings={{
          mode: "grouped",
          groupings: [{ title: null, groups: [{ label: "Група 1", rows: [row({ key: "p1", label: "Іван" })], roundRobinDone: false }] }],
        }}
        showWinner
      />,
    );
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    expect(screen.getByText("Група 1")).toBeInTheDocument();
  });
});

describe("TournamentStandingsSection (placedTable)", () => {
  it("shows the placed-table empty state with no rows", () => {
    render(
      <TournamentStandingsSection
        standings={{ mode: "individual", rows: [], roundRobinDone: false, placedTable: { rows: [], complete: false } }}
        showWinner
      />,
    );
    expect(screen.getByText("Підсумкова таблиця")).toBeInTheDocument();
    expect(screen.getAllByText("Учасників ще не додано.")).toHaveLength(2);
  });

  it("renders a dash for a row whose place isn't decided yet", () => {
    const placedTable = { rows: [placedRow({ key: "p1", label: "Іван", place: null })], complete: false };
    render(
      <TournamentStandingsSection
        standings={{ mode: "individual", rows: [], roundRobinDone: false, placedTable }}
        showWinner
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("crowns place 1 only once the placement is complete", () => {
    const rows = [placedRow({ key: "p1", label: "Іван", place: 1 })];
    const { container, rerender } = render(
      <TournamentStandingsSection
        standings={{ mode: "individual", rows: [], roundRobinDone: false, placedTable: { rows, complete: false } }}
        showWinner
      />,
    );
    expect(container.querySelector('[aria-label="Переможець"]')).not.toBeInTheDocument();

    rerender(
      <TournamentStandingsSection
        standings={{ mode: "individual", rows: [], roundRobinDone: false, placedTable: { rows, complete: true } }}
        showWinner
      />,
    );
    expect(container.querySelector('[aria-label="Переможець"]')).toBeInTheDocument();
  });

  it("links a placed row to its player page when given an href", () => {
    const rows = [placedRow({ key: "p1", label: "Іван", place: 2, href: "/players/p1" })];
    render(
      <TournamentStandingsSection
        standings={{ mode: "individual", rows: [], roundRobinDone: false, placedTable: { rows, complete: false } }}
        showWinner
      />,
    );
    expect(screen.getByRole("link", { name: "Іван" })).toHaveAttribute("href", "/players/p1");
  });

  it("shows the trophy next to a completed champion row that also links to its player page", () => {
    const rows = [placedRow({ key: "p1", label: "Іван", place: 1, href: "/players/p1" })];
    const { container } = render(
      <TournamentStandingsSection
        standings={{ mode: "individual", rows: [], roundRobinDone: false, placedTable: { rows, complete: true } }}
        showWinner
      />,
    );
    expect(container.querySelector('[aria-label="Переможець"]')).toBeInTheDocument();
  });

  it("also renders the placed table under grouped standings", () => {
    const rows = [placedRow({ key: "p1", label: "Іван", place: 1 })];
    render(
      <TournamentStandingsSection
        standings={{
          mode: "grouped",
          groupings: [
            { title: "За групами", groups: [{ label: "Група 1", rows: [row({ key: "p1", label: "Іван" })], roundRobinDone: false }] },
          ],
          placedTable: { rows, complete: true },
        }}
        showWinner
      />,
    );
    expect(screen.getByText("Підсумкова таблиця")).toBeInTheDocument();
  });

  it("shows the share button only once the tournament is COMPLETED and the ids/name needed for it are known", () => {
    const rows = [placedRow({ key: "p1", label: "Іван", place: 1 })];
    const { rerender } = render(
      <TournamentStandingsSection
        standings={{ mode: "individual", rows: [], roundRobinDone: false, placedTable: { rows, complete: false } }}
        showWinner
        tournamentId="t1"
        tournamentName="Літній кубок"
      />,
    );
    expect(screen.queryByRole("button", { name: "Поділитися" })).not.toBeInTheDocument();

    rerender(
      <TournamentStandingsSection
        standings={{ mode: "individual", rows: [], roundRobinDone: false, placedTable: { rows, complete: true } }}
        showWinner
      />,
    );
    expect(screen.queryByRole("button", { name: "Поділитися" })).not.toBeInTheDocument();

    rerender(
      <TournamentStandingsSection
        standings={{ mode: "individual", rows: [], roundRobinDone: false, placedTable: { rows, complete: true } }}
        showWinner
        tournamentId="t1"
        tournamentName="Літній кубок"
      />,
    );
    expect(screen.getByRole("button", { name: "Поділитися" })).toBeInTheDocument();
  });
});

describe("tournamentShareCaption", () => {
  it("lists the top 3 places in order, regardless of the rows' own order", () => {
    const rows = [
      placedRow({ key: "p3", label: "Олег", place: 3 }),
      placedRow({ key: "p1", label: "Іван", place: 1 }),
      placedRow({ key: "p2", label: "Петро", place: 2 }),
    ];
    expect(tournamentShareCaption("Літній кубок", rows)).toBe(
      "1. Іван, 2. Петро, 3. Олег — Підсумки турніру «Літній кубок»",
    );
  });

  it("ignores rows without a decided place and caps the podium at 3", () => {
    const rows = [
      placedRow({ key: "p1", label: "Іван", place: 1 }),
      placedRow({ key: "p2", label: "Петро", place: 2 }),
      placedRow({ key: "p3", label: "Олег", place: 3 }),
      placedRow({ key: "p4", label: "Марко", place: 4 }),
      placedRow({ key: "p5", label: "Дмитро", place: null }),
    ];
    expect(tournamentShareCaption("Літній кубок", rows)).toBe(
      "1. Іван, 2. Петро, 3. Олег — Підсумки турніру «Літній кубок»",
    );
  });

  it("still builds a (empty-podium) caption when no row has a decided place yet", () => {
    const rows = [placedRow({ key: "p1", label: "Іван", place: null })];
    expect(tournamentShareCaption("Літній кубок", rows)).toBe(" — Підсумки турніру «Літній кубок»");
  });
});
