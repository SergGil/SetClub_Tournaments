// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TournamentFilter } from "@/components/tournament-filter";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/players/p1",
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const tournaments = [
  { id: "t1", name: "Літній кубок" },
  { id: "t2", name: "Зимова ліга" },
];

describe("TournamentFilter", () => {
  it("adds the tournament id as a query param", async () => {
    const user = userEvent.setup();
    render(<TournamentFilter tournaments={tournaments} selectedId="" />);
    await user.click(screen.getByRole("combobox", { name: "Фільтр за турніром" }));
    await user.click(await screen.findByRole("option", { name: "Літній кубок" }));
    expect(pushMock).toHaveBeenCalledWith("/players/p1?tournament=t1");
  });

  it("drops the query param entirely when 'Усі турніри' is picked", async () => {
    const user = userEvent.setup();
    render(<TournamentFilter tournaments={tournaments} selectedId="t1" />);
    await user.click(screen.getByRole("combobox", { name: "Фільтр за турніром" }));
    await user.click(await screen.findByRole("option", { name: "Усі турніри" }));
    expect(pushMock).toHaveBeenCalledWith("/players/p1");
  });

  it("preserves the active opponent/result/type/year filters when the tournament changes", async () => {
    const user = userEvent.setup();
    render(
      <TournamentFilter
        tournaments={tournaments}
        selectedId=""
        opponent="p2"
        result="win"
        type="SINGLES"
        year={2025}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Фільтр за турніром" }));
    await user.click(await screen.findByRole("option", { name: "Літній кубок" }));
    expect(pushMock).toHaveBeenCalledWith("/players/p1?opponent=p2&tournament=t1&result=win&type=SINGLES&year=2025");
  });

  it("filters the option list by the search box", async () => {
    const user = userEvent.setup();
    render(<TournamentFilter tournaments={tournaments} selectedId="" />);
    await user.click(screen.getByRole("combobox", { name: "Фільтр за турніром" }));
    await user.type(await screen.findByPlaceholderText("Пошук…"), "Зим");
    expect(await screen.findByRole("option", { name: "Зимова ліга" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Літній кубок" })).not.toBeInTheDocument();
  });
});
