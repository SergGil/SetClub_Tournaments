// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PadelTournamentForm } from "@/components/admin/padel-tournament-form";
import type { createPadelTournamentAction, updatePadelTournamentAction } from "@/lib/actions/padel-tournaments";

const { createPadelTournamentActionMock, updatePadelTournamentActionMock } = vi.hoisted(() => ({
  createPadelTournamentActionMock: vi
    .fn<typeof createPadelTournamentAction>()
    .mockResolvedValue({ success: true }),
  updatePadelTournamentActionMock: vi
    .fn<typeof updatePadelTournamentAction>()
    .mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/actions/padel-tournaments", () => ({
  createPadelTournamentAction: createPadelTournamentActionMock,
  updatePadelTournamentAction: updatePadelTournamentActionMock,
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
  startDate: "2026-01-01",
  endDate: "2026-01-05",
  _count: { matches: 0 },
};

describe("PadelTournamentForm (create mode)", () => {
  it("shows the create-mode submit label with no hidden id field", () => {
    render(<PadelTournamentForm />);
    expect(screen.getByRole("button", { name: "Створити турнір" })).toBeInTheDocument();
    expect(document.querySelector('input[name="id"]')).not.toBeInTheDocument();
  });

  it("updates the character counters as the admin types", async () => {
    const user = userEvent.setup();
    render(<PadelTournamentForm />);
    await user.type(screen.getByLabelText(/Назва турніру/), "Кубок");
    expect(screen.getByText("5/150")).toBeInTheDocument();
  });

  it("shows field errors returned by the server action", async () => {
    createPadelTournamentActionMock.mockResolvedValueOnce({
      error: "Некоректні дані",
      fieldErrors: { name: "Такий турнір уже існує" },
    });
    const user = userEvent.setup();
    render(<PadelTournamentForm />);

    await user.type(screen.getByLabelText(/Назва турніру/), "Кубок");
    await user.type(screen.getByLabelText(/Дата початку/), "2026-01-01");
    await user.type(screen.getByLabelText(/Дата завершення/), "2026-01-02");
    await user.click(screen.getByRole("button", { name: "Створити турнір" }));

    expect(await screen.findByText("Такий турнір уже існує")).toBeInTheDocument();
  });
});

describe("PadelTournamentForm (edit mode)", () => {
  it("shows the edit-mode submit label with the tournament id as a hidden field", () => {
    render(<PadelTournamentForm tournament={tournament} />);
    expect(screen.getByRole("button", { name: "Зберегти зміни" })).toBeInTheDocument();
    expect(document.querySelector('input[name="id"]')).toHaveValue("t1");
  });

  it("locks the format picker once the tournament already has matches", () => {
    render(<PadelTournamentForm tournament={{ ...tournament, _count: { matches: 3 } }} />);
    expect(screen.getByRole("combobox", { name: "Формат" })).toBeDisabled();
    expect(
      screen.getByText("У турнірі вже є матчі — спершу видаліть їх, щоб змінити формат."),
    ).toBeInTheDocument();
  });

  it("leaves the format picker enabled when the tournament has no matches yet", () => {
    render(<PadelTournamentForm tournament={tournament} />);
    expect(
      screen.queryByText("У турнірі вже є матчі — спершу видаліть їх, щоб змінити формат."),
    ).not.toBeInTheDocument();
  });

  it("still submits the tournament's current format even though the locked picker is disabled", async () => {
    const user = userEvent.setup();
    render(<PadelTournamentForm tournament={{ ...tournament, _count: { matches: 3 } }} />);

    await user.click(screen.getByRole("button", { name: "Зберегти зміни" }));

    await waitFor(() => expect(updatePadelTournamentActionMock).toHaveBeenCalledTimes(1));
    const [, formData] = updatePadelTournamentActionMock.mock.calls[0];
    expect(formData.get("format")).toBe("SINGLES");
  });
});
