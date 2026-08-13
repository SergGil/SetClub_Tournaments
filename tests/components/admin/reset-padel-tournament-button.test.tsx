// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResetPadelTournamentButton } from "@/components/admin/reset-padel-tournament-button";
import type { resetPadelTournamentAction } from "@/lib/actions/padel-tournaments";

const { resetPadelTournamentActionMock } = vi.hoisted(() => ({
  resetPadelTournamentActionMock: vi
    .fn<typeof resetPadelTournamentAction>()
    .mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/actions/padel-tournaments", () => ({
  resetPadelTournamentAction: resetPadelTournamentActionMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ResetPadelTournamentButton (no completed matches)", () => {
  it("submits without requiring a confirm word", async () => {
    const user = userEvent.setup();
    render(<ResetPadelTournamentButton id="t1" name="Кубок" completedMatchCount={0} />);
    await user.click(screen.getByRole("button", { name: "Обнулити турнір" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(screen.queryByLabelText(/ВИДАЛИТИ/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Обнулити" }));

    await waitFor(() => expect(resetPadelTournamentActionMock).toHaveBeenCalled());
    const [, formData] = resetPadelTournamentActionMock.mock.calls[0];
    expect(formData.get("id")).toBe("t1");
    expect(formData.get("acknowledgedCompletedLoss")).toBe("false");
  });

  it("disables the trigger when there is nothing to reset", () => {
    render(<ResetPadelTournamentButton id="t1" name="Кубок" completedMatchCount={0} disabled />);
    expect(screen.getByRole("button", { name: "Обнулити турнір" })).toBeDisabled();
  });

  it("closes the dialog once the reset succeeds (no redirect happens to do it for us)", async () => {
    const user = userEvent.setup();
    render(<ResetPadelTournamentButton id="t1" name="Кубок" completedMatchCount={0} />);
    await user.click(screen.getByRole("button", { name: "Обнулити турнір" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Обнулити" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });
});

describe("ResetPadelTournamentButton (with completed matches)", () => {
  it("requires typing the confirm word before the reset button is enabled", async () => {
    const user = userEvent.setup();
    render(<ResetPadelTournamentButton id="t1" name="Кубок" completedMatchCount={5} />);
    await user.click(screen.getByRole("button", { name: "Обнулити турнір" }));
    const dialog = await screen.findByRole("alertdialog");

    const resetButton = within(dialog).getByRole("button", { name: "Обнулити" });
    expect(resetButton).toBeDisabled();

    await user.type(within(dialog).getByRole("textbox"), "видалити");
    expect(resetButton).toBeEnabled();

    await user.click(resetButton);
    await waitFor(() => expect(resetPadelTournamentActionMock).toHaveBeenCalled());
    const [, formData] = resetPadelTournamentActionMock.mock.calls[0];
    expect(formData.get("acknowledgedCompletedLoss")).toBe("true");
  });
});
