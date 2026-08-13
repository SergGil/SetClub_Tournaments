// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreatePadelTieDialog } from "@/components/admin/create-padel-tie-dialog";

const { createPadelTieActionMock } = vi.hoisted(() => ({ createPadelTieActionMock: vi.fn(async () => ({})) }));
vi.mock("@/lib/actions/padel-ties", () => ({ createPadelTieAction: createPadelTieActionMock }));

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock } }));

beforeEach(() => {
  vi.clearAllMocks();
});

const teams = [
  { id: "teamA", name: "Команда А" },
  { id: "teamB", name: "Команда Б" },
];

describe("CreatePadelTieDialog", () => {
  it("disables the trigger with fewer than 2 teams", () => {
    render(<CreatePadelTieDialog tournamentId="t1" teams={[teams[0]]} />);
    expect(screen.getByRole("button", { name: "Створити зустріч" })).toBeDisabled();
  });

  it("keeps the same team from appearing on both sides", async () => {
    const user = userEvent.setup();
    render(<CreatePadelTieDialog tournamentId="t1" teams={teams} />);

    await user.click(screen.getByRole("button", { name: "Створити зустріч" }));
    await user.click(screen.getByRole("combobox", { name: "Обрати команду А" }));
    await user.click(await screen.findByRole("option", { name: "Команда А" }));

    await user.click(screen.getByRole("combobox", { name: "Обрати команду Б" }));
    expect(screen.queryByRole("option", { name: "Команда А" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Команда Б" })).toBeInTheDocument();
  });

  it("creates the tie with an optional label and closes on success", async () => {
    const user = userEvent.setup();
    render(<CreatePadelTieDialog tournamentId="t1" teams={teams} />);

    await user.click(screen.getByRole("button", { name: "Створити зустріч" }));
    await user.click(screen.getByRole("combobox", { name: "Обрати команду А" }));
    await user.click(await screen.findByRole("option", { name: "Команда А" }));
    await user.click(screen.getByRole("combobox", { name: "Обрати команду Б" }));
    await user.click(await screen.findByRole("option", { name: "Команда Б" }));
    await user.type(screen.getByLabelText("Мітка (опційно)"), "Тур 1");

    await user.click(screen.getByRole("button", { name: "Створити" }));

    await waitFor(() =>
      expect(createPadelTieActionMock).toHaveBeenCalledWith("t1", "teamA", "teamB", "Тур 1"),
    );
    await waitFor(() => expect(screen.queryByLabelText("Мітка (опційно)")).not.toBeInTheDocument());
  });

  it("shows a toast when creation fails", async () => {
    createPadelTieActionMock.mockResolvedValueOnce({ error: "Команду не знайдено — можливо, її вже видалили" });
    const user = userEvent.setup();
    render(<CreatePadelTieDialog tournamentId="t1" teams={teams} />);

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
