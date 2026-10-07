// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    expect(pushMock).toHaveBeenCalledWith("/players/p1?opponent=p2", { scroll: false });
  });

  it("drops the query param entirely when 'Усі суперники' is picked", async () => {
    const user = userEvent.setup();
    render(<OpponentFilter opponents={opponents} selectedId="p2" />);
    await user.click(screen.getByRole("combobox", { name: "Фільтр за суперником" }));
    await user.click(await screen.findByRole("option", { name: "Усі суперники" }));
    expect(pushMock).toHaveBeenCalledWith("/players/p1", { scroll: false });
  });

  it("preserves the active result filter when the opponent changes", async () => {
    const user = userEvent.setup();
    render(<OpponentFilter opponents={opponents} selectedId="" result="win" />);
    await user.click(screen.getByRole("combobox", { name: "Фільтр за суперником" }));
    await user.click(await screen.findByRole("option", { name: "Петро" }));
    expect(pushMock).toHaveBeenCalledWith("/players/p1?opponent=p2&result=win", { scroll: false });
  });

  it("keeps the result filter (drops only the opponent) when 'Усі суперники' is picked", async () => {
    const user = userEvent.setup();
    render(<OpponentFilter opponents={opponents} selectedId="p2" result="loss" />);
    await user.click(screen.getByRole("combobox", { name: "Фільтр за суперником" }));
    await user.click(await screen.findByRole("option", { name: "Усі суперники" }));
    expect(pushMock).toHaveBeenCalledWith("/players/p1?result=loss", { scroll: false });
  });

  it("preserves the active type/year filters when the opponent changes", async () => {
    const user = userEvent.setup();
    render(<OpponentFilter opponents={opponents} selectedId="" result="win" type="SINGLES" year={2025} />);
    await user.click(screen.getByRole("combobox", { name: "Фільтр за суперником" }));
    await user.click(await screen.findByRole("option", { name: "Петро" }));
    expect(pushMock).toHaveBeenCalledWith("/players/p1?opponent=p2&result=win&type=SINGLES&year=2025", { scroll: false });
  });

  it("preserves the active tournament filter when the opponent changes", async () => {
    const user = userEvent.setup();
    render(<OpponentFilter opponents={opponents} selectedId="" tournament="t1" />);
    await user.click(screen.getByRole("combobox", { name: "Фільтр за суперником" }));
    await user.click(await screen.findByRole("option", { name: "Петро" }));
    expect(pushMock).toHaveBeenCalledWith("/players/p1?opponent=p2&tournament=t1", { scroll: false });
  });

  it("filters the option list by the search box", async () => {
    const user = userEvent.setup();
    render(<OpponentFilter opponents={opponents} selectedId="" />);
    await user.click(screen.getByRole("combobox", { name: "Фільтр за суперником" }));
    // findByPlaceholderText, not getByPlaceholderText: the popup (and its
    // search input) mounts in a portal asynchronously after the trigger
    // click, not synchronously within it - a bare getBy* here occasionally
    // lost that race under a heavily loaded parallel test run (same root
    // cause fixed elsewhere this session - see docs/CHANGELOG.md).
    // fireEvent.change, not user.type: the test is about the filtering, and
    // typing key-by-key into the autoFocus input could drop characters when
    // focus shifted during the popup's positioning pass under load.
    fireEvent.change(await screen.findByPlaceholderText("Пошук…"), { target: { value: "Оле" } });
    expect(await screen.findByRole("option", { name: "Олег" })).toBeInTheDocument();
    // "Олег" was already listed before the search applied, so finding it
    // proves nothing about the filter - wait for "Петро" to actually drop out
    // instead of asserting its absence in the same instant.
    await waitFor(() => expect(screen.queryByRole("option", { name: "Петро" })).not.toBeInTheDocument());
  });
});
