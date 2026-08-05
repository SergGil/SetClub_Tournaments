// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignOutButton } from "@/components/sign-out-button";

const { signOutActionMock } = vi.hoisted(() => ({ signOutActionMock: vi.fn() }));
vi.mock("@/lib/actions/auth", () => ({ signOutAction: signOutActionMock }));

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SignOutButton", () => {
  it("asks for confirmation before signing out", async () => {
    signOutActionMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SignOutButton />);
    await user.click(screen.getByRole("button", { name: "Вийти" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Вийти з акаунту?")).toBeInTheDocument();
  });

  it("shows a toast and re-enables the button when sign-out genuinely fails", async () => {
    signOutActionMock.mockRejectedValueOnce(new Error("network down"));
    const user = userEvent.setup();
    render(<SignOutButton />);
    await user.click(screen.getByRole("button", { name: "Вийти" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Вийти" }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Не вдалося вийти з акаунту"));
    expect(within(dialog).getByRole("button", { name: "Вийти" })).toBeEnabled();
  });
});
