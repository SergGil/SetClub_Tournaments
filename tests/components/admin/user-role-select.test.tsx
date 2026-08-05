// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserRoleSelect } from "@/components/admin/user-role-select";

const { updateUserRoleActionMock } = vi.hoisted(() => ({
  updateUserRoleActionMock: vi.fn(async () => undefined),
}));
vi.mock("@/lib/actions/users", () => ({ updateUserRoleAction: updateUserRoleActionMock }));

const { toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: toastSuccessMock } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UserRoleSelect", () => {
  it("disables the select and explains why when the admin can't change their own role", () => {
    render(<UserRoleSelect userId="u1" userLabel="Іван" role="ADMIN" disabled />);
    expect(screen.getByRole("combobox", { name: "Роль користувача" })).toBeDisabled();
  });

  it("demotes an admin to member directly, without a confirmation step", async () => {
    const user = userEvent.setup();
    render(<UserRoleSelect userId="u1" userLabel="Іван" role="ADMIN" />);
    await user.click(screen.getByRole("combobox", { name: "Роль користувача" }));
    await user.click(await screen.findByRole("option", { name: "Учасник" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(updateUserRoleActionMock).toHaveBeenCalledWith("u1", "MEMBER"));
    expect(toastSuccessMock).toHaveBeenCalledWith('Роль користувача «Іван» змінено на «Учасник»');
  });

  it("requires confirming before promoting a member to admin", async () => {
    const user = userEvent.setup();
    render(<UserRoleSelect userId="u1" userLabel="Іван" role="MEMBER" />);
    await user.click(screen.getByRole("combobox", { name: "Роль користувача" }));
    await user.click(await screen.findByRole("option", { name: "Адмін" }));

    expect(updateUserRoleActionMock).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Надати права адміна" }));

    await waitFor(() => expect(updateUserRoleActionMock).toHaveBeenCalledWith("u1", "ADMIN"));
    expect(dialog).not.toBeInTheDocument();
  });

  it("shows a toast with the server's message when the update fails", async () => {
    updateUserRoleActionMock.mockRejectedValueOnce(new Error("Не можна змінити власну роль"));
    const user = userEvent.setup();
    render(<UserRoleSelect userId="u1" userLabel="Іван" role="ADMIN" />);
    await user.click(screen.getByRole("combobox", { name: "Роль користувача" }));
    await user.click(await screen.findByRole("option", { name: "Учасник" }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Не можна змінити власну роль"));
  });
});
