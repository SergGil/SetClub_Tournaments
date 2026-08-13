// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PadelTournamentRoster } from "@/components/admin/padel-tournament-roster";
import type { withdrawPadelParticipantAction } from "@/lib/actions/padel-tournaments";

const {
  addPadelParticipantActionMock,
  removePadelParticipantActionMock,
  setPadelParticipantGroupActionMock,
  togglePadelParticipantSeedActionMock,
  withdrawPadelParticipantActionMock,
} = vi.hoisted(() => ({
  addPadelParticipantActionMock: vi.fn(async () => ({})),
  removePadelParticipantActionMock: vi.fn(async () => ({})),
  setPadelParticipantGroupActionMock: vi.fn(async () => ({})),
  togglePadelParticipantSeedActionMock: vi.fn(async () => undefined),
  withdrawPadelParticipantActionMock: vi
    .fn<typeof withdrawPadelParticipantAction>()
    .mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/actions/padel-tournaments", () => ({
  addPadelParticipantAction: addPadelParticipantActionMock,
  removePadelParticipantAction: removePadelParticipantActionMock,
  setPadelParticipantGroupAction: setPadelParticipantGroupActionMock,
  togglePadelParticipantSeedAction: togglePadelParticipantSeedActionMock,
  withdrawPadelParticipantAction: withdrawPadelParticipantActionMock,
}));

const { toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: toastSuccessMock } }));

beforeEach(() => {
  vi.clearAllMocks();
});

const availablePlayers = [
  { id: "p1", name: "Іван", nickname: null },
  { id: "p2", name: "Петро", nickname: null },
  { id: "p3", name: "Олег", nickname: null },
];

