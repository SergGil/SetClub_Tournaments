// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UnlinkPlayerButton } from "@/components/admin/unlink-player-button";
import type { unlinkPlayerAction } from "@/lib/actions/players";

const { unlinkPlayerActionMock } = vi.hoisted(() => ({
  unlinkPlayerActionMock: vi.fn<typeof unlinkPlayerAction>().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/actions/players", () => ({ unlinkPlayerAction: unlinkPlayerActionMock }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UnlinkPlayerButton", () => {
  it("names the player in the confirmation and submits their id", async () => {
    const user = userEvent.setup();
    render(<UnlinkPlayerButton playerId="p1" name="Іван" />);
    await user.click(screen.getByRole("button", { name: "Відв'язати" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Відв'язати акаунт від гравця Іван?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Відв'язати" }));

    await waitFor(() => expect(unlinkPlayerActionMock).toHaveBeenCalled());
    const [, formData] = unlinkPlayerActionMock.mock.calls[0];
    expect(formData.get("id")).toBe("p1");
  });

  it("shows the error and keeps the dialog open on failure", async () => {
    unlinkPlayerActionMock.mockResolvedValueOnce({ error: "Гравця не знайдено — можливо, його вже видалили" });
    const user = userEvent.setup();
    render(<UnlinkPlayerButton playerId="p1" name="Іван" />);
    await user.click(screen.getByRole("button", { name: "Відв'язати" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Відв'язати" }));

    expect(await screen.findByText("Гравця не знайдено — можливо, його вже видалили")).toBeInTheDocument();
  });

  it("closes the dialog once the unlink succeeds", async () => {
    const user = userEvent.setup();
    render(<UnlinkPlayerButton playerId="p1" name="Іван" />);
    await user.click(screen.getByRole("button", { name: "Відв'язати" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Відв'язати" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });
});
