// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TournamentsTable } from "@/components/admin/tournaments-table";
import type { TournamentListItem } from "@/lib/queries/tournaments";

function buildTournament(overrides: Partial<TournamentListItem> & { id: string }): TournamentListItem {
  return {
    name: "Кубок",
    format: "SINGLES",
    surface: "CLAY",
    status: "UPCOMING",
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-01-02"),
    _count: { participants: 4, matches: 2 },
    ...overrides,
  } as TournamentListItem;
}

describe("TournamentsTable (sorting)", () => {
  it("marks the active sort column and points the header link at the flipped direction", () => {
    render(
      <TournamentsTable
        tournaments={[]}
        sort={{ key: "matches", dir: "desc" }}
        baseHref="/admin/tournaments"
      />,
    );

    const matchesHeader = screen.getByRole("columnheader", { name: /Матчів/ });
    expect(matchesHeader).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("link", { name: /Матчів/ })).toHaveAttribute(
      "href",
      "/admin/tournaments?sort=matches&dir=asc",
    );

    const datesHeader = screen.getByRole("columnheader", { name: "Дати" });
    expect(datesHeader).toHaveAttribute("aria-sort", "none");
  });

  it("defaults an inactive column's link to descending", () => {
    render(
      <TournamentsTable
        tournaments={[]}
        sort={{ key: "matches", dir: "desc" }}
        baseHref="/admin/tournaments"
      />,
    );
    expect(screen.getByRole("link", { name: "Дати" })).toHaveAttribute(
      "href",
      "/admin/tournaments?sort=startDate&dir=desc",
    );
  });
});

describe("TournamentsTable (rows)", () => {
  it("links every cell in a row to the tournament's detail page", () => {
    render(
      <TournamentsTable
        tournaments={[buildTournament({ id: "t1", name: "Літній кубок" })]}
        sort={{ key: "startDate", dir: "desc" }}
        baseHref="/admin/tournaments"
      />,
    );
    const nameLink = screen.getByRole("link", { name: "Літній кубок" });
    expect(nameLink).toHaveAttribute("href", "/admin/tournaments/t1");
  });

  it("shows an empty-state row when there are no tournaments", () => {
    render(<TournamentsTable tournaments={[]} sort={{ key: "startDate", dir: "desc" }} baseHref="/admin/tournaments" />);
    expect(screen.getByText("Нічого не знайдено.")).toBeInTheDocument();
  });
});
