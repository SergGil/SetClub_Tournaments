// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteTournamentGroupButton } from "@/components/admin/delete-tournament-group-button";

const { deleteTournamentGroupActionMock } = vi.hoisted(() => ({
  deleteTournamentGroupActionMock: vi.fn(async () => ({})),
}));
vi.mock("@/lib/actions/tournaments", () => ({
  deleteTournamentGroupAction: deleteTournamentGroupActionMock,
}));

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DeleteTournamentGroupButton", () => {
  it("deletes the group after confirming", async () => {
    const user = userEvent.setup();
    render(<DeleteTournamentGroupButton tournamentId="t1" groupId="g1" groupName="Плейофф" />);

    await user.click(screen.getByRole("button", { name: "Видалити групу «Плейофф»" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(deleteTournamentGroupActionMock).toHaveBeenCalledWith("t1", "g1"));
  });

  it("shows a toast and doesn't crash when the delete fails", async () => {
    deleteTournamentGroupActionMock.mockResolvedValueOnce({ error: "Групу не знайдено" });
    const user = userEvent.setup();
    render(<DeleteTournamentGroupButton tournamentId="t1" groupId="g1" groupName="Плейофф" />);

    await user.click(screen.getByRole("button", { name: "Видалити групу «Плейофф»" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Групу не знайдено"));
  });
});
