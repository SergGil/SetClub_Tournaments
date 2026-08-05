// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteNewsButton } from "@/components/admin/delete-news-button";
import type { deleteNewsPostAction } from "@/lib/actions/news";

const { deleteNewsPostActionMock } = vi.hoisted(() => ({
  deleteNewsPostActionMock: vi.fn<typeof deleteNewsPostAction>().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/actions/news", () => ({ deleteNewsPostAction: deleteNewsPostActionMock }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DeleteNewsButton", () => {
  it("names the post in the confirmation and submits its id", async () => {
    const user = userEvent.setup();
    render(<DeleteNewsButton id="n1" title="Новий сезон" />);
    await user.click(screen.getByRole("button", { name: "Видалити" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Видалити новину «Новий сезон»?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(deleteNewsPostActionMock).toHaveBeenCalled());
    const [, formData] = deleteNewsPostActionMock.mock.calls[0];
    expect(formData.get("id")).toBe("n1");
  });

  it("shows the error and keeps the dialog open on failure", async () => {
    deleteNewsPostActionMock.mockResolvedValueOnce({ error: "Новину не знайдено — можливо, її вже видалили" });
    const user = userEvent.setup();
    render(<DeleteNewsButton id="n1" title="Новий сезон" />);
    await user.click(screen.getByRole("button", { name: "Видалити" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Видалити" }));

    expect(await screen.findByText("Новину не знайдено — можливо, її вже видалили")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("closes the dialog once the delete succeeds", async () => {
    const user = userEvent.setup();
    render(<DeleteNewsButton id="n1" title="Новий сезон" />);
    await user.click(screen.getByRole("button", { name: "Видалити" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });
});
