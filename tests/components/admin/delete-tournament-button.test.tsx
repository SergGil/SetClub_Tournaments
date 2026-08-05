// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteTournamentButton } from "@/components/admin/delete-tournament-button";
import type { deleteTournamentAction } from "@/lib/actions/tournaments";

const { deleteTournamentActionMock } = vi.hoisted(() => ({
  deleteTournamentActionMock: vi.fn<typeof deleteTournamentAction>().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/actions/tournaments", () => ({ deleteTournamentAction: deleteTournamentActionMock }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DeleteTournamentButton (no completed matches)", () => {
  it("submits without requiring a confirm word", async () => {
    const user = userEvent.setup();
    render(<DeleteTournamentButton id="t1" name="Кубок" completedMatchCount={0} />);
    await user.click(screen.getByRole("button", { name: "Видалити турнір" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(screen.queryByLabelText(/ВИДАЛИТИ/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(deleteTournamentActionMock).toHaveBeenCalled());
    const [, formData] = deleteTournamentActionMock.mock.calls[0];
    expect(formData.get("id")).toBe("t1");
    expect(formData.get("acknowledgedCompletedLoss")).toBe("false");
  });
});

describe("DeleteTournamentButton (with completed matches)", () => {
  it("requires typing the confirm word before the delete button is enabled", async () => {
    const user = userEvent.setup();
    render(<DeleteTournamentButton id="t1" name="Кубок" completedMatchCount={5} />);
    await user.click(screen.getByRole("button", { name: "Видалити турнір" }));
    const dialog = await screen.findByRole("alertdialog");

    const deleteButton = within(dialog).getByRole("button", { name: "Видалити" });
    expect(deleteButton).toBeDisabled();

    await user.type(within(dialog).getByRole("textbox"), "видалити");
    expect(deleteButton).toBeEnabled();

    await user.click(deleteButton);
    await waitFor(() => expect(deleteTournamentActionMock).toHaveBeenCalled());
    const [, formData] = deleteTournamentActionMock.mock.calls[0];
    expect(formData.get("acknowledgedCompletedLoss")).toBe("true");
  });

  it("resets the typed confirm word after cancelling", async () => {
    const user = userEvent.setup();
    render(<DeleteTournamentButton id="t1" name="Кубок" completedMatchCount={5} />);
    await user.click(screen.getByRole("button", { name: "Видалити турнір" }));
    let dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByRole("textbox"), "ВИДАЛИТИ");
    await user.click(within(dialog).getByRole("button", { name: "Скасувати" }));

    await user.click(screen.getByRole("button", { name: "Видалити турнір" }));
    dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("textbox")).toHaveValue("");
  });
});
