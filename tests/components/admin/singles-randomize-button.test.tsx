// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SinglesRandomizeButton } from "@/components/admin/singles-randomize-button";

const {
  drawSinglesGroupsActionMock,
  commitSinglesGroupsActionMock,
  commitSinglesRoundRobinActionMock,
} = vi.hoisted(() => ({
  drawSinglesGroupsActionMock: vi.fn(),
  commitSinglesGroupsActionMock: vi.fn(),
  commitSinglesRoundRobinActionMock: vi.fn(),
}));
vi.mock("@/lib/actions/randomize-singles", () => ({
  drawSinglesGroupsAction: drawSinglesGroupsActionMock,
  commitSinglesGroupsAction: commitSinglesGroupsActionMock,
  commitSinglesRoundRobinAction: commitSinglesRoundRobinActionMock,
}));

const { toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: toastSuccessMock } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SinglesRandomizeButton (gating)", () => {
  it("disables the trigger with fewer than 2 participants", () => {
    render(
      <SinglesRandomizeButton
        tournamentId="t1"
        seededCount={0}
        unseededCount={1}
        groupCounts={{}}
        hasMatches={false}
        completedMatchCount={0}
      />,
    );
    expect(screen.getByRole("button", { name: /Рандомайзер/ })).toBeDisabled();
  });

  it("hides the strategy picker when neither seeding nor groups are in use", async () => {
    const user = userEvent.setup();
    render(
      <SinglesRandomizeButton
        tournamentId="t1"
        seededCount={0}
        unseededCount={4}
        groupCounts={{}}
        hasMatches={false}
        completedMatchCount={0}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Рандомайзер" }));
    expect(screen.queryByLabelText("Логіка формування матчів")).not.toBeInTheDocument();
    expect(screen.getByText(/буде створено 6 матчів/)).toBeInTheDocument();
  });

  it("blocks creating when the chosen split would produce zero matches", async () => {
    const user = userEvent.setup();
    render(
      <SinglesRandomizeButton
        tournamentId="t1"
        seededCount={1}
        unseededCount={1}
        groupCounts={{}}
        hasMatches={false}
        completedMatchCount={0}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Рандомайзер" }));
    await user.click(screen.getByRole("combobox", { name: "Логіка формування матчів" }));
    await user.click(await screen.findByRole("option", { name: /Сіяні проти сіяних/ }));

    expect(screen.getByText("За такого розподілу учасників жоден матч не сформується.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Створити" })).toBeDisabled();
  });

  it("requires the confirm word once completed matches would be lost", async () => {
    const user = userEvent.setup();
    render(
      <SinglesRandomizeButton
        tournamentId="t1"
        seededCount={0}
        unseededCount={4}
        groupCounts={{}}
        hasMatches={true}
        completedMatchCount={2}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Рерандомайзер" }));
    const createButton = screen.getByRole("button", { name: "Створити" });
    expect(createButton).toBeDisabled();

    await user.type(screen.getByRole("textbox"), "ВИДАЛИТИ");
    expect(createButton).toBeEnabled();
  });
});

describe("SinglesRandomizeButton (ALL/SEEDED_SPLIT - direct commit)", () => {
  it("commits immediately without a draw animation and reports the created match count", async () => {
    const user = userEvent.setup();
    commitSinglesRoundRobinActionMock.mockResolvedValueOnce({ success: true, matchCount: 6 });

    render(
      <SinglesRandomizeButton
        tournamentId="t1"
        seededCount={0}
        unseededCount={4}
        groupCounts={{}}
        hasMatches={false}
        completedMatchCount={0}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Рандомайзер" }));
    await user.click(screen.getByRole("button", { name: "Створити" }));

    expect(commitSinglesRoundRobinActionMock).toHaveBeenCalledWith("t1", "ALL", false);
    expect(toastSuccessMock).toHaveBeenCalledWith("Створено матчів: 6");
    expect(drawSinglesGroupsActionMock).not.toHaveBeenCalled();
  });
});

describe("SinglesRandomizeButton (CUSTOM_GROUPS - draw -> reveal -> commit)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reveals the ungrouped player, then commits the per-group matchups", async () => {
    drawSinglesGroupsActionMock.mockResolvedValueOnce({
      ok: true,
      existingGroups: [{ group: 1, players: [{ playerId: "p1", name: "Іван" }] }],
      revealOrder: [{ playerId: "p3", name: "Олег" }],
      groupAssignment: { p3: 1 },
      matchups: [
        { sideA: { playerId: "p1", name: "Іван" }, sideB: { playerId: "p3", name: "Олег" }, round: "Група 1" },
      ],
    });
    commitSinglesGroupsActionMock.mockResolvedValueOnce({ success: true, matchCount: 1 });

    render(
      <SinglesRandomizeButton
        tournamentId="t1"
        seededCount={0}
        unseededCount={3}
        groupCounts={{ 1: 2 }}
        hasMatches={false}
        completedMatchCount={0}
      />,
    );

    await act(async () => {
      (await screen.findByRole("button", { name: "Рандомайзер" })).click();
    });
    await act(async () => {
      screen.getByRole("combobox", { name: "Логіка формування матчів" }).click();
    });
    await act(async () => {
      (await screen.findByRole("option", { name: "За групами" })).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "Створити" }).click();
    });

    expect(drawSinglesGroupsActionMock).toHaveBeenCalledWith("t1");
    expect(await screen.findByText("Розподілено гравців: 0 / 1")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getByText("Розподілено гравців: 1 / 1")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(commitSinglesGroupsActionMock).toHaveBeenCalledWith(
      "t1",
      { p3: 1 },
      [{ sideA: "p1", sideB: "p3", round: "Група 1" }],
      false,
    );
    expect(toastSuccessMock).toHaveBeenCalledWith("Створено матчів: 1");
  });

  it("shows an error and skips the commit when the draw itself fails", async () => {
    drawSinglesGroupsActionMock.mockResolvedValueOnce({
      ok: false,
      error: "Призначте бодай одному гравцю групу вручну в ростері",
    });

    render(
      <SinglesRandomizeButton
        tournamentId="t1"
        seededCount={0}
        unseededCount={3}
        groupCounts={{ 1: 2 }}
        hasMatches={false}
        completedMatchCount={0}
      />,
    );

    await act(async () => {
      (await screen.findByRole("button", { name: "Рандомайзер" })).click();
    });
    await act(async () => {
      screen.getByRole("combobox", { name: "Логіка формування матчів" }).click();
    });
    await act(async () => {
      (await screen.findByRole("option", { name: "За групами" })).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "Створити" }).click();
    });

    expect(toastErrorMock).toHaveBeenCalledWith("Призначте бодай одному гравцю групу вручну в ростері");
    expect(commitSinglesGroupsActionMock).not.toHaveBeenCalled();
  });
});
