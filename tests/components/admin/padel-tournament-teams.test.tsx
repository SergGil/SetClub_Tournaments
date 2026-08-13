// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PadelTournamentTeams } from "@/components/admin/padel-tournament-teams";

const { createPadelTeamActionMock, updatePadelTeamActionMock, deletePadelTeamActionMock } = vi.hoisted(() => ({
  createPadelTeamActionMock: vi.fn(async () => ({})),
  updatePadelTeamActionMock: vi.fn(async () => ({})),
  deletePadelTeamActionMock: vi.fn(async () => ({})),
}));
vi.mock("@/lib/actions/padel-teams", () => ({
  createPadelTeamAction: createPadelTeamActionMock,
  updatePadelTeamAction: updatePadelTeamActionMock,
  deletePadelTeamAction: deletePadelTeamActionMock,
}));

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock } }));

beforeEach(() => {
  vi.clearAllMocks();
});

const participants = [
  { id: "p1", name: "Іван", nickname: null },
  { id: "p2", name: "Петро", nickname: null },
  { id: "p3", name: "Олег", nickname: null },
  { id: "p4", name: "Марія", nickname: null },
  { id: "p5", name: "Дмитро", nickname: null },
];

describe("PadelTournamentTeams (create)", () => {
  it("shows the empty state with no teams yet", () => {
    render(<PadelTournamentTeams tournamentId="t1" teams={[]} participants={participants} />);
    expect(screen.getByText("Команд ще не створено.")).toBeInTheDocument();
  });

  it("disables the submit button until a name and 2-4 members are picked", async () => {
    const user = userEvent.setup();
    render(<PadelTournamentTeams tournamentId="t1" teams={[]} participants={participants} />);

    await user.click(screen.getByRole("button", { name: "Створити команду" }));
    expect(screen.getByRole("button", { name: "Створити" })).toBeDisabled();

    await user.type(screen.getByLabelText("Назва команди"), "Команда 1");
    expect(screen.getByRole("button", { name: "Створити" })).toBeDisabled();

    await user.click(screen.getByRole("combobox", { name: "Обрати гравців команди" }));
    await user.click(await screen.findByRole("option", { name: "Іван" }));
    expect(screen.getByRole("button", { name: "Створити" })).toBeDisabled();

    await user.click(screen.getByRole("option", { name: "Петро" }));
    expect(screen.getByRole("button", { name: "Створити" })).not.toBeDisabled();
  });

  it("blocks picking a 5th member", async () => {
    const user = userEvent.setup();
    render(<PadelTournamentTeams tournamentId="t1" teams={[]} participants={participants} />);

    await user.click(screen.getByRole("button", { name: "Створити команду" }));
    await user.click(screen.getByRole("combobox", { name: "Обрати гравців команди" }));
    for (const name of ["Іван", "Петро", "Олег", "Марія"]) {
      await user.click(await screen.findByRole("option", { name }));
    }

    expect(screen.getByRole("option", { name: "Дмитро" })).toHaveAttribute("aria-disabled", "true");
  });

  it("creates the team with the picked players and closes on success", async () => {
    const user = userEvent.setup();
    render(<PadelTournamentTeams tournamentId="t1" teams={[]} participants={participants} />);

    await user.click(screen.getByRole("button", { name: "Створити команду" }));
    await user.type(screen.getByLabelText("Назва команди"), "Команда 1");
    await user.click(screen.getByRole("combobox", { name: "Обрати гравців команди" }));
    await user.click(await screen.findByRole("option", { name: "Іван" }));
    await user.click(screen.getByRole("option", { name: "Петро" }));
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Створити" }));

    await waitFor(() =>
      expect(createPadelTeamActionMock).toHaveBeenCalledWith("t1", "Команда 1", ["p1", "p2"]),
    );
    await waitFor(() => expect(screen.queryByLabelText("Назва команди")).not.toBeInTheDocument());
  });

  it("shows a toast and keeps the dialog open when creation fails", async () => {
    createPadelTeamActionMock.mockResolvedValueOnce({ error: "Гравець уже в іншій команді цього турніру" });
    const user = userEvent.setup();
    render(<PadelTournamentTeams tournamentId="t1" teams={[]} participants={participants} />);

    await user.click(screen.getByRole("button", { name: "Створити команду" }));
    await user.type(screen.getByLabelText("Назва команди"), "Команда 1");
    await user.click(screen.getByRole("combobox", { name: "Обрати гравців команди" }));
    await user.click(await screen.findByRole("option", { name: "Іван" }));
    await user.click(screen.getByRole("option", { name: "Петро" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Створити" }));

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("Гравець уже в іншій команді цього турніру"),
    );
    expect(screen.getByLabelText("Назва команди")).toBeInTheDocument();
  });
});

describe("PadelTournamentTeams (existing teams)", () => {
  const teams = [
    {
      id: "team1",
      name: "Команда 1",
      members: [
        { id: "p1", name: "Іван", nickname: null },
        { id: "p2", name: "Петро", nickname: null },
      ],
    },
  ];

  it("lists the team's name and members", () => {
    render(<PadelTournamentTeams tournamentId="t1" teams={teams} participants={participants} />);
    expect(screen.getByText("Команда 1")).toBeInTheDocument();
    expect(screen.getByText("Іван")).toBeInTheDocument();
    expect(screen.getByText("Петро")).toBeInTheDocument();
  });

  it("saves an edited member list", async () => {
    const user = userEvent.setup();
    render(<PadelTournamentTeams tournamentId="t1" teams={teams} participants={participants} />);

    await user.click(screen.getByRole("button", { name: "Редагувати команду «Команда 1»" }));
    await user.click(screen.getByRole("combobox", { name: "Обрати гравців команди" }));
    await user.click(await screen.findByRole("option", { name: "Олег" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() =>
      expect(updatePadelTeamActionMock).toHaveBeenCalledWith("t1", "team1", "Команда 1", ["p1", "p2", "p3"]),
    );
  });

  it("deletes the team after confirming", async () => {
    const user = userEvent.setup();
    render(<PadelTournamentTeams tournamentId="t1" teams={teams} participants={participants} />);

    await user.click(screen.getByRole("button", { name: "Видалити команду «Команда 1»" }));
    await user.click(screen.getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(deletePadelTeamActionMock).toHaveBeenCalledWith("t1", "team1"));
  });
});
