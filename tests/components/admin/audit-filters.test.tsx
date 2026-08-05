// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuditFilters } from "@/components/admin/audit-filters";

const { pushMock, usePathnameMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  usePathnameMock: vi.fn(() => "/admin/audit"),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: usePathnameMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuditFilters", () => {
  it("hides the reset button with no filter active", () => {
    render(<AuditFilters actors={["Admin"]} />);
    expect(screen.queryByRole("button", { name: /Скинути фільтри/ })).not.toBeInTheDocument();
  });

  it("pushes the actor as a query param, preserving the current action filter", async () => {
    const user = userEvent.setup();
    render(<AuditFilters actors={["Admin", "Coach"]} selectedAction="match.create" />);
    await user.click(screen.getByRole("combobox", { name: "Фільтр за автором" }));
    await user.click(await screen.findByRole("option", { name: "Coach" }));

    expect(pushMock).toHaveBeenCalledWith("/admin/audit?actor=Coach&action=match.create");
  });

  it("drops the action param entirely when 'Усі дії' is picked", async () => {
    const user = userEvent.setup();
    render(<AuditFilters actors={["Admin"]} selectedActor="Admin" selectedAction="match.create" />);
    await user.click(screen.getByRole("combobox", { name: "Фільтр за типом дії" }));
    await user.click(await screen.findByRole("option", { name: "Усі дії" }));

    expect(pushMock).toHaveBeenCalledWith("/admin/audit?actor=Admin");
  });

  it("resets by pushing the bare pathname", async () => {
    const user = userEvent.setup();
    render(<AuditFilters actors={["Admin"]} selectedActor="Admin" />);
    await user.click(screen.getByRole("button", { name: /Скинути фільтри/ }));
    expect(pushMock).toHaveBeenCalledWith("/admin/audit");
  });
});
