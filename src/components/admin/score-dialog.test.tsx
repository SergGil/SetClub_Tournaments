// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ScoreDialog } from "@/components/admin/score-dialog";

vi.mock("@/lib/actions/matches", () => ({
  saveScoreAction: vi.fn(async () => ({ success: true })),
}));

describe("ScoreDialog", () => {
  it("labels each set's score inputs for screen readers and lets you add/remove sets", async () => {
    const user = userEvent.setup();
    render(
      <ScoreDialog
        matchId="match-1"
        tournamentId="tournament-1"
        sideALabel="Іван"
        sideBLabel="Петро"
        initialSets={[]}
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
      <ScoreDialog
        matchId="match-1"
        tournamentId="tournament-1"
        sideALabel="Іван"
        sideBLabel="Петро"
        initialSets={[{ sideAGames: 6, sideBGames: 4, tiebreakLoserPoints: null }]}
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
      <ScoreDialog
        matchId="match-1"
        tournamentId="tournament-1"
        sideALabel="Іван"
        sideBLabel="Петро"
        initialSets={[]}
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

    // Unchecking clears the pick so a stale winner can't be submitted silently.
    await user.click(
      screen.getByRole("checkbox", { name: /Матч завершено зняттям гравця/ }),
    );
    expect(screen.queryByRole("button", { name: "Петро" })).not.toBeInTheDocument();
    expect(winnerInput()).toHaveValue("");
  });
});
