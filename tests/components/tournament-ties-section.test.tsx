// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TournamentTiesSection } from "@/components/tournament-ties-section";
import type { TournamentTieWithRubbers } from "@/lib/tournament-ties";

vi.mock("@/lib/actions/ties", () => ({ createTieAction: vi.fn(), deleteTieAction: vi.fn(), createRubberAction: vi.fn() }));

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
      />,
    );
    expect(screen.getByText("0 зустрічей")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Створити зустріч" })).toBeInTheDocument();
    expect(screen.getByText("Зустрічей ще не створено.")).toBeInTheDocument();
  });
});
