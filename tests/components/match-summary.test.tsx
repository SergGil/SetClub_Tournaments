// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MatchSummary } from "@/components/match-summary";
import type { MatchWithDetails } from "@/lib/queries/matches";

function playerRow(
  side: "A" | "B",
  id: string,
  name: string,
  nickname: string | null = null,
  gender: "MALE" | "FEMALE" | null = null,
) {
  return {
    id: `${side}-${id}`,
    matchId: "m1",
    side,
    playerId: id,
    player: { id, name, nickname, gender, user: null },
  };
}

function buildMatch(overrides: Partial<MatchWithDetails> = {}): MatchWithDetails {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "m1",
    tournamentId: "t1",
    matchType: "SINGLES",
    round: null,
    scheduledDate: null,
    status: "SCHEDULED",
    winnerSide: null,
    retired: false,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    tournament: { id: "t1", name: "Літній кубок" },
    sets: [],
    players: [playerRow("A", "p1", "Іван"), playerRow("B", "p2", "Петро")],
    ...overrides,
  } as MatchWithDetails;
}

describe("MatchSummary (status badge)", () => {
  it("shows a plain 'completed' badge with no perspective player", () => {
    render(<MatchSummary match={buildMatch({ status: "COMPLETED", winnerSide: "A" })} />);
    expect(screen.getByText("Завершено")).toBeInTheDocument();
  });

  it("shows a win/loss badge from the given perspective player", () => {
    const { rerender } = render(
      <MatchSummary match={buildMatch({ status: "COMPLETED", winnerSide: "A" })} perspectivePlayerId="p1" />,
    );
    expect(screen.getByText("Перемога")).toBeInTheDocument();

    rerender(<MatchSummary match={buildMatch({ status: "COMPLETED", winnerSide: "A" })} perspectivePlayerId="p2" />);
    expect(screen.getByText("Поразка")).toBeInTheDocument();
  });

  it("shows scheduled/cancelled badges", () => {
    const { rerender } = render(<MatchSummary match={buildMatch({ status: "SCHEDULED" })} />);
    expect(screen.getByText("Заплановано")).toBeInTheDocument();

    rerender(<MatchSummary match={buildMatch({ status: "CANCELLED" })} />);
    expect(screen.getByText("Скасовано")).toBeInTheDocument();
  });

  it("flags a retirement separately from the result", () => {
    render(<MatchSummary match={buildMatch({ status: "COMPLETED", winnerSide: "A", retired: true })} />);
    expect(screen.getByText("Знявся з матчу")).toBeInTheDocument();
  });

  it("agrees with the retiring player's gender when it's known", () => {
    render(
      <MatchSummary
        match={buildMatch({
          status: "COMPLETED",
          winnerSide: "A",
          retired: true,
          players: [playerRow("A", "p1", "Іван"), playerRow("B", "p2", "Марія", null, "FEMALE")],
        })}
      />,
    );
    expect(screen.getByText("Знялась з матчу")).toBeInTheDocument();
  });
});

describe("MatchSummary (round label)", () => {
  it("hides the round entirely when hideRound is set", () => {
    render(<MatchSummary match={buildMatch({ round: "Фінал" })} hideRound />);
    expect(screen.queryByText("Фінал")).not.toBeInTheDocument();
  });

  it("normalizes the legacy 'Сіяні'/'Несіяні' round text to the current label", () => {
    render(<MatchSummary match={buildMatch({ round: "Сіяні" })} />);
    expect(screen.getByText("Gold (сіяні)")).toBeInTheDocument();
  });

  it("shows an unrecognized round as plain text, not a badge", () => {
    render(<MatchSummary match={buildMatch({ round: "Кастомний раунд" })} />);
    expect(screen.getByText("Кастомний раунд")).toBeInTheDocument();
  });
});

