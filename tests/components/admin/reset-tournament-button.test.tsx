// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResetTournamentButton } from "@/components/admin/reset-tournament-button";
import type { resetTournamentAction } from "@/lib/actions/tournaments";

const { resetTournamentActionMock } = vi.hoisted(() => ({
  resetTournamentActionMock: vi.fn<typeof resetTournamentAction>().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/actions/tournaments", () => ({ resetTournamentAction: resetTournamentActionMock }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ResetTournamentButton (no completed matches)", () => {
  it("submits without requiring a confirm word", async () => {
    const user = userEvent.setup();
    render(<ResetTournamentButton id="t1" name="Кубок" completedMatchCount={0} />);
    await user.click(screen.getByRole("button", { name: "Обнулити турнір" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(screen.queryByLabelText(/ВИДАЛИТИ/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Обнулити" }));

    await waitFor(() => expect(resetTournamentActionMock).toHaveBeenCalled());
    const [, formData] = resetTournamentActionMock.mock.calls[0];
    expect(formData.get("id")).toBe("t1");
    expect(formData.get("acknowledgedCompletedLoss")).toBe("false");
  });

  it("disables the trigger when there is nothing to reset", () => {
    render(<ResetTournamentButton id="t1" name="Кубок" completedMatchCount={0} disabled />);
    expect(screen.getByRole("button", { name: "Обнулити турнір" })).toBeDisabled();
  });

  it("closes the dialog once the reset succeeds (no redirect happens to do it for us)", async () => {
    const user = userEvent.setup();
    render(<ResetTournamentButton id="t1" name="Кубок" completedMatchCount={0} />);
    await user.click(screen.getByRole("button", { name: "Обнулити турнір" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Обнулити" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });
});

describe("ResetTournamentButton (with completed matches)", () => {
  it("requires typing the confirm word before the reset button is enabled", async () => {
    const user = userEvent.setup();
    render(<ResetTournamentButton id="t1" name="Кубок" completedMatchCount={5} />);
    await user.click(screen.getByRole("button", { name: "Обнулити турнір" }));
    const dialog = await screen.findByRole("alertdialog");

    const resetButton = within(dialog).getByRole("button", { name: "Обнулити" });
    expect(resetButton).toBeDisabled();

    await user.type(within(dialog).getByRole("textbox"), "видалити");
    expect(resetButton).toBeEnabled();

    await user.click(resetButton);
    await waitFor(() => expect(resetTournamentActionMock).toHaveBeenCalled());
    const [, formData] = resetTournamentActionMock.mock.calls[0];
    expect(formData.get("acknowledgedCompletedLoss")).toBe("true");
  });
});
