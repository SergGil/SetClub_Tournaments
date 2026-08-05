// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MatchesFilters } from "@/components/matches-filters";

const { pushMock, usePathnameMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  usePathnameMock: vi.fn(() => "/matches"),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: usePathnameMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const players = [
  { id: "p1", name: "Іван" },
  { id: "p2", name: "Петро" },
];

describe("MatchesFilters", () => {
  it("hides the reset button with no filter active", () => {
    render(<MatchesFilters players={players} selectedStatus="ALL" />);
    expect(screen.queryByRole("button", { name: /Скинути фільтри/ })).not.toBeInTheDocument();
  });

  it("shows the reset button once any single filter is active", () => {
    render(<MatchesFilters players={players} selectedStatus="COMPLETED" />);
    expect(screen.getByRole("button", { name: /Скинути фільтри/ })).toBeInTheDocument();
  });

  it("pushes the player filter, preserving status", async () => {
    const user = userEvent.setup();
    render(<MatchesFilters players={players} selectedStatus="SCHEDULED" />);
    await user.click(screen.getByRole("combobox", { name: "Фільтр за гравцем" }));
    await user.click(screen.getByRole("option", { name: "Іван" }));

    expect(pushMock).toHaveBeenCalledWith("/matches?player=p1&status=SCHEDULED");
  });

  it("pushes the date filter as a query param", () => {
    // A native date input fires one onChange with the complete value once a
    // date is picked - not per keystroke - so simulate that directly rather
    // than typing into what's a fully server-controlled (never locally
    // updated) field in this isolated render.
    render(<MatchesFilters players={players} selectedStatus="ALL" />);
    fireEvent.change(screen.getByLabelText("Дата:"), { target: { value: "2026-03-15" } });

    expect(pushMock).toHaveBeenCalledWith("/matches?date=2026-03-15&status=ALL");
  });

  it("resets by pushing the bare pathname", async () => {
    const user = userEvent.setup();
    render(<MatchesFilters players={players} selectedStatus="COMPLETED" />);
    await user.click(screen.getByRole("button", { name: /Скинути фільтри/ }));
    expect(pushMock).toHaveBeenCalledWith("/matches");
  });
});