describe("MatchSummary (score)", () => {
  it("renders each side's per-set games and tiebreak points", () => {
    render(
      <MatchSummary
        match={buildMatch({
          status: "COMPLETED",
          winnerSide: "A",
          sets: [
            {
              id: "s1",
              matchId: "m1",
              setNumber: 1,
              sideAGames: 7,
              sideBGames: 6,
              tiebreakSideAPoints: 7,
              tiebreakSideBPoints: 4,
            },
          ],
        })}
      />,
    );
    expect(screen.getByText("7", { selector: "sup" })).toBeInTheDocument();
    expect(screen.getByText("4", { selector: "sup" })).toBeInTheDocument();
  });
});

describe("MatchSummary (champion trophy)", () => {
  it("only shows the trophy on the winning side when explicitly asked", () => {
    const { container, rerender } = render(
      <MatchSummary match={buildMatch({ status: "COMPLETED", winnerSide: "A" })} showChampionTrophy />,
    );
    expect(container.querySelector('[aria-label="Переможець турніру"]')).toBeInTheDocument();

    rerender(<MatchSummary match={buildMatch({ status: "COMPLETED", winnerSide: "A" })} />);
    expect(container.querySelector('[aria-label="Переможець турніру"]')).not.toBeInTheDocument();
  });
});

describe("MatchSummary (prediction bar)", () => {
  const preview = {
    probA: 0.7,
    probB: 0.3,
    pointsByPlayerId: { p1: { points: 1600 }, p2: { points: 1500 } },
  };

  it("shows the favorite's win probability when a preview is available", () => {
    render(<MatchSummary match={buildMatch({ status: "SCHEDULED" })} preview={preview} />);
    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.getByText(/фаворит/)).toBeInTheDocument();
  });

  it("explains why no prediction is available when preview is explicitly null", () => {
    render(<MatchSummary match={buildMatch({ status: "SCHEDULED" })} preview={null} />);
    expect(screen.getByText(/Прогноз недоступний/)).toBeInTheDocument();
  });

  it("shows nothing prediction-related when preview is simply absent", () => {
    render(<MatchSummary match={buildMatch({ status: "SCHEDULED" })} />);
    expect(screen.queryByText(/Прогноз недоступний/)).not.toBeInTheDocument();
    expect(screen.queryByText("70%")).not.toBeInTheDocument();
  });

  it("does not show preview.pointsByPlayerId in the score column - hidden for now, see match-summary.tsx history", () => {
    render(<MatchSummary match={buildMatch({ status: "SCHEDULED" })} preview={preview} />);
    expect(screen.queryByText("1600")).not.toBeInTheDocument();
    expect(screen.queryByText("1500")).not.toBeInTheDocument();
  });
});

describe("MatchSummary (nickname)", () => {
  it("shows a player's nickname instead of their real name when one is set", () => {
    render(
      <MatchSummary
        match={buildMatch({ players: [playerRow("A", "p1", "Данилюк Євген", "Женя"), playerRow("B", "p2", "Петро")] })}
      />,
    );
    expect(screen.getByText("Женя")).toBeInTheDocument();
    expect(screen.queryByText("Данилюк Євген")).not.toBeInTheDocument();
    expect(screen.getByText("Петро")).toBeInTheDocument();
  });
});

describe("MatchSummary (rank and tournament link)", () => {
  it("shows each player's club rank next to their name", () => {
    render(<MatchSummary match={buildMatch()} singlesRankById={{ p1: 3 }} />);
    expect(screen.getByText("(#3)")).toBeInTheDocument();
  });

  it("links to the tournament by default, and can be suppressed", () => {
    const { rerender } = render(<MatchSummary match={buildMatch()} />);
    expect(screen.getByRole("link", { name: "Літній кубок" })).toHaveAttribute("href", "/tournaments/t1");

    rerender(<MatchSummary match={buildMatch()} showTournament={false} />);
    expect(screen.queryByRole("link", { name: "Літній кубок" })).not.toBeInTheDocument();
  });
});
