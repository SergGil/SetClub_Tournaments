// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PadelRandomizeMatchesButton } from "@/components/admin/padel-randomize-matches-button";

const {
  drawPadelDoublesTeamsActionMock,
  commitPadelDoublesMatchesActionMock,
  drawPadelDoublesGroupsActionMock,
  commitPadelDoublesGroupsActionMock,
} = vi.hoisted(() => ({
  drawPadelDoublesTeamsActionMock: vi.fn(),
  commitPadelDoublesMatchesActionMock: vi.fn(),
  drawPadelDoublesGroupsActionMock: vi.fn(),
  commitPadelDoublesGroupsActionMock: vi.fn(),
}));
vi.mock("@/lib/actions/padel-randomize-doubles", () => ({
  drawPadelDoublesTeamsAction: drawPadelDoublesTeamsActionMock,
  commitPadelDoublesMatchesAction: commitPadelDoublesMatchesActionMock,
  drawPadelDoublesGroupsAction: drawPadelDoublesGroupsActionMock,
  commitPadelDoublesGroupsAction: commitPadelDoublesGroupsActionMock,
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

describe("PadelRandomizeMatchesButton (gating)", () => {
  it("disables the trigger when nobody is seeded yet", () => {
    render(
      <PadelRandomizeMatchesButton
        tournamentId="t1"
        roster={roster}
        hasSeededPlayer={false}
        groupCounts={{}}
        customGroupNames={new Map()}
        hasMatches={false}
        completedMatchCount={0}
      />,
    );
    expect(screen.getByRole("button", { name: /Рандомайзер/ })).toBeDisabled();
  });

  it("labels the trigger 'Рерандомайзер' once matches already exist", () => {
    render(
      <PadelRandomizeMatchesButton
        tournamentId="t1"
        roster={roster}
        hasSeededPlayer={true}
        groupCounts={{}}
        customGroupNames={new Map()}
        hasMatches={true}
        completedMatchCount={0}
      />,
    );
    expect(screen.getByRole("button", { name: "Рерандомайзер" })).toBeInTheDocument();
  });

  it("requires typing the confirm word before starting once completed matches would be lost", async () => {
    const user = userEvent.setup();
    render(
      <PadelRandomizeMatchesButton
        tournamentId="t1"
        roster={roster}
        hasSeededPlayer={true}
        groupCounts={{}}
        customGroupNames={new Map()}
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
      <PadelRandomizeMatchesButton
        tournamentId="t1"
        roster={roster}
        hasSeededPlayer={true}
        groupCounts={{}}
        customGroupNames={new Map()}
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

  it("shows a group-count picker instead of requiring pre-assigned groups when the roster has none", async () => {
    const user = userEvent.setup();
    render(
      <PadelRandomizeMatchesButton
        tournamentId="t1"
        roster={roster}
        hasSeededPlayer={true}
        groupCounts={{}}
        customGroupNames={new Map()}
        hasMatches={false}
        completedMatchCount={0}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Рандомайзер" }));
    expect(screen.getByRole("combobox", { name: "Логіка формування пар" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Кількість груп" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Логіка формування пар" }));
    await user.click(await screen.findByRole("option", { name: "За групами" }));

    expect(screen.getByRole("combobox", { name: "Кількість груп" })).toBeInTheDocument();
  });
});

describe("PadelRandomizeMatchesButton (draw -> reveal -> commit flow)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reveals drawn teams one by one, then commits and reports the created match count", async () => {
    drawPadelDoublesTeamsActionMock.mockResolvedValueOnce({
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
    commitPadelDoublesMatchesActionMock.mockResolvedValueOnce({ success: true, matchCount: 1 });

    render(
      <PadelRandomizeMatchesButton
        tournamentId="t1"
        roster={roster}
        hasSeededPlayer={true}
        groupCounts={{}}
        customGroupNames={new Map()}
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

    expect(drawPadelDoublesTeamsActionMock).toHaveBeenCalledWith("t1", []);
    expect(await screen.findByText("Пар сформовано: 0 / 2")).toBeInTheDocument();

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

    expect(commitPadelDoublesMatchesActionMock).toHaveBeenCalledWith(
      "t1",
      [{ sideAIds: ["p1", "p2"], sideBIds: ["p3", "p4"] }],
      false,
    );
    expect(toastSuccessMock).toHaveBeenCalledWith("Створено матчів: 1");
  });

  it("shows an error and closes without committing when the draw itself fails", async () => {
    drawPadelDoublesTeamsActionMock.mockResolvedValueOnce({ ok: false, error: "Позначте хоча б одного гравця як сіяного" });

    render(
      <PadelRandomizeMatchesButton
        tournamentId="t1"
        roster={roster}
        hasSeededPlayer={true}
        groupCounts={{}}
        customGroupNames={new Map()}
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
    expect(commitPadelDoublesMatchesActionMock).not.toHaveBeenCalled();
  });
});

describe("PadelRandomizeMatchesButton (За групами)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reveals grouped teams one by one, then commits per-group matchups tagged with their group", async () => {
    drawPadelDoublesGroupsActionMock.mockResolvedValueOnce({
      ok: true,
      groups: [1],
      fixedTeams: [],
      randomTeams: [
        { playerIds: ["p1", "p2"], names: ["Іван", "Петро"], group: 1 },
        { playerIds: ["p3", "p4"], names: ["Олег", "Данило"], group: 1 },
      ],
      groupAssignment: { p2: 1 },
      matchups: [
        {
          sideA: { playerIds: ["p1", "p2"], names: ["Іван", "Петро"], group: 1 },
          sideB: { playerIds: ["p3", "p4"], names: ["Олег", "Данило"], group: 1 },
          group: 1,
        },
      ],
      unpairedNames: [],
    });
    commitPadelDoublesGroupsActionMock.mockResolvedValueOnce({ success: true, matchCount: 1 });

    render(
      <PadelRandomizeMatchesButton
        tournamentId="t1"
        roster={roster}
        hasSeededPlayer={true}
        groupCounts={{ 1: 4 }}
        customGroupNames={new Map()}
        hasMatches={false}
        completedMatchCount={0}
      />,
    );

    await act(async () => {
      (await screen.findByRole("button", { name: "Рандомайзер" })).click();
    });
    await act(async () => {
      screen.getByRole("combobox", { name: "Логіка формування пар" }).click();
    });
    await act(async () => {
      (await screen.findByRole("option", { name: "За групами" })).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "Почати жеребкування" }).click();
    });

    expect(drawPadelDoublesGroupsActionMock).toHaveBeenCalledWith("t1", [], undefined);
    expect(await screen.findByText("Пар сформовано: 0 / 2")).toBeInTheDocument();
    expect(screen.getByText("Група A")).toBeInTheDocument();

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

    expect(commitPadelDoublesGroupsActionMock).toHaveBeenCalledWith(
      "t1",
      { p2: 1 },
      [{ sideAIds: ["p1", "p2"], sideBIds: ["p3", "p4"], group: 1 }],
      false,
    );
    expect(toastSuccessMock).toHaveBeenCalledWith("Створено матчів: 1");
  });

  it("shows an error and skips the commit when the grouped draw itself fails", async () => {
    drawPadelDoublesGroupsActionMock.mockResolvedValueOnce({
      ok: false,
      error: "Призначте бодай одному гравцю групу вручну в ростері",
    });

    render(
      <PadelRandomizeMatchesButton
        tournamentId="t1"
        roster={roster}
        hasSeededPlayer={true}
        groupCounts={{ 1: 4 }}
        customGroupNames={new Map()}
        hasMatches={false}
        completedMatchCount={0}
      />,
    );

    await act(async () => {
      (await screen.findByRole("button", { name: "Рандомайзер" })).click();
    });
    await act(async () => {
      screen.getByRole("combobox", { name: "Логіка формування пар" }).click();
    });
    await act(async () => {
      (await screen.findByRole("option", { name: "За групами" })).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "Почати жеребкування" }).click();
    });

    expect(toastErrorMock).toHaveBeenCalledWith("Призначте бодай одному гравцю групу вручну в ростері");
    expect(commitPadelDoublesGroupsActionMock).not.toHaveBeenCalled();
  });
});
