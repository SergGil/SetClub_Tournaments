// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlayerCompareForm } from "@/components/player-compare-form";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/rating/compare",
}));

const players = [
  { id: "p1", name: "Іван Петренко" },
  { id: "p2", name: "Олег Коваль" },
  { id: "p3", name: "Марія Шевчук" },
];

beforeEach(() => vi.clearAllMocks());

describe("PlayerCompareForm", () => {
  it("shows the placeholder labels when nothing is picked and the chosen names otherwise", () => {
    const { rerender } = render(<PlayerCompareForm players={players} selectedA="" selectedB="" format="singles" />);
    expect(screen.getByRole("combobox", { name: "Гравець 1" })).toHaveTextContent("Гравець 1");
    expect(screen.getByRole("combobox", { name: "Гравець 2" })).toHaveTextContent("Гравець 2");

    rerender(<PlayerCompareForm players={players} selectedA="p1" selectedB="p2" format="singles" />);
    expect(screen.getByRole("combobox", { name: "Гравець 1" })).toHaveTextContent("Іван Петренко");
    expect(screen.getByRole("combobox", { name: "Гравець 2" })).toHaveTextContent("Олег Коваль");
  });

  it("navigates with the picked player as ?a= and keeps the other one", async () => {
    const user = userEvent.setup();
    render(<PlayerCompareForm players={players} selectedA="" selectedB="p2" format="singles" />);
    await user.click(screen.getByRole("combobox", { name: "Гравець 1" }));
    await user.click(await screen.findByRole("option", { name: "Марія Шевчук" }));
    expect(pushMock).toHaveBeenCalledWith("/rating/compare?a=p3&b=p2", { scroll: false });
  });

  it("can't compare a player with themselves: the other select's pick is not offered", async () => {
    const user = userEvent.setup();
    render(<PlayerCompareForm players={players} selectedA="p1" selectedB="" format="singles" />);
    await user.click(screen.getByRole("combobox", { name: "Гравець 2" }));
    await screen.findByRole("option", { name: "Олег Коваль" });
    expect(screen.queryByRole("option", { name: "Іван Петренко" })).not.toBeInTheDocument();
  });

  it("keeps the doubles format and the women's pool in the URL", async () => {
    const user = userEvent.setup();
    render(<PlayerCompareForm players={players} selectedA="" selectedB="" format="doubles" pool="women" />);
    await user.click(screen.getByRole("combobox", { name: "Гравець 1" }));
    await user.click(await screen.findByRole("option", { name: "Олег Коваль" }));
    expect(pushMock).toHaveBeenCalledWith("/rating/compare?a=p2&format=doubles&pool=women", { scroll: false });
  });

  it("clearing a pick drops its param (and the bare path when nothing is left)", async () => {
    const user = userEvent.setup();
    render(<PlayerCompareForm players={players} selectedA="p1" selectedB="" format="singles" />);
    await user.click(screen.getByRole("combobox", { name: "Гравець 1" }));
    await user.click(await screen.findByRole("option", { name: "Гравець 1" }));
    expect(pushMock).toHaveBeenCalledWith("/rating/compare", { scroll: false });
  });

  it("filters the list by the search box and says so when nothing matches", async () => {
    const user = userEvent.setup();
    render(<PlayerCompareForm players={players} selectedA="" selectedB="" format="singles" />);
    await user.click(screen.getByRole("combobox", { name: "Гравець 1" }));
    const search = await screen.findByPlaceholderText("Пошук…");

    fireEvent.change(search, { target: { value: "коваль" } });
    expect(await screen.findByRole("option", { name: "Олег Коваль" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Марія Шевчук" })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "zzz" } });
    expect(await screen.findByText("Нічого не знайдено")).toBeInTheDocument();
  });
});
