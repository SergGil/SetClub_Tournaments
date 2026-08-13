// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PadelScoreDialog } from "@/components/admin/padel-score-dialog";

const { savePadelScoreActionMock } = vi.hoisted(() => ({ savePadelScoreActionMock: vi.fn() }));
vi.mock("@/lib/actions/padel-matches", () => ({ savePadelScoreAction: savePadelScoreActionMock }));

beforeEach(() => {
  savePadelScoreActionMock.mockReset();
  savePadelScoreActionMock.mockResolvedValue({ success: true });
});

describe("PadelScoreDialog", () => {
  it("labels each set's score inputs for screen readers and lets you add/remove sets", async () => {
    const user = userEvent.setup();
    render(
      <PadelScoreDialog
        matchId="match-1"
        tournamentId="tournament-1"
        sideALabel="Іван"
        sideBLabel="Петро"
        initialSets={[]}
        initialUpdatedAt={new Date("2026-01-01T00:00:00.000Z")}
        trigger={<button>Рахунок</button>}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Рахунок" }));

    expect(screen.getByLabelText("Сет 1, Іван")).toBeInTheDocument();
    expect(screen.getByLabelText("Сет 1, Петро")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Прибрати сет 1" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Додати сет" }));

    expect(screen.getByLabelText("Сет 2, Іван")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Прибрати сет 1" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Прибрати сет 2" }));
    expect(screen.queryByLabelText("Сет 2, Іван")).not.toBeInTheDocument();
  });

  it("closes once the score is saved successfully", async () => {
    const user = userEvent.setup();
    render(
      <PadelScoreDialog
        matchId="match-1"
        tournamentId="tournament-1"
        sideALabel="Іван"
        sideBLabel="Петро"
        initialSets={[
          { sideAGames: 6, sideBGames: 4, tiebreakSideAPoints: null, tiebreakSideBPoints: null },
        ]}
        initialUpdatedAt={new Date("2026-01-01T00:00:00.000Z")}
        trigger={<button>Рахунок</button>}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Рахунок" }));
    expect(screen.getByLabelText("Сет 1, Іван")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Зберегти рахунок" }));

    await waitFor(() => {
      expect(screen.queryByLabelText("Сет 1, Іван")).not.toBeInTheDocument();
    });
  });

  it("shows a winner picker once retired is checked and records the choice", async () => {
    const user = userEvent.setup();
    render(
      <PadelScoreDialog
        matchId="match-1"
        tournamentId="tournament-1"
        sideALabel="Іван"
        sideBLabel="Петро"
        initialSets={[]}
        initialUpdatedAt={new Date("2026-01-01T00:00:00.000Z")}
        trigger={<button>Рахунок</button>}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Рахунок" }));

    expect(screen.queryByRole("button", { name: "Іван" })).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", { name: /Матч завершено зняттям гравця/ }),
    );

    const winnerInput = () => document.querySelector('input[name="retiredWinnerSide"]');
    expect(winnerInput()).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Петро" }));
    expect(winnerInput()).toHaveValue("B");

    await user.click(
      screen.getByRole("checkbox", { name: /Матч завершено зняттям гравця/ }),
    );
    expect(screen.queryByRole("button", { name: "Петро" })).not.toBeInTheDocument();
    expect(winnerInput()).toHaveValue("");
  });

  it("shows both sides' tiebreak inputs only once the set score is 7-6", async () => {
    const user = userEvent.setup();
    render(
      <PadelScoreDialog
        matchId="match-1"
        tournamentId="tournament-1"
        sideALabel="Іван"
        sideBLabel="Петро"
        initialSets={[]}
        initialUpdatedAt={new Date("2026-01-01T00:00:00.000Z")}
        trigger={<button>Рахунок</button>}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Рахунок" }));

    expect(screen.queryByLabelText("Тайбрейк сету 1, Іван")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Сет 1, Іван"), "7");
    await user.type(screen.getByLabelText("Сет 1, Петро"), "6");

    expect(screen.getByLabelText("Тайбрейк сету 1, Іван")).toBeInTheDocument();
    expect(screen.getByLabelText("Тайбрейк сету 1, Петро")).toBeInTheDocument();
  });

  it("shows a cascade-reset warning and blocks submit until the confirm phrase is typed", async () => {
    savePadelScoreActionMock.mockResolvedValueOnce({
      error: "Цей результат скине рахунок матчів нижче по сітці — підтвердьте скид, щоб продовжити.",
      cascadeResets: [{ matchId: "d1", round: "1/2", sideALabel: "Іван", sideBLabel: "Петро" }],
    });
    const user = userEvent.setup();
    render(
      <PadelScoreDialog
        matchId="match-1"
        tournamentId="tournament-1"
        sideALabel="Х"
        sideBLabel="Y"
        initialSets={[
          { sideAGames: 6, sideBGames: 4, tiebreakSideAPoints: null, tiebreakSideBPoints: null },
        ]}
        initialUpdatedAt={new Date("2026-01-01T00:00:00.000Z")}
        trigger={<button>Рахунок</button>}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Рахунок" }));
    await user.click(screen.getByRole("button", { name: "Зберегти рахунок" }));

    await screen.findByText(/1\/2: Іван – Петро/);
    const submitButton = screen.getByRole("button", { name: "Зберегти рахунок" });
    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText(/Введіть/), "СКИНУТИ");
    expect(submitButton).toBeEnabled();
  });

  it("resubmits with acknowledgedCascadeReset once the confirm phrase matches", async () => {
    savePadelScoreActionMock.mockResolvedValueOnce({
      error: "...",
      cascadeResets: [{ matchId: "d1", round: "1/2", sideALabel: "Іван", sideBLabel: "Петро" }],
    });
    savePadelScoreActionMock.mockResolvedValueOnce({ success: true });
    const user = userEvent.setup();
    render(
      <PadelScoreDialog
        matchId="match-1"
        tournamentId="tournament-1"
        sideALabel="Х"
        sideBLabel="Y"
        initialSets={[
          { sideAGames: 6, sideBGames: 4, tiebreakSideAPoints: null, tiebreakSideBPoints: null },
        ]}
        initialUpdatedAt={new Date("2026-01-01T00:00:00.000Z")}
        trigger={<button>Рахунок</button>}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Рахунок" }));
    await user.click(screen.getByRole("button", { name: "Зберегти рахунок" }));
    await screen.findByText(/1\/2: Іван – Петро/);

    await user.type(screen.getByLabelText(/Введіть/), "СКИНУТИ");
    await user.click(screen.getByRole("button", { name: "Зберегти рахунок" }));

    await waitFor(() => expect(savePadelScoreActionMock).toHaveBeenCalledTimes(2));
    const secondCallFormData = savePadelScoreActionMock.mock.calls[1][1] as FormData;
    expect(secondCallFormData.get("acknowledgedCascadeReset")).toBe("true");
  });
});
