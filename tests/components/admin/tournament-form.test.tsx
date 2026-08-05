// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TournamentForm } from "@/components/admin/tournament-form";
import type { createTournamentAction, updateTournamentAction } from "@/lib/actions/tournaments";

const { createTournamentActionMock, updateTournamentActionMock } = vi.hoisted(() => ({
  createTournamentActionMock: vi.fn<typeof createTournamentAction>().mockResolvedValue({ success: true }),
  updateTournamentActionMock: vi.fn<typeof updateTournamentAction>().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/actions/tournaments", () => ({
  createTournamentAction: createTournamentActionMock,
  updateTournamentAction: updateTournamentActionMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const tournament = {
  id: "t1",
  name: "Літній кубок",
  description: "Опис турніру",
  format: "SINGLES" as const,
  status: "UPCOMING" as const,
  surface: "CLAY" as const,
  startDate: "2026-01-01",
  endDate: "2026-01-05",
  _count: { matches: 0 },
};

describe("TournamentForm (create mode)", () => {
  it("shows the create-mode submit label with no hidden id field", () => {
    render(<TournamentForm />);
    expect(screen.getByRole("button", { name: "Створити турнір" })).toBeInTheDocument();
    expect(document.querySelector('input[name="id"]')).not.toBeInTheDocument();
  });

  it("updates the character counters as the admin types", async () => {
    const user = userEvent.setup();
    render(<TournamentForm />);
    await user.type(screen.getByLabelText(/Назва турніру/), "Кубок");
    expect(screen.getByText("5/150")).toBeInTheDocument();
  });

  it("shows field errors returned by the server action", async () => {
    // Every required field is filled here - native HTML validation would
    // otherwise block the submit before the (mocked) action ever runs. The
    // rejection below stands in for a server-side reason the client can't
    // predict (e.g. a name that collided concurrently).
    createTournamentActionMock.mockResolvedValueOnce({
      error: "Некоректні дані",
      fieldErrors: { name: "Такий турнір уже існує" },
    });
    const user = userEvent.setup();
    render(<TournamentForm />);

    await user.type(screen.getByLabelText(/Назва турніру/), "Кубок");
    await user.type(screen.getByLabelText(/Дата початку/), "2026-01-01");
    await user.type(screen.getByLabelText(/Дата завершення/), "2026-01-02");
    await user.click(screen.getByRole("button", { name: "Створити турнір" }));

    expect(await screen.findByText("Такий турнір уже існує")).toBeInTheDocument();
  });
});

describe("TournamentForm (edit mode)", () => {
  it("shows the edit-mode submit label with the tournament id as a hidden field", () => {
    render(<TournamentForm tournament={tournament} />);
    expect(screen.getByRole("button", { name: "Зберегти зміни" })).toBeInTheDocument();
    expect(document.querySelector('input[name="id"]')).toHaveValue("t1");
  });

  it("locks the format picker once the tournament already has matches", () => {
    render(<TournamentForm tournament={{ ...tournament, _count: { matches: 3 } }} />);
    expect(screen.getByRole("combobox", { name: "Формат" })).toBeDisabled();
    expect(
      screen.getByText("У турнірі вже є матчі — спершу видаліть їх, щоб змінити формат."),
    ).toBeInTheDocument();
  });

  it("leaves the format picker enabled when the tournament has no matches yet", () => {
    render(<TournamentForm tournament={tournament} />);
    expect(
      screen.queryByText("У турнірі вже є матчі — спершу видаліть їх, щоб змінити формат."),
    ).not.toBeInTheDocument();
  });
});
