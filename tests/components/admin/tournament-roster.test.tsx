// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TournamentRoster } from "@/components/admin/tournament-roster";

const {
  addParticipantActionMock,
  removeParticipantActionMock,
  setParticipantGroupActionMock,
  toggleParticipantSeedActionMock,
} = vi.hoisted(() => ({
  addParticipantActionMock: vi.fn(async () => ({})),
  removeParticipantActionMock: vi.fn(async () => ({})),
  setParticipantGroupActionMock: vi.fn(async () => ({})),
  toggleParticipantSeedActionMock: vi.fn(async () => undefined),
}));
vi.mock("@/lib/actions/tournaments", () => ({
  addParticipantAction: addParticipantActionMock,
  removeParticipantAction: removeParticipantActionMock,
  setParticipantGroupAction: setParticipantGroupActionMock,
  toggleParticipantSeedAction: toggleParticipantSeedActionMock,
}));

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock } }));

beforeEach(() => {
  vi.clearAllMocks();
});

const availablePlayers = [
  { id: "p1", name: "Іван" },
  { id: "p2", name: "Петро" },
  { id: "p3", name: "Олег" },
];

describe("TournamentRoster (adding participants)", () => {
  it("shows an empty-state message with no participants", () => {
    render(
      <TournamentRoster tournamentId="t1" format="SINGLES" participants={[]} availablePlayers={availablePlayers} />,
    );
    expect(screen.getByText("Ще немає жодного учасника.")).toBeInTheDocument();
  });

  it("excludes players already on the roster from the picker", async () => {
    const user = userEvent.setup();
    render(
      <TournamentRoster
        tournamentId="t1"
        format="SINGLES"
        participants={[{ playerId: "p1", seed: null, group: null, player: { id: "p1", name: "Іван" } }]}
        availablePlayers={availablePlayers}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Обрати гравців" }));
    expect(await screen.findByRole("option", { name: "Петро" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Іван" })).not.toBeInTheDocument();
  });

  it("filters the picker by the search box", async () => {
    const user = userEvent.setup();
    render(
      <TournamentRoster tournamentId="t1" format="SINGLES" participants={[]} availablePlayers={availablePlayers} />,
    );
    await user.click(screen.getByRole("combobox", { name: "Обрати гравців" }));
    await user.type(screen.getByPlaceholderText("Пошук…"), "Пет");
    expect(screen.getByRole("option", { name: "Петро" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Іван" })).not.toBeInTheDocument();
  });

  it("adds every picked player and clears the selection on success", async () => {
    const user = userEvent.setup();
    render(
      <TournamentRoster tournamentId="t1" format="SINGLES" participants={[]} availablePlayers={availablePlayers} />,
    );
    await user.click(screen.getByRole("combobox", { name: "Обрати гравців" }));
    await user.click(await screen.findByRole("option", { name: "Іван" }));
    await user.click(screen.getByRole("option", { name: "Петро" }));
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Додати всіх (2)" }));

    await waitFor(() => expect(addParticipantActionMock).toHaveBeenCalledWith("t1", ["p1", "p2"]));
    expect(await screen.findByText("Іван")).toBeInTheDocument();
    expect(screen.getByText("Петро")).toBeInTheDocument();
    // Selection badges above the roster list are gone once it succeeds.
    expect(screen.queryByRole("button", { name: "Прибрати з вибору" })).not.toBeInTheDocument();
  });

  it("shows the error and keeps the selection when the add fails", async () => {
    addParticipantActionMock.mockResolvedValueOnce({ error: "Оберіть хоча б одного гравця" });
    const user = userEvent.setup();
    render(
      <TournamentRoster tournamentId="t1" format="SINGLES" participants={[]} availablePlayers={availablePlayers} />,
    );
    await user.click(screen.getByRole("combobox", { name: "Обрати гравців" }));
    await user.click(await screen.findByRole("option", { name: "Іван" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Додати" }));

    expect(await screen.findByText("Оберіть хоча б одного гравця")).toBeInTheDocument();
    // Selection is preserved so the admin doesn't have to re-pick after a failed attempt.
    expect(screen.getAllByText("Іван").length).toBeGreaterThan(0);
  });
});

describe("TournamentRoster (per-participant controls)", () => {
  const oneParticipant = [
    { playerId: "p1", seed: null, group: null, player: { id: "p1", name: "Іван" } },
  ];

  it("shows the group picker for SINGLES and DOUBLES, but not MIXED", () => {
    const { rerender } = render(
      <TournamentRoster tournamentId="t1" format="SINGLES" participants={oneParticipant} availablePlayers={[]} />,
    );
    expect(screen.getByRole("combobox", { name: "Група" })).toBeInTheDocument();

    rerender(
      <TournamentRoster tournamentId="t1" format="DOUBLES" participants={oneParticipant} availablePlayers={[]} />,
    );
    expect(screen.getByRole("combobox", { name: "Група" })).toBeInTheDocument();

    rerender(
      <TournamentRoster tournamentId="t1" format="MIXED" participants={oneParticipant} availablePlayers={[]} />,
    );
    expect(screen.queryByRole("combobox", { name: "Група" })).not.toBeInTheDocument();
  });

  it("checks the seed checkbox and persists it on success", async () => {
    const user = userEvent.setup();
    render(
      <TournamentRoster tournamentId="t1" format="SINGLES" participants={oneParticipant} availablePlayers={[]} />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Сіяний" });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);

    expect(toggleParticipantSeedActionMock).toHaveBeenCalledWith("t1", "p1", true);
    await waitFor(() => expect(checkbox).toBeChecked());
  });

  it("reverts the seed checkbox and shows a toast when the save fails", async () => {
    toggleParticipantSeedActionMock.mockRejectedValueOnce(new Error("network"));
    const user = userEvent.setup();
    render(
      <TournamentRoster tournamentId="t1" format="SINGLES" participants={oneParticipant} availablePlayers={[]} />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Сіяний" });
    await user.click(checkbox);

    await waitFor(() => expect(checkbox).not.toBeChecked());
    expect(toastErrorMock).toHaveBeenCalledWith("Не вдалося змінити позначку сіяного гравця");
  });

  it("changes the group and reports an error without discarding the failed pick silently", async () => {
    setParticipantGroupActionMock.mockResolvedValueOnce({ error: "Некоректний номер групи" });
    const user = userEvent.setup();
    render(
      <TournamentRoster tournamentId="t1" format="SINGLES" participants={oneParticipant} availablePlayers={[]} />,
    );

    await user.click(screen.getByRole("combobox", { name: "Група" }));
    await user.click(await screen.findByRole("option", { name: "Група 2" }));

    expect(setParticipantGroupActionMock).toHaveBeenCalledWith("t1", "p1", 2);
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Некоректний номер групи"));
  });

  it("removes a participant after confirming in the alert dialog", async () => {
    const user = userEvent.setup();
    render(
      <TournamentRoster tournamentId="t1" format="SINGLES" participants={oneParticipant} availablePlayers={[]} />,
    );

    await user.click(screen.getByRole("button", { name: "Прибрати" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Прибрати" }));

    await waitFor(() => expect(removeParticipantActionMock).toHaveBeenCalledWith("t1", "p1"));
  });
});
