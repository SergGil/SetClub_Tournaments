// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TournamentTiesSection } from "@/components/tournament-ties-section";
import type { TournamentTieWithRubbers } from "@/lib/tournament-ties";

const { deleteTieActionMock, rubberActionMock } = vi.hoisted(() => ({
  deleteTieActionMock: vi.fn(async () => ({})),
  rubberActionMock: vi.fn(async () => ({})),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function StubCreateTieDialog({ teams }: { tournamentId: string; teams: { id: string; name: string }[] }) {
  return <button disabled={teams.length < 2}>Створити зустріч</button>;
}

function tie(overrides: Partial<TournamentTieWithRubbers> = {}): TournamentTieWithRubbers {
  return {
    id: "tie1",
    label: null,
    teamA: { id: "teamA", name: "Команда А", members: [] },
    teamB: { id: "teamB", name: "Команда Б", members: [] },
    rubbers: [],
    ...overrides,
  } as TournamentTieWithRubbers;
}

describe("TournamentTiesSection (public, canManage=false)", () => {
  it("renders nothing at all with no ties - a tournament that never opted in shows literally nothing new", () => {
    const { container } = render(
      <TournamentTiesSection tournamentId="t1" ties={[]} standingsRows={[]} roundRobinDone={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the tie count and team standings once at least one tie exists", () => {
    render(
      <TournamentTiesSection
        tournamentId="t1"
        ties={[tie()]}
        standingsRows={[
          { key: "teamA", label: "Команда А", matchesPlayed: 0, wins: 0, losses: 0, winPct: 0, gamesWon: 0, gamesLost: 0, points: 0 },
        ]}
        roundRobinDone={false}
      />,
    );
    expect(screen.getByText("1 зустріч")).toBeInTheDocument();
    expect(screen.getByText("Команда А")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Створити зустріч" })).not.toBeInTheDocument();
  });
});

describe("TournamentTiesSection (admin, canManage=true)", () => {
  it("stays visible (with the create-tie control) even with zero ties, unlike the public page", () => {
    render(
      <TournamentTiesSection
        tournamentId="t1"
        ties={[]}
        standingsRows={[]}
        roundRobinDone={false}
        teams={[{ id: "teamA", name: "Команда А" }, { id: "teamB", name: "Команда Б" }]}
        canManage
        createTieDialog={StubCreateTieDialog}
      />,
    );
    expect(screen.getByText("0 зустрічей")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Створити зустріч" })).toBeInTheDocument();
    expect(screen.getByText("Зустрічей ще не створено.")).toBeInTheDocument();
  });

  it("does not show the create-tie control when no createTieDialog component is provided", () => {
    render(
      <TournamentTiesSection
        tournamentId="t1"
        ties={[]}
        standingsRows={[]}
        roundRobinDone={false}
        teams={[{ id: "teamA", name: "Команда А" }, { id: "teamB", name: "Команда Б" }]}
        canManage
      />,
    );
    expect(screen.queryByRole("button", { name: "Створити зустріч" })).not.toBeInTheDocument();
  });

  // Regression test: TournamentTiesSection is reused unchanged by both Tennis
  // and Padel pages - it must actually forward deleteTieAction/rubberAction
  // down through TieCard, not just accept them and drop them.
  it("forwards deleteTieAction down through TieCard so deleting a tie calls the sport-specific action passed in", async () => {
    const user = userEvent.setup();
    render(
      <TournamentTiesSection
        tournamentId="t1"
        ties={[tie({ label: "Тур 1" })]}
        standingsRows={[]}
        roundRobinDone={false}
        teams={[{ id: "teamA", name: "Команда А" }, { id: "teamB", name: "Команда Б" }]}
        canManage
        createTieDialog={StubCreateTieDialog}
        deleteTieAction={deleteTieActionMock}
        rubberAction={rubberActionMock}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Видалити зустріч «Тур 1»" }));
    await user.click(screen.getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(deleteTieActionMock).toHaveBeenCalledWith("t1", "tie1"));
  });
});
