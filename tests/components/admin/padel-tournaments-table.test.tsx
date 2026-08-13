// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PadelTournamentsTable } from "@/components/admin/padel-tournaments-table";
import type { PadelTournamentListItem } from "@/lib/queries/padel-tournaments";

function buildTournament(
  overrides: Partial<PadelTournamentListItem> & { id: string },
): PadelTournamentListItem {
  return {
    name: "Кубок",
    format: "SINGLES",
    status: "UPCOMING",
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-01-02"),
    _count: { participants: 4, matches: 2 },
    ...overrides,
  } as PadelTournamentListItem;
}

describe("PadelTournamentsTable (sorting)", () => {
  it("marks the active sort column and points the header link at the flipped direction", () => {
    render(
      <PadelTournamentsTable
        tournaments={[]}
        sort={{ key: "matches", dir: "desc" }}
        baseHref="/admin/padel/tournaments"
      />,
    );

    const matchesHeader = screen.getByRole("columnheader", { name: /Матчів/ });
    expect(matchesHeader).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("link", { name: /Матчів/ })).toHaveAttribute(
      "href",
      "/admin/padel/tournaments?sort=matches&dir=asc",
    );

    const datesHeader = screen.getByRole("columnheader", { name: "Дати" });
    expect(datesHeader).toHaveAttribute("aria-sort", "none");
  });

  it("defaults an inactive column's link to descending", () => {
    render(
      <PadelTournamentsTable
        tournaments={[]}
        sort={{ key: "matches", dir: "desc" }}
        baseHref="/admin/padel/tournaments"
      />,
    );
    expect(screen.getByRole("link", { name: "Дати" })).toHaveAttribute(
      "href",
      "/admin/padel/tournaments?sort=startDate&dir=desc",
    );
  });
});

describe("PadelTournamentsTable (rows)", () => {
  it("links every cell in a row to the tournament's detail page", () => {
    render(
      <PadelTournamentsTable
        tournaments={[buildTournament({ id: "t1", name: "Літній кубок" })]}
        sort={{ key: "startDate", dir: "desc" }}
        baseHref="/admin/padel/tournaments"
      />,
    );
    const nameLink = screen.getByRole("link", { name: "Літній кубок" });
    expect(nameLink).toHaveAttribute("href", "/admin/padel/tournaments/t1");
  });

  it("shows an empty-state row when there are no tournaments", () => {
    render(
      <PadelTournamentsTable
        tournaments={[]}
        sort={{ key: "startDate", dir: "desc" }}
        baseHref="/admin/padel/tournaments"
      />,
    );
    expect(screen.getByText("Нічого не знайдено.")).toBeInTheDocument();
  });
});
