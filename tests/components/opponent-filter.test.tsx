// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OpponentFilter } from "@/components/opponent-filter";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/players/p1",
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const opponents = [
  { id: "p2", name: "Петро" },
  { id: "p3", name: "Олег" },
];

describe("OpponentFilter", () => {
  it("adds the opponent id as a query param", async () => {
    const user = userEvent.setup();
    render(<OpponentFilter opponents={opponents} selectedId="" />);
    await user.click(screen.getByRole("combobox", { name: "Фільтр за суперником" }));
    // The popup's positioning settles asynchronously (a floating-ui measure
    // pass) - findByRole (polls) rather than getByRole (one-shot) right
    // after opening avoids a race against that settle.
    await user.click(await screen.findByRole("option", { name: "Петро" }));
    expect(pushMock).toHaveBeenCalledWith("/players/p1?opponent=p2");
  });

  it("drops the query param entirely when 'Усі суперники' is picked", async () => {
    const user = userEvent.setup();
    render(<OpponentFilter opponents={opponents} selectedId="p2" />);
    await user.click(screen.getByRole("combobox", { name: "Фільтр за суперником" }));
    await user.click(await screen.findByRole("option", { name: "Усі суперники" }));
    expect(pushMock).toHaveBeenCalledWith("/players/p1");
  });

  it("filters the option list by the search box", async () => {
    const user = userEvent.setup();
    render(<OpponentFilter opponents={opponents} selectedId="" />);
    await user.click(screen.getByRole("combobox", { name: "Фільтр за суперником" }));
    await user.type(screen.getByPlaceholderText("Пошук…"), "Оле");
    expect(await screen.findByRole("option", { name: "Олег" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Петро" })).not.toBeInTheDocument();
  });
});
