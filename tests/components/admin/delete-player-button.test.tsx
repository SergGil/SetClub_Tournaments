// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeletePlayerButton } from "@/components/admin/delete-player-button";
import type { deletePlayerAction } from "@/lib/actions/players";

const { deletePlayerActionMock } = vi.hoisted(() => ({
  deletePlayerActionMock: vi.fn<typeof deletePlayerAction>().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/actions/players", () => ({ deletePlayerAction: deletePlayerActionMock }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DeletePlayerButton", () => {
  it("disables the trigger for a player with match/tournament history", () => {
    render(<DeletePlayerButton id="p1" name="Іван" hasHistory={true} />);
    expect(screen.getByRole("button", { name: "Видалити" })).toBeDisabled();
  });

  it("names the player in the confirmation and submits their id", async () => {
    const user = userEvent.setup();
    render(<DeletePlayerButton id="p1" name="Іван" hasHistory={false} />);
    await user.click(screen.getByRole("button", { name: "Видалити" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Видалити гравця Іван?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(deletePlayerActionMock).toHaveBeenCalled());
    const [, formData] = deletePlayerActionMock.mock.calls[0];
    expect(formData.get("id")).toBe("p1");
  });

  it("shows the error and keeps the dialog open on failure", async () => {
    deletePlayerActionMock.mockResolvedValueOnce({
      error: "Гравця не можна видалити — він має історію матчів чи турнірів.",
    });
    const user = userEvent.setup();
    render(<DeletePlayerButton id="p1" name="Іван" hasHistory={false} />);
    await user.click(screen.getByRole("button", { name: "Видалити" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Видалити" }));

    expect(
      await screen.findByText("Гравця не можна видалити — він має історію матчів чи турнірів."),
    ).toBeInTheDocument();
  });
});
