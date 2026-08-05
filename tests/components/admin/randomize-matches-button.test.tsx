// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RandomizeMatchesButton } from "@/components/admin/randomize-matches-button";

const { drawDoublesTeamsActionMock, commitDoublesMatchesActionMock } = vi.hoisted(() => ({
  drawDoublesTeamsActionMock: vi.fn(),
  commitDoublesMatchesActionMock: vi.fn(),
}));
vi.mock("@/lib/actions/matches", () => ({
  drawDoublesTeamsAction: drawDoublesTeamsActionMock,
  commitDoublesMatchesAction: commitDoublesMatchesActionMock,
}));

const { toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: toastSuccessMock } }));

const roster = [
  { id: "p1", name: "Іван" },
  { id: "p2", name: "Петро" },
  { id: "p3", name: "Олег" },
  { id: "p4", name: "Данило" },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RandomizeMatchesButton (gating)", () => {
  it("disables the trigger when nobody is seeded yet", () => {
    render(
      <RandomizeMatchesButton
        tournamentId="t1"
        roster={roster}
        hasSeededPlayer={false}
        hasMatches={false}
        completedMatchCount={0}
      />,
    );
    expect(screen.getByRole("button", { name: /Рандомайзер/ })).toBeDisabled();
  });

  it("labels the trigger 'Рерандомайзер' once matches already exist", () => {
    render(
      <RandomizeMatchesButton
        tournamentId="t1"
        roster={roster}
        hasSeededPlayer={true}
        hasMatches={true}
        completedMatchCount={0}
      />,
    );
    expect(screen.getByRole("button", { name: "Рерандомайзер" })).toBeInTheDocument();
  });

  it("requires typing the confirm word before starting once completed matches would be lost", async () => {
    const user = userEvent.setup();
    render(
      <RandomizeMatchesButton
        tournamentId="t1"
        roster={roster}
        hasSeededPlayer={true}
        hasMatches={true}
        completedMatchCount={3}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Рерандомайзер" }));
    const startButton = screen.getByRole("button", { name: "Почати жеребкування" });
    expect(startButton).toBeDisabled();

    await user.type(screen.getByRole("textbox"), "видалити");
    expect(startButton).toBeEnabled();
  });

  it("blocks starting while a fixed pair only has one slot filled", async () => {
    const user = userEvent.setup();
    render(
      <RandomizeMatchesButton
        tournamentId="t1"
        roster={roster}
        hasSeededPlayer={true}
        hasMatches={false}
        completedMatchCount={0}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Рандомайзер" }));
    await user.click(screen.getByRole("button", { name: "Додати пару" }));
    await user.click(screen.getByRole("combobox", { name: "Гравець 1" }));
    await user.click(await screen.findByRole("option", { name: "Іван" }));

    expect(screen.getByRole("button", { name: "Почати жеребкування" })).toBeDisabled();
  });
});

describe("RandomizeMatchesButton (draw -> reveal -> commit flow)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reveals drawn teams one by one, then commits and reports the created match count", async () => {
    drawDoublesTeamsActionMock.mockResolvedValueOnce({
      ok: true,
      fixedTeams: [],
      seededBasket: [{ playerId: "p1", name: "Іван" }, { playerId: "p3", name: "Олег" }],
      unseededBasket: [{ playerId: "p2", name: "Петро" }, { playerId: "p4", name: "Данило" }],
      randomTeams: [
        { playerIds: ["p1", "p2"], names: ["Іван", "Петро"] },
        { playerIds: ["p3", "p4"], names: ["Олег", "Данило"] },
      ],
      matchups: [
        {
          sideA: { playerIds: ["p1", "p2"], names: ["Іван", "Петро"] },
          sideB: { playerIds: ["p3", "p4"], names: ["Олег", "Данило"] },
        },
      ],
      unpairedNames: [],
    });
    commitDoublesMatchesActionMock.mockResolvedValueOnce({ success: true, matchCount: 1 });

    render(
      <RandomizeMatchesButton
        tournamentId="t1"
        roster={roster}
        hasSeededPlayer={true}
        hasMatches={false}
        completedMatchCount={0}
      />,
    );

    await act(async () => {
      (await screen.findByRole("button", { name: "Рандомайзер" })).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "Почати жеребкування" }).click();
    });

    expect(drawDoublesTeamsActionMock).toHaveBeenCalledWith("t1", []);
    expect(await screen.findByText("Пар сформовано: 0 / 2")).toBeInTheDocument();

    // Reveal both random teams (3500ms apart), then wait out the pause before committing.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });
    expect(screen.getByText("Пар сформовано: 1 / 2")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });
    expect(screen.getByText("Пар сформовано: 2 / 2")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(commitDoublesMatchesActionMock).toHaveBeenCalledWith(
      "t1",
      [{ sideAIds: ["p1", "p2"], sideBIds: ["p3", "p4"] }],
      false,
    );
    expect(toastSuccessMock).toHaveBeenCalledWith("Створено матчів: 1");
  });

  it("shows an error and closes without committing when the draw itself fails", async () => {
    drawDoublesTeamsActionMock.mockResolvedValueOnce({ ok: false, error: "Позначте хоча б одного гравця як сіяного" });

    render(
      <RandomizeMatchesButton
        tournamentId="t1"
        roster={roster}
        hasSeededPlayer={true}
        hasMatches={false}
        completedMatchCount={0}
      />,
    );

    await act(async () => {
      (await screen.findByRole("button", { name: "Рандомайзер" })).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "Почати жеребкування" }).click();
    });

    expect(toastErrorMock).toHaveBeenCalledWith("Позначте хоча б одного гравця як сіяного");
    expect(commitDoublesMatchesActionMock).not.toHaveBeenCalled();
  });
});
