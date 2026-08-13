// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PadelMatchDialog } from "@/components/admin/create-padel-match-dialog";
import type { createPadelMatchAction, updatePadelMatchAction } from "@/lib/actions/padel-matches";

const { createPadelMatchActionMock, updatePadelMatchActionMock } = vi.hoisted(() => ({
  createPadelMatchActionMock: vi.fn<typeof createPadelMatchAction>().mockResolvedValue({ success: true }),
  updatePadelMatchActionMock: vi.fn<typeof updatePadelMatchAction>().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/actions/padel-matches", () => ({
  createPadelMatchAction: createPadelMatchActionMock,
  updatePadelMatchAction: updatePadelMatchActionMock,
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

describe("PadelMatchDialog (create mode)", () => {
  it("offers a single player slot per side for a SINGLES tournament, with no match-type picker", async () => {
    const user = userEvent.setup();
    render(
      <PadelMatchDialog
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
      <PadelMatchDialog
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
    createPadelMatchActionMock.mockResolvedValueOnce({ error: "Гравець не зареєстрований у цьому турнірі" });
    const user = userEvent.setup();
    render(
      <PadelMatchDialog
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

    await waitFor(() => expect(createPadelMatchActionMock).toHaveBeenCalledTimes(1));
    const [, formData] = createPadelMatchActionMock.mock.calls[0];
    expect(formData.get("tournamentId")).toBe("t1");
    expect(formData.getAll("sideAPlayerIds")).toEqual(["p1"]);
    expect(formData.getAll("sideBPlayerIds")).toEqual(["p2"]);

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Гравець не зареєстрований у цьому турнірі"));
    expect(refreshMock).toHaveBeenCalled();
  });

  it("offers Втішний півфінал in the Сітка (плей-офф) section and submits it as the round", async () => {
    const user = userEvent.setup();
    render(
      <PadelMatchDialog
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

    await waitFor(() => expect(createPadelMatchActionMock).toHaveBeenCalledTimes(1));
    const [, formData] = createPadelMatchActionMock.mock.calls[0];
    expect(formData.get("round")).toBe("Втішний півфінал");
  });
});

describe("PadelMatchDialog (create mode, custom group names)", () => {
  it("offers a tournament's custom group names as extra Раунд options", async () => {
    const user = userEvent.setup();
    render(
      <PadelMatchDialog
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

    await waitFor(() => expect(createPadelMatchActionMock).toHaveBeenCalledTimes(1));
    const [, formData] = createPadelMatchActionMock.mock.calls[0];
    expect(formData.get("round")).toBe("Плейофф");
  });

  it("does not duplicate a custom group name that already matches a curated round label", async () => {
    const user = userEvent.setup();
    render(
      <PadelMatchDialog
        trigger={<button>Додати матч</button>}
        tournamentId="t1"
        format="SINGLES"
        roster={roster}
        customGroupNames={["За 7 місце"]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Додати матч" }));
    await user.click(screen.getByRole("combobox", { name: /раунд/i }));

    expect(screen.queryByText("Додаткові групи")).not.toBeInTheDocument();
    expect(await screen.findAllByRole("option", { name: "За 7 місце" })).toHaveLength(1);
  });
});

describe("PadelMatchDialog (edit mode)", () => {
  it("recognizes a curated round as a Select value, not free text", async () => {
    const user = userEvent.setup();
    render(
      <PadelMatchDialog
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
      <PadelMatchDialog
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
      <PadelMatchDialog
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
      <PadelMatchDialog
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
