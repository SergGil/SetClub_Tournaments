// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteMenuItemButton } from "@/components/admin/delete-menu-item-button";
import type { deleteMenuItemAction } from "@/lib/actions/menu";

const { deleteMenuItemActionMock } = vi.hoisted(() => ({
  deleteMenuItemActionMock: vi.fn<typeof deleteMenuItemAction>().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/actions/menu", () => ({ deleteMenuItemAction: deleteMenuItemActionMock }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DeleteMenuItemButton", () => {
  it("names the item in the confirmation and submits its id", async () => {
    const user = userEvent.setup();
    render(<DeleteMenuItemButton id="i1" name="Латте" />);
    await user.click(screen.getByRole("button", { name: "Видалити напій" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Видалити напій «Латте»?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(deleteMenuItemActionMock).toHaveBeenCalled());
    const [, formData] = deleteMenuItemActionMock.mock.calls[0];
    expect(formData.get("id")).toBe("i1");
  });

  it("shows the error and keeps the dialog open on failure", async () => {
    deleteMenuItemActionMock.mockResolvedValueOnce({ error: "Напій не знайдено — можливо, його вже видалили" });
    const user = userEvent.setup();
    render(<DeleteMenuItemButton id="i1" name="Латте" />);
    await user.click(screen.getByRole("button", { name: "Видалити напій" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Видалити" }));

    expect(await screen.findByText("Напій не знайдено — можливо, його вже видалили")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("closes the dialog once the delete succeeds", async () => {
    const user = userEvent.setup();
    render(<DeleteMenuItemButton id="i1" name="Латте" />);
    await user.click(screen.getByRole("button", { name: "Видалити напій" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });
});
