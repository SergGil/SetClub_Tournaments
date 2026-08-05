// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteMatchButton } from "@/components/admin/delete-match-button";
import type { deleteMatchAction } from "@/lib/actions/matches";

const { deleteMatchActionMock } = vi.hoisted(() => ({
  deleteMatchActionMock: vi.fn<typeof deleteMatchAction>().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/actions/matches", () => ({ deleteMatchAction: deleteMatchActionMock }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DeleteMatchButton", () => {
  it("asks for confirmation before submitting the matchId", async () => {
    const user = userEvent.setup();
    render(<DeleteMatchButton matchId="m1" />);
    await user.click(screen.getByRole("button", { name: "Видалити матч" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Видалити матч?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(deleteMatchActionMock).toHaveBeenCalled());
    const [, formData] = deleteMatchActionMock.mock.calls[0];
    expect(formData.get("matchId")).toBe("m1");
  });

  it("shows the error and keeps the dialog open on failure", async () => {
    deleteMatchActionMock.mockResolvedValueOnce({ error: "Матч не знайдено — можливо, його вже видалили" });
    const user = userEvent.setup();
    render(<DeleteMatchButton matchId="m1" />);
    await user.click(screen.getByRole("button", { name: "Видалити матч" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Видалити" }));

    expect(await screen.findByText("Матч не знайдено — можливо, його вже видалили")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("closes the dialog once the delete succeeds", async () => {
    const user = userEvent.setup();
    render(<DeleteMatchButton matchId="m1" />);
    await user.click(screen.getByRole("button", { name: "Видалити матч" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });
});
