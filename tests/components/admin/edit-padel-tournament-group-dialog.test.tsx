// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EditPadelTournamentGroupDialog } from "@/components/admin/edit-padel-tournament-group-dialog";

const { updatePadelTournamentGroupActionMock } = vi.hoisted(() => ({
  updatePadelTournamentGroupActionMock: vi.fn(async () => ({})),
}));
vi.mock("@/lib/actions/padel-tournaments", () => ({
  updatePadelTournamentGroupAction: updatePadelTournamentGroupActionMock,
}));

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock } }));

beforeEach(() => {
  vi.clearAllMocks();
});

const participants = [
  { id: "p1", name: "Іван", nickname: null },
  { id: "p2", name: "Петро", nickname: null },
  { id: "p3", name: "Олег", nickname: null },
];

describe("EditPadelTournamentGroupDialog", () => {
  it("pre-fills the current name and members when opened", async () => {
    const user = userEvent.setup();
    render(
      <EditPadelTournamentGroupDialog
        tournamentId="t1"
        groupId="g1"
        groupName="Плейофф"
        memberIds={["p1", "p2"]}
        participants={participants}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Редагувати групу «Плейофф»" }));

    expect(screen.getByLabelText("Назва групи")).toHaveValue("Плейофф");
    expect(screen.getByText("Іван")).toBeInTheDocument();
    expect(screen.getByText("Петро")).toBeInTheDocument();
    expect(screen.queryByText("Олег")).not.toBeInTheDocument();
  });

  it("saves the renamed group and updated member list", async () => {
    const user = userEvent.setup();
    render(
      <EditPadelTournamentGroupDialog
        tournamentId="t1"
        groupId="g1"
        groupName="Плейофф"
        memberIds={["p1"]}
        participants={participants}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Редагувати групу «Плейофф»" }));
    const nameInput = screen.getByLabelText("Назва групи");
    await user.clear(nameInput);
    await user.type(nameInput, "Фінальна група");

    await user.click(screen.getByRole("combobox", { name: "Обрати гравців для групи" }));
    await user.click(await screen.findByRole("option", { name: "Олег" }));
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() =>
      expect(updatePadelTournamentGroupActionMock).toHaveBeenCalledWith("t1", "g1", "Фінальна група", [
        "p1",
        "p3",
      ]),
    );
    await waitFor(() => expect(screen.queryByLabelText("Назва групи")).not.toBeInTheDocument());
  });

  it("removing a pre-selected member's badge excludes them from the save", async () => {
    const user = userEvent.setup();
    render(
      <EditPadelTournamentGroupDialog
        tournamentId="t1"
        groupId="g1"
        groupName="Плейофф"
        memberIds={["p1", "p2"]}
        participants={participants}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Редагувати групу «Плейофф»" }));
    const ivanBadge = screen.getByText("Іван").closest("span") as HTMLElement;
    await user.click(within(ivanBadge).getByRole("button", { name: "Прибрати з вибору" }));
    await user.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() =>
      expect(updatePadelTournamentGroupActionMock).toHaveBeenCalledWith("t1", "g1", "Плейофф", ["p2"]),
    );
  });

  it("shows a toast and keeps the dialog open when the update fails", async () => {
    updatePadelTournamentGroupActionMock.mockResolvedValueOnce({ error: "Групу не знайдено" });
    const user = userEvent.setup();
    render(
      <EditPadelTournamentGroupDialog
        tournamentId="t1"
        groupId="g1"
        groupName="Плейофф"
        memberIds={[]}
        participants={participants}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Редагувати групу «Плейофф»" }));
    await user.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Групу не знайдено"));
    expect(screen.getByLabelText("Назва групи")).toBeInTheDocument();
  });

  it("discards a cancelled edit's draft when reopened", async () => {
    const user = userEvent.setup();
    render(
      <EditPadelTournamentGroupDialog
        tournamentId="t1"
        groupId="g1"
        groupName="Плейофф"
        memberIds={["p1"]}
        participants={participants}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Редагувати групу «Плейофф»" }));
    const nameInput = screen.getByLabelText("Назва групи");
    await user.clear(nameInput);
    await user.type(nameInput, "Тимчасова назва");
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Редагувати групу «Плейофф»" }));
    expect(screen.getByLabelText("Назва групи")).toHaveValue("Плейофф");
  });
});
