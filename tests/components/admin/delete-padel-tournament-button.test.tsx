// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeletePadelTournamentButton } from "@/components/admin/delete-padel-tournament-button";
import type { deletePadelTournamentAction } from "@/lib/actions/padel-tournaments";

const { deletePadelTournamentActionMock } = vi.hoisted(() => ({
  deletePadelTournamentActionMock: vi
    .fn<typeof deletePadelTournamentAction>()
    .mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/actions/padel-tournaments", () => ({
  deletePadelTournamentAction: deletePadelTournamentActionMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DeletePadelTournamentButton (no completed matches)", () => {
  it("submits without requiring a confirm word", async () => {
    const user = userEvent.setup();
    render(<DeletePadelTournamentButton id="t1" name="Кубок" completedMatchCount={0} />);
    await user.click(screen.getByRole("button", { name: "Видалити турнір" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(screen.queryByLabelText(/ВИДАЛИТИ/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(deletePadelTournamentActionMock).toHaveBeenCalled());
    const [, formData] = deletePadelTournamentActionMock.mock.calls[0];
    expect(formData.get("id")).toBe("t1");
    expect(formData.get("acknowledgedCompletedLoss")).toBe("false");
  });
});

describe("DeletePadelTournamentButton (with completed matches)", () => {
  it("requires typing the confirm word before the delete button is enabled", async () => {
    const user = userEvent.setup();
    render(<DeletePadelTournamentButton id="t1" name="Кубок" completedMatchCount={5} />);
    await user.click(screen.getByRole("button", { name: "Видалити турнір" }));
    const dialog = await screen.findByRole("alertdialog");

    const deleteButton = within(dialog).getByRole("button", { name: "Видалити" });
    expect(deleteButton).toBeDisabled();

    await user.type(within(dialog).getByRole("textbox"), "видалити");
    expect(deleteButton).toBeEnabled();

    await user.click(deleteButton);
    await waitFor(() => expect(deletePadelTournamentActionMock).toHaveBeenCalled());
    const [, formData] = deletePadelTournamentActionMock.mock.calls[0];
    expect(formData.get("acknowledgedCompletedLoss")).toBe("true");
  });

  it("resets the typed confirm word after cancelling", async () => {
    const user = userEvent.setup();
    render(<DeletePadelTournamentButton id="t1" name="Кубок" completedMatchCount={5} />);
    await user.click(screen.getByRole("button", { name: "Видалити турнір" }));
    let dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByRole("textbox"), "ВИДАЛИТИ");
    await user.click(within(dialog).getByRole("button", { name: "Скасувати" }));

    await user.click(screen.getByRole("button", { name: "Видалити турнір" }));
    dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("textbox")).toHaveValue("");
  });
});
