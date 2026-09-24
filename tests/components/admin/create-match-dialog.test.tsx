// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MatchDialog } from "@/components/admin/create-match-dialog";
import type { createMatchAction, updateMatchAction } from "@/lib/actions/matches";

const { createMatchActionMock, updateMatchActionMock } = vi.hoisted(() => ({
  createMatchActionMock: vi.fn<typeof createMatchAction>().mockResolvedValue({ success: true }),
  updateMatchActionMock: vi.fn<typeof updateMatchAction>().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/actions/matches", () => ({
  createMatchAction: createMatchActionMock,
  updateMatchAction: updateMatchActionMock,
}));

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const { toastErrorMock, toastInfoMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  toastInfoMock: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock, info: toastInfoMock } }));

const roster = [
  { id: "p1", name: "Іван", nickname: null },
  { id: "p2", name: "Петро", nickname: null },
  { id: "p3", name: "Олег", nickname: null },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MatchDialog (create mode)", () => {
  it("offers a single player slot per side for a SINGLES tournament, with no match-type picker", async () => {
    const user = userEvent.setup();
    render(
      <MatchDialog
        trigger={<button>Додати матч</button>}
        tournamentId="t1"
        format="SINGLES"
        roster={roster}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Додати матч" }));

    expect(screen.queryByText("Тип матчу")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Сторона A" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Сторона B" })).toBeInTheDocument();
  });

  it("excludes a player already picked on one side from every other slot", async () => {
    const user = userEvent.setup();
    render(
      <MatchDialog
        trigger={<button>Додати матч</button>}
        tournamentId="t1"
        format="DOUBLES"
        roster={roster}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Додати матч" }));
    await user.click(screen.getByRole("combobox", { name: "Сторона A, гравець 1" }));
    await user.click(await screen.findByRole("option", { name: "Іван" }));

    await user.click(screen.getByRole("combobox", { name: "Сторона A, гравець 2" }));
    expect(await screen.findByRole("option", { name: "Петро" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Іван" })).not.toBeInTheDocument();
  });

  it("submits the picked players, and on failure shows a toast and refreshes the router", async () => {
    createMatchActionMock.mockResolvedValueOnce({ error: "Гравець не зареєстрований у цьому турнірі" });
    const user = userEvent.setup();
    render(
      <MatchDialog
        trigger={<button>Додати матч</button>}
        tournamentId="t1"
        format="SINGLES"
        roster={roster}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Додати матч" }));
    await user.click(screen.getByRole("combobox", { name: "Сторона A" }));
    await user.click(await screen.findByRole("option", { name: "Іван" }));
    await user.click(screen.getByRole("combobox", { name: "Сторона B" }));
    await user.click(await screen.findByRole("option", { name: "Петро" }));

    await user.click(screen.getByRole("button", { name: "Створити матч" }));

    await waitFor(() => expect(createMatchActionMock).toHaveBeenCalledTimes(1));
    const [, formData] = createMatchActionMock.mock.calls[0];
    expect(formData.get("tournamentId")).toBe("t1");
    expect(formData.getAll("sideAPlayerIds")).toEqual(["p1"]);
    expect(formData.getAll("sideBPlayerIds")).toEqual(["p2"]);

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Гравець не зареєстрований у цьому турнірі"));
    expect(refreshMock).toHaveBeenCalled();
  });

  it("offers Втішний півфінал in the Сітка (плей-офф) section and submits it as the round", async () => {
    const user = userEvent.setup();
    render(
      <MatchDialog
        trigger={<button>Додати матч</button>}
        tournamentId="t1"
        format="SINGLES"
        roster={roster}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Додати матч" }));
    await user.click(screen.getByRole("combobox", { name: /раунд/i }));
    await user.click(await screen.findByRole("option", { name: "Втішний півфінал" }));

    await user.click(screen.getByRole("combobox", { name: "Сторона A" }));
    await user.click(await screen.findByRole("option", { name: "Іван" }));
    await user.click(screen.getByRole("combobox", { name: "Сторона B" }));
    await user.click(await screen.findByRole("option", { name: "Петро" }));
    await user.click(screen.getByRole("button", { name: "Створити матч" }));

    await waitFor(() => expect(createMatchActionMock).toHaveBeenCalledTimes(1));
    const [, formData] = createMatchActionMock.mock.calls[0];
    expect(formData.get("round")).toBe("Втішний півфінал");
  });
});

describe("MatchDialog (create mode, custom group names)", () => {
  it("offers a tournament's custom group names as extra Раунд options", async () => {
    const user = userEvent.setup();
    render(
      <MatchDialog
        trigger={<button>Додати матч</button>}
        tournamentId="t1"
        format="SINGLES"
        roster={roster}
        customGroupNames={["Плейофф"]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Додати матч" }));
    await user.click(screen.getByRole("combobox", { name: /раунд/i }));

    expect(await screen.findByText("Додаткові групи")).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Плейофф" }));
    await user.click(screen.getByRole("combobox", { name: "Сторона A" }));
    await user.click(await screen.findByRole("option", { name: "Іван" }));
    await user.click(screen.getByRole("combobox", { name: "Сторона B" }));
    await user.click(await screen.findByRole("option", { name: "Петро" }));

    await user.click(screen.getByRole("button", { name: "Створити матч" }));

    await waitFor(() => expect(createMatchActionMock).toHaveBeenCalledTimes(1));
    const [, formData] = createMatchActionMock.mock.calls[0];
    expect(formData.get("round")).toBe("Плейофф");
  });

  it("does not duplicate a custom group name that already matches a curated round label", async () => {
    const user = userEvent.setup();
    render(
      <MatchDialog
        trigger={<button>Додати матч</button>}
        tournamentId="t1"
        format="SINGLES"
        roster={roster}
        // "За 7 місце" is already a curated PLACEMENT_ROUNDS option - it
        // must not also show up under "Додаткові групи".
        customGroupNames={["За 7 місце"]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Додати матч" }));
    await user.click(screen.getByRole("combobox", { name: /раунд/i }));

    expect(screen.queryByText("Додаткові групи")).not.toBeInTheDocument();
    expect(await screen.findAllByRole("option", { name: "За 7 місце" })).toHaveLength(1);
  });
});

describe("MatchDialog (playoffOnly - the '+ Плейофф' shortcut)", () => {
  it("titles the dialog for a playoff match and defaults the stage to Фінал instead of Без раунду", async () => {
    const user = userEvent.setup();
    render(
      <MatchDialog
        trigger={<button>Плейофф</button>}
        tournamentId="t1"
        format="SINGLES"
        roster={roster}
        playoffOnly
      />,
    );

    await user.click(screen.getByRole("button", { name: "Плейофф" }));

    expect(screen.getByRole("heading", { name: "Додати матч плейофф" })).toBeInTheDocument();
    const roundField = screen.getByRole("combobox", { name: "Стадія" });
    expect(within(roundField).getByText("Фінал")).toBeInTheDocument();
  });

  it("offers only curated playoff stages - no Без раунду, custom groups, or Інше…", async () => {
    const user = userEvent.setup();
    render(
      <MatchDialog
        trigger={<button>Плейофф</button>}
        tournamentId="t1"
        format="SINGLES"
        roster={roster}
        customGroupNames={["Сіяні"]}
        playoffOnly
      />,
    );

    await user.click(screen.getByRole("button", { name: "Плейофф" }));
    await user.click(screen.getByRole("combobox", { name: "Стадія" }));

    expect(screen.queryByRole("option", { name: "Без раунду" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Інше…" })).not.toBeInTheDocument();
    expect(screen.queryByText("Додаткові групи")).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "1/2" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "За 5 місце" })).toBeInTheDocument();
  });

  it("submits the picked stage as the match's round", async () => {
    const user = userEvent.setup();
    render(
      <MatchDialog
        trigger={<button>Плейофф</button>}
        tournamentId="t1"
        format="SINGLES"
        roster={roster}
        playoffOnly
      />,
    );

    await user.click(screen.getByRole("button", { name: "Плейофф" }));
    await user.click(screen.getByRole("combobox", { name: "Стадія" }));
    await user.click(await screen.findByRole("option", { name: "1/2" }));

    await user.click(screen.getByRole("combobox", { name: "Сторона A" }));
    await user.click(await screen.findByRole("option", { name: "Іван" }));
    await user.click(screen.getByRole("combobox", { name: "Сторона B" }));
    await user.click(await screen.findByRole("option", { name: "Петро" }));
    await user.click(screen.getByRole("button", { name: "Створити матч" }));

    await waitFor(() => expect(createMatchActionMock).toHaveBeenCalledTimes(1));
    const [, formData] = createMatchActionMock.mock.calls[0];
    expect(formData.get("round")).toBe("1/2");
  });

  it("refreshes the router on a successful create - no onOptimisticCreate is wired for this entry point, so nothing else would show the new match", async () => {
    const user = userEvent.setup();
    render(
      <MatchDialog
        trigger={<button>Плейофф</button>}
        tournamentId="t1"
        format="SINGLES"
        roster={roster}
        playoffOnly
      />,
    );

    await user.click(screen.getByRole("button", { name: "Плейофф" }));
    await user.click(screen.getByRole("combobox", { name: "Сторона A" }));
    await user.click(await screen.findByRole("option", { name: "Іван" }));
    await user.click(screen.getByRole("combobox", { name: "Сторона B" }));
    await user.click(await screen.findByRole("option", { name: "Петро" }));
    await user.click(screen.getByRole("button", { name: "Створити матч" }));

    await waitFor(() => expect(createMatchActionMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });
});

describe("MatchDialog (create mode, onOptimisticCreate wired)", () => {
  it("does NOT refresh the router on a successful create - the caller's own optimistic list already shows it (matches tournament-matches.tsx's usage)", async () => {
    const user = userEvent.setup();
    render(
      <MatchDialog
        trigger={<button>Додати матч</button>}
        tournamentId="t1"
        format="SINGLES"
        roster={roster}
        onOptimisticCreate={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Додати матч" }));
    await user.click(screen.getByRole("combobox", { name: "Сторона A" }));
    await user.click(await screen.findByRole("option", { name: "Іван" }));
    await user.click(screen.getByRole("combobox", { name: "Сторона B" }));
    await user.click(await screen.findByRole("option", { name: "Петро" }));
    await user.click(screen.getByRole("button", { name: "Створити матч" }));

    await waitFor(() => expect(createMatchActionMock).toHaveBeenCalledTimes(1));
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

describe("MatchDialog (edit mode)", () => {
  it("recognizes a curated round as a Select value, not free text", async () => {
    const user = userEvent.setup();
    render(
      <MatchDialog
        trigger={<button>Редагувати</button>}
        tournamentId="t1"
        format="SINGLES"
        roster={roster}
        match={{
          id: "m1",
          matchType: "SINGLES",
          round: "Фінал",
          scheduledDate: null,
          sideAPlayerIds: ["p1"],
          sideBPlayerIds: ["p2"],
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Редагувати" }));

    expect(screen.queryByLabelText("Власна назва раунду")).not.toBeInTheDocument();
    const roundField = screen.getByRole("combobox", { name: /раунд/i });
    expect(within(roundField).getByText("Фінал")).toBeInTheDocument();
  });

  it("recognizes Втішний півфінал as a curated Select value, not free text", async () => {
    const user = userEvent.setup();
    render(
      <MatchDialog
        trigger={<button>Редагувати</button>}
        tournamentId="t1"
        format="SINGLES"
        roster={roster}
        match={{
          id: "m1",
          matchType: "SINGLES",
          round: "Втішний півфінал",
          scheduledDate: null,
          sideAPlayerIds: ["p1"],
          sideBPlayerIds: ["p2"],
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Редагувати" }));

    expect(screen.queryByLabelText("Власна назва раунду")).not.toBeInTheDocument();
    const roundField = screen.getByRole("combobox", { name: /раунд/i });
    expect(within(roundField).getByText("Втішний півфінал")).toBeInTheDocument();
  });

  it("falls back to the free-text field for a non-curated round", async () => {
    const user = userEvent.setup();
    render(
      <MatchDialog
        trigger={<button>Редагувати</button>}
        tournamentId="t1"
        format="SINGLES"
        roster={roster}
        match={{
          id: "m1",
          matchType: "SINGLES",
          round: "Сіяні",
          scheduledDate: null,
          sideAPlayerIds: ["p1"],
          sideBPlayerIds: ["p2"],
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Редагувати" }));

    expect(screen.getByLabelText("Власна назва раунду")).toHaveValue("Сіяні");
  });

  it("recognizes a match already assigned to a custom group as a Select value, not free text", async () => {
    render(
      <MatchDialog
        trigger={<button>Редагувати</button>}
        tournamentId="t1"
        format="SINGLES"
        roster={roster}
        customGroupNames={["Плейофф"]}
        match={{
          id: "m1",
          matchType: "SINGLES",
          round: "Плейофф",
          scheduledDate: null,
          sideAPlayerIds: ["p1"],
          sideBPlayerIds: ["p2"],
        }}
      />,
    );

    await userEvent.setup().click(screen.getByRole("button", { name: "Редагувати" }));

    expect(screen.queryByLabelText("Власна назва раунду")).not.toBeInTheDocument();
    const roundField = screen.getByRole("combobox", { name: /раунд/i });
    expect(within(roundField).getByText("Плейофф")).toBeInTheDocument();
  });
});
