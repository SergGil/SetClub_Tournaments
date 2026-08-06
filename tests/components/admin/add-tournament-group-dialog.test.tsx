// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AddTournamentGroupDialog } from "@/components/admin/add-tournament-group-dialog";

const { createTournamentGroupActionMock } = vi.hoisted(() => ({
  createTournamentGroupActionMock: vi.fn(async () => ({})),
}));
vi.mock("@/lib/actions/tournaments", () => ({
  createTournamentGroupAction: createTournamentGroupActionMock,
}));

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock } }));

beforeEach(() => {
  vi.clearAllMocks();
});

const participants = [
  { id: "p1", name: "Іван" },
  { id: "p2", name: "Петро" },
];

describe("AddTournamentGroupDialog", () => {
  it("disables the submit button until a name is entered", async () => {
    const user = userEvent.setup();
    render(<AddTournamentGroupDialog tournamentId="t1" participants={participants} />);

    await user.click(screen.getByRole("button", { name: "Додати групу" }));
    expect(screen.getByRole("button", { name: "Створити" })).toBeDisabled();

    await user.type(screen.getByLabelText("Назва групи"), "Плейофф");
    expect(screen.getByRole("button", { name: "Створити" })).not.toBeDisabled();
  });

  it("creates the group with the picked already-participating players and closes on success", async () => {
    const user = userEvent.setup();
    render(<AddTournamentGroupDialog tournamentId="t1" participants={participants} />);

    await user.click(screen.getByRole("button", { name: "Додати групу" }));
    await user.type(screen.getByLabelText("Назва групи"), "Плейофф");

    await user.click(screen.getByRole("combobox", { name: "Обрати гравців для групи" }));
    await user.click(await screen.findByRole("option", { name: "Іван" }));
    await user.click(screen.getByRole("option", { name: "Петро" }));
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Створити" }));

    await waitFor(() =>
      expect(createTournamentGroupActionMock).toHaveBeenCalledWith("t1", "Плейофф", ["p1", "p2"]),
    );
    await waitFor(() => expect(screen.queryByLabelText("Назва групи")).not.toBeInTheDocument());
  });

  it("creates a group with no players picked", async () => {
    const user = userEvent.setup();
    render(<AddTournamentGroupDialog tournamentId="t1" participants={participants} />);

    await user.click(screen.getByRole("button", { name: "Додати групу" }));
    await user.type(screen.getByLabelText("Назва групи"), "Резерв");
    await user.click(screen.getByRole("button", { name: "Створити" }));

    await waitFor(() =>
      expect(createTournamentGroupActionMock).toHaveBeenCalledWith("t1", "Резерв", []),
    );
  });

  it("shows a toast and keeps the dialog open when the create fails", async () => {
    createTournamentGroupActionMock.mockResolvedValueOnce({ error: "Група з таким номером вже є" });
    const user = userEvent.setup();
    render(<AddTournamentGroupDialog tournamentId="t1" participants={participants} />);

    await user.click(screen.getByRole("button", { name: "Додати групу" }));
    await user.type(screen.getByLabelText("Назва групи"), "Плейофф");
    await user.click(screen.getByRole("button", { name: "Створити" }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Група з таким номером вже є"));
    expect(screen.getByLabelText("Назва групи")).toBeInTheDocument();
  });
});
