// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteMenuSectionButton } from "@/components/admin/delete-menu-section-button";
import type { deleteMenuSectionAction } from "@/lib/actions/menu";

const { deleteMenuSectionActionMock } = vi.hoisted(() => ({
  deleteMenuSectionActionMock: vi.fn<typeof deleteMenuSectionAction>().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/actions/menu", () => ({ deleteMenuSectionAction: deleteMenuSectionActionMock }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DeleteMenuSectionButton", () => {
  it("warns about cascading item deletion when the section has items", async () => {
    const user = userEvent.setup();
    render(<DeleteMenuSectionButton id="sec1" name="Кава" itemCount={3} />);
    await user.click(screen.getByRole("button", { name: "Видалити секцію" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Видалити секцію «Кава»?")).toBeInTheDocument();
    expect(within(dialog).getByText(/Разом з нею видаляться всі 3 напої/)).toBeInTheDocument();
  });

  it("doesn't mention items when the section is empty", async () => {
    const user = userEvent.setup();
    render(<DeleteMenuSectionButton id="sec1" name="Порожня" itemCount={0} />);
    await user.click(screen.getByRole("button", { name: "Видалити секцію" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).queryByText(/видаляться/)).not.toBeInTheDocument();
  });

  it("submits the section id and closes on success", async () => {
    const user = userEvent.setup();
    render(<DeleteMenuSectionButton id="sec1" name="Кава" itemCount={1} />);
    await user.click(screen.getByRole("button", { name: "Видалити секцію" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(deleteMenuSectionActionMock).toHaveBeenCalled());
    const [, formData] = deleteMenuSectionActionMock.mock.calls[0];
    expect(formData.get("id")).toBe("sec1");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("shows the error and keeps the dialog open on failure", async () => {
    deleteMenuSectionActionMock.mockResolvedValueOnce({ error: "Секцію не знайдено — можливо, її вже видалили" });
    const user = userEvent.setup();
    render(<DeleteMenuSectionButton id="sec1" name="Кава" itemCount={1} />);
    await user.click(screen.getByRole("button", { name: "Видалити секцію" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Видалити" }));

    expect(await screen.findByText("Секцію не знайдено — можливо, її вже видалили")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
