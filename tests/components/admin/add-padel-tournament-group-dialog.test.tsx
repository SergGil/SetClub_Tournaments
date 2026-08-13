// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AddPadelTournamentGroupDialog } from "@/components/admin/add-padel-tournament-group-dialog";

const { createPadelTournamentGroupActionMock } = vi.hoisted(() => ({
  createPadelTournamentGroupActionMock: vi.fn(async () => ({})),
}));
vi.mock("@/lib/actions/padel-tournaments", () => ({
  createPadelTournamentGroupAction: createPadelTournamentGroupActionMock,
}));

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock } }));

beforeEach(() => {
  vi.clearAllMocks();
});

const participants = [
  { id: "p1", name: "Іван", nickname: null },
  { id: "p2", name: "Петро", nickname: null },
];

describe("AddPadelTournamentGroupDialog", () => {
  it("disables the submit button until a name is entered", async () => {
    const user = userEvent.setup();
    render(<AddPadelTournamentGroupDialog tournamentId="t1" participants={participants} />);

    await user.click(screen.getByRole("button", { name: "Додати групу" }));
    expect(screen.getByRole("button", { name: "Створити" })).toBeDisabled();

    await user.type(screen.getByLabelText("Назва групи"), "Плейофф");
    expect(screen.getByRole("button", { name: "Створити" })).not.toBeDisabled();
  });

  it("creates the group with the picked already-participating players and closes on success", async () => {
    const user = userEvent.setup();
    render(<AddPadelTournamentGroupDialog tournamentId="t1" participants={participants} />);

    await user.click(screen.getByRole("button", { name: "Додати групу" }));
    await user.type(screen.getByLabelText("Назва групи"), "Плейофф");

    await user.click(screen.getByRole("combobox", { name: "Обрати гравців для групи" }));
    await user.click(await screen.findByRole("option", { name: "Іван" }));
    await user.click(screen.getByRole("option", { name: "Петро" }));
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Створити" }));

    await waitFor(() =>
      expect(createPadelTournamentGroupActionMock).toHaveBeenCalledWith("t1", "Плейофф", ["p1", "p2"]),
    );
    await waitFor(() => expect(screen.queryByLabelText("Назва групи")).not.toBeInTheDocument());
  });

  it("creates a group with no players picked", async () => {
    const user = userEvent.setup();
    render(<AddPadelTournamentGroupDialog tournamentId="t1" participants={participants} />);

    await user.click(screen.getByRole("button", { name: "Додати групу" }));
    await user.type(screen.getByLabelText("Назва групи"), "Резерв");
    await user.click(screen.getByRole("button", { name: "Створити" }));

    await waitFor(() =>
      expect(createPadelTournamentGroupActionMock).toHaveBeenCalledWith("t1", "Резерв", []),
    );
  });

  it("shows a toast and keeps the dialog open when the create fails", async () => {
    createPadelTournamentGroupActionMock.mockResolvedValueOnce({ error: "Група з таким номером вже є" });
    const user = userEvent.setup();
    render(<AddPadelTournamentGroupDialog tournamentId="t1" participants={participants} />);

    await user.click(screen.getByRole("button", { name: "Додати групу" }));
    await user.type(screen.getByLabelText("Назва групи"), "Плейофф");
    await user.click(screen.getByRole("button", { name: "Створити" }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Група з таким номером вже є"));
    expect(screen.getByLabelText("Назва групи")).toBeInTheDocument();
  });
});
