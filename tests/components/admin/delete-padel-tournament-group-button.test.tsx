// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeletePadelTournamentGroupButton } from "@/components/admin/delete-padel-tournament-group-button";

const { deletePadelTournamentGroupActionMock } = vi.hoisted(() => ({
  deletePadelTournamentGroupActionMock: vi.fn(async () => ({})),
}));
vi.mock("@/lib/actions/padel-tournaments", () => ({
  deletePadelTournamentGroupAction: deletePadelTournamentGroupActionMock,
}));

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DeletePadelTournamentGroupButton", () => {
  it("deletes the group after confirming", async () => {
    const user = userEvent.setup();
    render(<DeletePadelTournamentGroupButton tournamentId="t1" groupId="g1" groupName="Плейофф" />);

    await user.click(screen.getByRole("button", { name: "Видалити групу «Плейофф»" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(deletePadelTournamentGroupActionMock).toHaveBeenCalledWith("t1", "g1"));
  });

  it("shows a toast and doesn't crash when the delete fails", async () => {
    deletePadelTournamentGroupActionMock.mockResolvedValueOnce({ error: "Групу не знайдено" });
    const user = userEvent.setup();
    render(<DeletePadelTournamentGroupButton tournamentId="t1" groupId="g1" groupName="Плейофф" />);

    await user.click(screen.getByRole("button", { name: "Видалити групу «Плейофф»" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Групу не знайдено"));
  });
});