describe("PadelTournamentRoster (adding participants)", () => {
  it("shows an empty-state message with no participants", () => {
    render(
      <PadelTournamentRoster
        tournamentId="t1"
        format="SINGLES"
        participants={[]}
        availablePlayers={availablePlayers}
      />,
    );
    expect(screen.getByText("Ще немає жодного учасника.")).toBeInTheDocument();
  });

  it("excludes players already on the roster from the picker", async () => {
    const user = userEvent.setup();
    render(
      <PadelTournamentRoster
        tournamentId="t1"
        format="SINGLES"
        participants={[
          {
            playerId: "p1",
            seed: null,
            group: null,
            withdrawnAt: null,
            player: { id: "p1", name: "Іван", nickname: null },
          },
        ]}
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
      <PadelTournamentRoster
        tournamentId="t1"
        format="SINGLES"
        participants={[]}
        availablePlayers={availablePlayers}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Обрати гравців" }));
    await user.type(await screen.findByPlaceholderText("Пошук…"), "Пет");
    expect(screen.getByRole("option", { name: "Петро" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Іван" })).not.toBeInTheDocument();
  });

  it(
    "adds every picked player and clears the selection on success",
    { timeout: 10000 },
    async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <PadelTournamentRoster
          tournamentId="t1"
          format="SINGLES"
          participants={[]}
          availablePlayers={availablePlayers}
        />,
      );
      await user.click(screen.getByRole("combobox", { name: "Обрати гравців" }));
      await user.click(await screen.findByRole("option", { name: "Іван" }));
      await user.click(screen.getByRole("option", { name: "Петро" }));
      await user.keyboard("{Escape}");

      await user.click(screen.getByRole("button", { name: "Додати всіх (2)" }));

      await waitFor(
        () => {
          expect(addPadelParticipantActionMock).toHaveBeenCalledWith("t1", ["p1", "p2"]);
          expect(screen.getByText("Іван")).toBeInTheDocument();
          expect(screen.getByText("Петро")).toBeInTheDocument();
        },
        { timeout: 8000 },
      );
      expect(screen.queryByRole("button", { name: "Прибрати з вибору" })).not.toBeInTheDocument();
    },
  );

  it("shows the error and keeps the selection when the add fails", async () => {
    addPadelParticipantActionMock.mockResolvedValueOnce({ error: "Оберіть хоча б одного гравця" });
    const user = userEvent.setup();
    render(
      <PadelTournamentRoster
        tournamentId="t1"
        format="SINGLES"
        participants={[]}
        availablePlayers={availablePlayers}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Обрати гравців" }));
    await user.click(await screen.findByRole("option", { name: "Іван" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Додати" }));

    expect(await screen.findByText("Оберіть хоча б одного гравця")).toBeInTheDocument();
    expect(screen.getAllByText("Іван").length).toBeGreaterThan(0);
  });
});

describe("PadelTournamentRoster (per-participant controls)", () => {
  const oneParticipant = [
    {
      playerId: "p1",
      seed: null,
      group: null,
      withdrawnAt: null,
      player: { id: "p1", name: "Іван", nickname: null },
    },
  ];

  it("shows the group picker for SINGLES and DOUBLES, but not MIXED", () => {
    const { rerender } = render(
      <PadelTournamentRoster tournamentId="t1" format="SINGLES" participants={oneParticipant} availablePlayers={[]} />,
    );
    expect(screen.getByRole("combobox", { name: "Група" })).toBeInTheDocument();

    rerender(
      <PadelTournamentRoster tournamentId="t1" format="DOUBLES" participants={oneParticipant} availablePlayers={[]} />,
    );
    expect(screen.getByRole("combobox", { name: "Група" })).toBeInTheDocument();

    rerender(
      <PadelTournamentRoster tournamentId="t1" format="MIXED" participants={oneParticipant} availablePlayers={[]} />,
    );
    expect(screen.queryByRole("combobox", { name: "Група" })).not.toBeInTheDocument();
  });

  it("checks the seed checkbox and persists it on success", async () => {
    const user = userEvent.setup();
    render(
      <PadelTournamentRoster tournamentId="t1" format="SINGLES" participants={oneParticipant} availablePlayers={[]} />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Сіяний" });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);

    expect(togglePadelParticipantSeedActionMock).toHaveBeenCalledWith("t1", "p1", true);
    await waitFor(() => expect(checkbox).toBeChecked());
  });

  it("reverts the seed checkbox and shows a toast when the save fails", async () => {
    togglePadelParticipantSeedActionMock.mockRejectedValueOnce(new Error("network"));
    const user = userEvent.setup();
    render(
      <PadelTournamentRoster tournamentId="t1" format="SINGLES" participants={oneParticipant} availablePlayers={[]} />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Сіяний" });
    await user.click(checkbox);

    await waitFor(() => expect(checkbox).not.toBeChecked());
    expect(toastErrorMock).toHaveBeenCalledWith("Не вдалося змінити позначку сіяного гравця");
  });

  it("changes the group and reports an error without discarding the failed pick silently", async () => {
    setPadelParticipantGroupActionMock.mockResolvedValueOnce({ error: "Некоректний номер групи" });
    const user = userEvent.setup();
    render(
      <PadelTournamentRoster tournamentId="t1" format="SINGLES" participants={oneParticipant} availablePlayers={[]} />,
    );

    await user.click(screen.getByRole("combobox", { name: "Група" }));
    await user.click(await screen.findByRole("option", { name: "Група B" }));

    expect(setPadelParticipantGroupActionMock).toHaveBeenCalledWith("t1", "p1", 2);
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Некоректний номер групи"));
  });

  it("removes a participant after confirming in the alert dialog", async () => {
    const user = userEvent.setup();
    render(
      <PadelTournamentRoster tournamentId="t1" format="SINGLES" participants={oneParticipant} availablePlayers={[]} />,
    );

    await user.click(screen.getByRole("button", { name: "Прибрати" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Прибрати" }));

    await waitFor(() => expect(removePadelParticipantActionMock).toHaveBeenCalledWith("t1", "p1"));
  });

  it("shows the withdraw button for SINGLES and MIXED but not DOUBLES", () => {
    const { rerender } = render(
      <PadelTournamentRoster tournamentId="t1" format="SINGLES" participants={oneParticipant} availablePlayers={[]} />,
    );
    expect(screen.getByRole("button", { name: "Зняти з турніру" })).toBeInTheDocument();

    rerender(
      <PadelTournamentRoster tournamentId="t1" format="MIXED" participants={oneParticipant} availablePlayers={[]} />,
    );
    expect(screen.getByRole("button", { name: "Зняти з турніру" })).toBeInTheDocument();

    rerender(
      <PadelTournamentRoster tournamentId="t1" format="DOUBLES" participants={oneParticipant} availablePlayers={[]} />,
    );
    expect(screen.queryByRole("button", { name: "Зняти з турніру" })).not.toBeInTheDocument();
  });

  it("withdraws a participant after confirming, closing the dialog and toasting on success", async () => {
    const user = userEvent.setup();
    render(
      <PadelTournamentRoster tournamentId="t1" format="SINGLES" participants={oneParticipant} availablePlayers={[]} />,
    );

    await user.click(screen.getByRole("button", { name: "Зняти з турніру" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Зняти з турніру" }));

    await waitFor(() => expect(withdrawPadelParticipantActionMock).toHaveBeenCalled());
    const [, formData] = withdrawPadelParticipantActionMock.mock.calls[0];
    expect(formData.get("tournamentId")).toBe("t1");
    expect(formData.get("playerId")).toBe("p1");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(toastSuccessMock).toHaveBeenCalledWith("Гравця знято з турніру");
  });

  it("shows a cascade-reset confirmation step when withdrawing would reset downstream matches", async () => {
    withdrawPadelParticipantActionMock.mockResolvedValueOnce({
      error: "Зняття скине рахунок матчів нижче по сітці — підтвердьте скид, щоб продовжити.",
      cascadeResets: [{ matchId: "m2", round: "Фінал", sideALabel: "Іван", sideBLabel: "Петро" }],
    });
    const user = userEvent.setup();
    render(
      <PadelTournamentRoster tournamentId="t1" format="SINGLES" participants={oneParticipant} availablePlayers={[]} />,
    );

    await user.click(screen.getByRole("button", { name: "Зняти з турніру" }));
    const dialog = await screen.findByRole("alertdialog");
    const submit = within(dialog).getByRole("button", { name: "Зняти з турніру" });
    await user.click(submit);

    await screen.findByText("Це зніме рахунок наступних матчів:");
    expect(within(dialog).getByText(/Фінал: Іван – Петро/)).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/Введіть/), "СКИНУТИ");
    expect(submit).toBeEnabled();
  });

  it("shows a «Знявся» badge and hides group/seed/withdraw controls for an already-withdrawn participant", () => {
    const withdrawn = [
      {
        playerId: "p1",
        seed: null,
        group: null,
        withdrawnAt: new Date("2026-01-01"),
        player: { id: "p1", name: "Іван", nickname: null },
      },
    ];
    render(
      <PadelTournamentRoster tournamentId="t1" format="SINGLES" participants={withdrawn} availablePlayers={[]} />,
    );

    expect(screen.getByText("Знявся")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Група" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Сіяний" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Зняти з турніру" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Прибрати" })).toBeInTheDocument();
  });
});
