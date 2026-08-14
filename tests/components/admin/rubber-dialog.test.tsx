// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RubberDialog } from "@/components/admin/rubber-dialog";

const { actionMock } = vi.hoisted(() => ({
  actionMock: vi.fn<(prevState: unknown, formData: FormData) => Promise<{ error?: string }>>(
    async () => ({}),
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const teamAMembers = [
  { id: "a1", name: "Іван", nickname: null },
  { id: "a2", name: "Петро", nickname: null },
];
const teamBMembers = [
  { id: "b1", name: "Олег", nickname: null },
  { id: "b2", name: "Марія", nickname: null },
];

describe("RubberDialog", () => {
  it("restricts each side's player picker to that team's own members", async () => {
    const user = userEvent.setup();
    render(
      <RubberDialog
        tieId="tie1"
        teamAName="Команда А"
        teamBName="Команда Б"
        teamAMembers={teamAMembers}
        teamBMembers={teamBMembers}
        action={actionMock}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Додати раббер" }));
    await user.click(screen.getByRole("combobox", { name: "Команда А" }));

    expect(await screen.findByRole("option", { name: "Іван" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Петро" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Олег" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Марія" })).not.toBeInTheDocument();
  });

  it("shows a second slot per side once doubles is picked", async () => {
    const user = userEvent.setup();
    render(
      <RubberDialog
        tieId="tie1"
        teamAName="Команда А"
        teamBName="Команда Б"
        teamAMembers={teamAMembers}
        teamBMembers={teamBMembers}
        action={actionMock}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Додати раббер" }));
    expect(screen.getAllByRole("combobox", { name: "Команда А" })).toHaveLength(1);

    // The match-type Select has no explicit accessible name (same as
    // create-match-dialog.tsx's own matchType Select) - it's the first
    // combobox in the form.
    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByRole("option", { name: "Парний (2×2)" }));

    expect(screen.getAllByRole("combobox", { name: /Команда А, гравець/ })).toHaveLength(2);
  });

  it("submits the tieId and picked players through the provided action", async () => {
    const user = userEvent.setup();
    render(
      <RubberDialog
        tieId="tie1"
        teamAName="Команда А"
        teamBName="Команда Б"
        teamAMembers={teamAMembers}
        teamBMembers={teamBMembers}
        action={actionMock}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Додати раббер" }));
    await user.click(screen.getByRole("combobox", { name: "Команда А" }));
    await user.click(await screen.findByRole("option", { name: "Іван" }));
    await user.click(screen.getByRole("combobox", { name: "Команда Б" }));
    await user.click(await screen.findByRole("option", { name: "Олег" }));

    await user.click(screen.getByRole("button", { name: "Створити раббер" }));

    expect(actionMock).toHaveBeenCalled();
    const formData = actionMock.mock.calls[0][1] as FormData;
    expect(formData.get("tieId")).toBe("tie1");
    expect(formData.get("matchType")).toBe("SINGLES");
    expect(formData.getAll("sideAPlayerIds")).toEqual(["a1"]);
    expect(formData.getAll("sideBPlayerIds")).toEqual(["b1"]);
  });
});
