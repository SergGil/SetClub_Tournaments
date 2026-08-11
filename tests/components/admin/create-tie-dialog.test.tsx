// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateTieDialog } from "@/components/admin/create-tie-dialog";

const { createTieActionMock } = vi.hoisted(() => ({ createTieActionMock: vi.fn(async () => ({})) }));
vi.mock("@/lib/actions/ties", () => ({ createTieAction: createTieActionMock }));

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock } }));

beforeEach(() => {
  vi.clearAllMocks();
});

const teams = [
  { id: "teamA", name: "Команда А" },
  { id: "teamB", name: "Команда Б" },
];

describe("CreateTieDialog", () => {
  it("disables the trigger with fewer than 2 teams", () => {
    render(<CreateTieDialog tournamentId="t1" teams={[teams[0]]} />);
    expect(screen.getByRole("button", { name: "Створити зустріч" })).toBeDisabled();
  });

  it("keeps the same team from appearing on both sides", async () => {
    const user = userEvent.setup();
    render(<CreateTieDialog tournamentId="t1" teams={teams} />);

    await user.click(screen.getByRole("button", { name: "Створити зустріч" }));
    await user.click(screen.getByRole("combobox", { name: "Обрати команду А" }));
    await user.click(await screen.findByRole("option", { name: "Команда А" }));

    await user.click(screen.getByRole("combobox", { name: "Обрати команду Б" }));
    expect(screen.queryByRole("option", { name: "Команда А" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Команда Б" })).toBeInTheDocument();
  });

  it("creates the tie with an optional label and closes on success", async () => {
    const user = userEvent.setup();
    render(<CreateTieDialog tournamentId="t1" teams={teams} />);

    await user.click(screen.getByRole("button", { name: "Створити зустріч" }));
    await user.click(screen.getByRole("combobox", { name: "Обрати команду А" }));
    await user.click(await screen.findByRole("option", { name: "Команда А" }));
    await user.click(screen.getByRole("combobox", { name: "Обрати команду Б" }));
    await user.click(await screen.findByRole("option", { name: "Команда Б" }));
    await user.type(screen.getByLabelText("Мітка (опційно)"), "Тур 1");

    await user.click(screen.getByRole("button", { name: "Створити" }));

    await waitFor(() =>
      expect(createTieActionMock).toHaveBeenCalledWith("t1", "teamA", "teamB", "Тур 1"),
    );
    await waitFor(() => expect(screen.queryByLabelText("Мітка (опційно)")).not.toBeInTheDocument());
  });

  it("shows a toast when creation fails", async () => {
    createTieActionMock.mockResolvedValueOnce({ error: "Команду не знайдено — можливо, її вже видалили" });
    const user = userEvent.setup();
    render(<CreateTieDialog tournamentId="t1" teams={teams} />);

    await user.click(screen.getByRole("button", { name: "Створити зустріч" }));
    await user.click(screen.getByRole("combobox", { name: "Обрати команду А" }));
    await user.click(await screen.findByRole("option", { name: "Команда А" }));
    await user.click(screen.getByRole("combobox", { name: "Обрати команду Б" }));
    await user.click(await screen.findByRole("option", { name: "Команда Б" }));
    await user.click(screen.getByRole("button", { name: "Створити" }));

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("Команду не знайдено — можливо, її вже видалили"),
    );
  });
});
