// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SinglesRandomizeButton } from "@/components/admin/singles-randomize-button";

const {
  drawSinglesGroupsActionMock,
  drawSinglesSeededGroupsActionMock,
  commitSinglesGroupsActionMock,
  commitSinglesRoundRobinActionMock,
} = vi.hoisted(() => ({
  drawSinglesGroupsActionMock: vi.fn(),
  drawSinglesSeededGroupsActionMock: vi.fn(),
  commitSinglesGroupsActionMock: vi.fn(),
  commitSinglesRoundRobinActionMock: vi.fn(),
}));
vi.mock("@/lib/actions/randomize-singles", () => ({
  drawSinglesGroupsAction: drawSinglesGroupsActionMock,
  drawSinglesSeededGroupsAction: drawSinglesSeededGroupsActionMock,
  commitSinglesGroupsAction: commitSinglesGroupsActionMock,
  commitSinglesRoundRobinAction: commitSinglesRoundRobinActionMock,
}));

const { drawGroups12PlayoffActionMock, commitGroups12PlayoffActionMock } = vi.hoisted(() => ({
  drawGroups12PlayoffActionMock: vi.fn(),
  commitGroups12PlayoffActionMock: vi.fn(),
}));
vi.mock("@/lib/actions/randomize-singles-groups12", () => ({
  drawGroups12PlayoffAction: drawGroups12PlayoffActionMock,
  commitGroups12PlayoffAction: commitGroups12PlayoffActionMock,
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
        customGroupNames={new Map()}
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
        customGroupNames={new Map()}
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
        customGroupNames={new Map()}
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
        customGroupNames={new Map()}
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
        customGroupNames={new Map()}
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
        customGroupNames={new Map()}
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
        customGroupNames={new Map()}
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

describe("SinglesRandomizeButton (GROUPS_12_PLAYOFF gating)", () => {
  it("hides the option when the roster isn't exactly 12 participants with exactly 4 seeded", async () => {
    const user = userEvent.setup();
    render(
      <SinglesRandomizeButton
        tournamentId="t1"
        seededCount={4}
        unseededCount={7} // 11 total, not 12
        groupCounts={{}}
        customGroupNames={new Map()}
        hasMatches={false}
        completedMatchCount={0}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Рандомайзер" }));
    await user.click(screen.getByRole("combobox", { name: "Логіка формування матчів" }));
    expect(screen.queryByRole("option", { name: /плей-офф/ })).not.toBeInTheDocument();
  });

  it("offers the option for 8 seeded + 4 unseeded too, but not for 3 or 9 seeded", async () => {
    const user = userEvent.setup();
    const open = async (seeded: number) => {
      const view = render(
        <SinglesRandomizeButton
          tournamentId="t1"
          seededCount={seeded}
          unseededCount={12 - seeded}
          groupCounts={{}}
          customGroupNames={new Map()}
          hasMatches={false}
          completedMatchCount={0}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Рандомайзер" }));
      await user.click(screen.getByRole("combobox", { name: "Логіка формування матчів" }));
      return view;
    };

    let view = await open(8);
    expect(await screen.findByRole("option", { name: /плей-офф/ })).toBeInTheDocument();
    view.unmount();

    for (const seeded of [3, 9]) {
      view = await open(seeded);
      expect(screen.queryByRole("option", { name: /плей-офф/ })).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it("offers the option once there are exactly 12 participants with exactly 4 seeded", async () => {
    const user = userEvent.setup();
    render(
      <SinglesRandomizeButton
        tournamentId="t1"
        seededCount={4}
        unseededCount={8}
        groupCounts={{}}
        customGroupNames={new Map()}
        hasMatches={false}
        completedMatchCount={0}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Рандомайзер" }));
    await user.click(screen.getByRole("combobox", { name: "Логіка формування матчів" }));
    await user.click(await screen.findByRole("option", { name: /плей-офф/ }));
    expect(screen.getByText(/буде створено 30 матчів/)).toBeInTheDocument();
  });
});

describe("SinglesRandomizeButton (GROUPS_12_PLAYOFF - draw -> reveal -> commit)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("draws and commits through the groups12 actions, not the CUSTOM_GROUPS ones", async () => {
    drawGroups12PlayoffActionMock.mockResolvedValueOnce({
      ok: true,
      existingGroups: [1, 2, 3, 4].map((group) => ({ group, players: [] })),
      revealOrder: [{ playerId: "p1", name: "Іван" }],
      groupAssignment: { p1: 1 },
      matchups: [
        { sideA: { playerId: "p1", name: "Іван" }, sideB: { playerId: "p2", name: "Петро" }, round: "Група A" },
      ],
    });
    commitGroups12PlayoffActionMock.mockResolvedValueOnce({ success: true, matchCount: 30 });

    render(
      <SinglesRandomizeButton
        tournamentId="t1"
        seededCount={4}
        unseededCount={8}
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
      screen.getByRole("combobox", { name: "Логіка формування матчів" }).click();
    });
    await act(async () => {
      (await screen.findByRole("option", { name: /плей-офф/ })).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "Створити" }).click();
    });

    expect(drawGroups12PlayoffActionMock).toHaveBeenCalledWith("t1");
    expect(drawSinglesGroupsActionMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(commitGroups12PlayoffActionMock).toHaveBeenCalledWith(
      "t1",
      { p1: 1 },
      [{ sideA: "p1", sideB: "p2", round: "Група A" }],
      false,
    );
    expect(commitSinglesGroupsActionMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith("Створено матчів: 30");
  });
});

const props = {
  tournamentId: "t1",
  groupCounts: {},
  customGroupNames: new Map<number, string>(),
  hasMatches: false,
  completedMatchCount: 0,
};

describe("SinglesRandomizeButton (SEEDED_GROUPS - Групи зі сіяністю)", () => {
  it("hides the option when nobody is seeded or there are fewer than 4 participants", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<SinglesRandomizeButton {...props} seededCount={0} unseededCount={8} />);
    await user.click(screen.getByRole("button", { name: "Рандомайзер" }));
    // Nobody seeded + no groups -> no strategy picker at all.
    expect(screen.queryByRole("combobox", { name: "Логіка формування матчів" })).not.toBeInTheDocument();
    unmount();

    render(<SinglesRandomizeButton {...props} seededCount={2} unseededCount={1} />);
    await user.click(screen.getByRole("button", { name: "Рандомайзер" }));
    await user.click(screen.getByRole("combobox", { name: "Логіка формування матчів" }));
    expect(screen.queryByRole("option", { name: /Групи зі сіяністю/ })).not.toBeInTheDocument();
  });

  it("previews the match count: 12 players (8 seeded + 4 unseeded) default to 4 groups of 3 = 12 matches", async () => {
    const user = userEvent.setup();
    render(<SinglesRandomizeButton {...props} seededCount={8} unseededCount={4} />);
    await user.click(screen.getByRole("button", { name: "Рандомайзер" }));
    await user.click(screen.getByRole("combobox", { name: "Логіка формування матчів" }));
    await user.click(await screen.findByRole("option", { name: /Групи зі сіяністю/ }));

    expect(screen.getByRole("combobox", { name: "Кількість груп" })).toBeInTheDocument();
    expect(screen.getByText(/по 4 групах/)).toBeInTheDocument();
    expect(screen.getByText(/буде створено 12 матчів/)).toBeInTheDocument();
  });
});

describe("SinglesRandomizeButton (SEEDED_GROUPS - draw -> reveal -> commit)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("draws with the chosen group count and commits through the groups commit tagged SEEDED_GROUPS", async () => {
    drawSinglesSeededGroupsActionMock.mockResolvedValueOnce({
      ok: true,
      existingGroups: [1, 2, 3, 4].map((group) => ({ group, players: [] })),
      revealOrder: [{ playerId: "p1", name: "Іван" }],
      groupAssignment: { p1: 1 },
      matchups: [
        { sideA: { playerId: "p1", name: "Іван" }, sideB: { playerId: "p2", name: "Петро" }, round: "Група A" },
      ],
    });
    commitSinglesGroupsActionMock.mockResolvedValueOnce({ success: true, matchCount: 12 });

    render(<SinglesRandomizeButton {...props} seededCount={8} unseededCount={4} />);

    await act(async () => {
      (await screen.findByRole("button", { name: "Рандомайзер" })).click();
    });
    await act(async () => {
      screen.getByRole("combobox", { name: "Логіка формування матчів" }).click();
    });
    await act(async () => {
      (await screen.findByRole("option", { name: /Групи зі сіяністю/ })).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "Створити" }).click();
    });

    expect(drawSinglesSeededGroupsActionMock).toHaveBeenCalledWith("t1", 4);
    expect(drawSinglesGroupsActionMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(commitSinglesGroupsActionMock).toHaveBeenCalledWith(
      "t1",
      { p1: 1 },
      [{ sideA: "p1", sideB: "p2", round: "Група A" }],
      false,
      undefined,
      "SEEDED_GROUPS",
    );
  });
});
