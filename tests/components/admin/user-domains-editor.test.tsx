// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserDomainsEditor } from "@/components/admin/user-domains-editor";

const { updateUserDomainsActionMock } = vi.hoisted(() => ({
  updateUserDomainsActionMock: vi.fn(async () => undefined),
}));
vi.mock("@/lib/actions/users", () => ({ updateUserDomainsAction: updateUserDomainsActionMock }));

const { toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: toastSuccessMock } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UserDomainsEditor", () => {
  it("collapses to a single 'assign a domain' button for an admin with no domains yet", () => {
    render(<UserDomainsEditor userId="u1" userLabel="Іван" domains={[]} />);
    expect(screen.getByRole("button", { name: /Призначити розділ/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Теніс" })).not.toBeInTheDocument();
  });

  it("expands to the three domain toggles on click, revealing current state", async () => {
    const user = userEvent.setup();
    render(<UserDomainsEditor userId="u1" userLabel="Іван" domains={[]} />);
    await user.click(screen.getByRole("button", { name: /Призначити розділ/ }));

    for (const label of ["Теніс", "Кава", "Падел"]) {
      const button = screen.getByRole("button", { name: label });
      expect(button).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("shows already-assigned domains expanded and pressed by default", () => {
    render(<UserDomainsEditor userId="u1" userLabel="Іван" domains={["TENNIS", "COFFEE"]} />);
    expect(screen.getByRole("button", { name: "Теніс" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Кава" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Падел" })).toHaveAttribute("aria-pressed", "false");
  });

  it("toggling a domain calls the action with the updated full set and toasts success", async () => {
    const user = userEvent.setup();
    render(<UserDomainsEditor userId="u1" userLabel="Іван" domains={["TENNIS"]} />);
    await user.click(screen.getByRole("button", { name: "Кава" }));

    await waitFor(() =>
      expect(updateUserDomainsActionMock).toHaveBeenCalledWith("u1", ["TENNIS", "COFFEE"]),
    );
    expect(toastSuccessMock).toHaveBeenCalledWith("Адмін-розділи «Іван» оновлено");
  });

  it("toggling an already-assigned domain off removes just that one", async () => {
    const user = userEvent.setup();
    render(<UserDomainsEditor userId="u1" userLabel="Іван" domains={["TENNIS", "COFFEE"]} />);
    await user.click(screen.getByRole("button", { name: "Теніс" }));

    await waitFor(() => expect(updateUserDomainsActionMock).toHaveBeenCalledWith("u1", ["COFFEE"]));
  });

  it("shows a toast with the server's message when the update fails", async () => {
    updateUserDomainsActionMock.mockRejectedValueOnce(new Error("Forbidden"));
    const user = userEvent.setup();
    render(<UserDomainsEditor userId="u1" userLabel="Іван" domains={["TENNIS"]} />);
    await user.click(screen.getByRole("button", { name: "Падел" }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Forbidden"));
  });
});
