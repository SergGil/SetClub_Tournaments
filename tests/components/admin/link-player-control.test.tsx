// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LinkPlayerControl } from "@/components/admin/link-player-control";
import type { linkPlayerAction } from "@/lib/actions/players";

const { linkPlayerActionMock } = vi.hoisted(() => ({
  linkPlayerActionMock: vi.fn<typeof linkPlayerAction>().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/actions/players", () => ({ linkPlayerAction: linkPlayerActionMock }));

beforeEach(() => {
  vi.clearAllMocks();
});

const candidates = [
  { id: "u1", name: "Іван Петренко", email: "ivan@test.com" },
  { id: "u2", name: null, email: "petro@test.com" },
];

describe("LinkPlayerControl", () => {
  it("shows a message instead of a picker when there are no unlinked accounts", () => {
    render(<LinkPlayerControl playerId="p1" candidates={[]} />);
    expect(screen.getByText("Немає незв'язаних акаунтів")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("falls back to email when a candidate has no name", async () => {
    const user = userEvent.setup();
    render(<LinkPlayerControl playerId="p1" candidates={candidates} />);
    await user.click(screen.getByRole("combobox", { name: "Обрати акаунт" }));
    expect(screen.getByRole("option", { name: "petro@test.com" })).toBeInTheDocument();
  });

  it("disables the link button until an account is picked, then submits both ids", async () => {
    const user = userEvent.setup();
    render(<LinkPlayerControl playerId="p1" candidates={candidates} />);
    expect(screen.getByRole("button", { name: "Прив'язати" })).toBeDisabled();

    await user.click(screen.getByRole("combobox", { name: "Обрати акаунт" }));
    await user.click(screen.getByRole("option", { name: "Іван Петренко" }));
    expect(screen.getByRole("button", { name: "Прив'язати" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Прив'язати" }));
    const [, formData] = linkPlayerActionMock.mock.calls[0];
    expect(formData.get("playerId")).toBe("p1");
    expect(formData.get("userId")).toBe("u1");
  });

  it("filters candidates by the search box", async () => {
    const user = userEvent.setup();
    render(<LinkPlayerControl playerId="p1" candidates={candidates} />);
    await user.click(screen.getByRole("combobox", { name: "Обрати акаунт" }));
    await user.type(screen.getByPlaceholderText("Пошук…"), "Іван");
    expect(screen.getByRole("option", { name: "Іван Петренко" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "petro@test.com" })).not.toBeInTheDocument();
  });
});
