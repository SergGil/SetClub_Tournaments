// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { matchShareCaption, MatchSummary } from "@/components/match-summary";
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

  it("uses the plural for a retiring doubles pair", () => {
    render(
      <MatchSummary
        match={buildMatch({
          status: "COMPLETED",
          winnerSide: "A",
          retired: true,
          matchType: "DOUBLES",
          players: [
            playerRow("A", "p1", "Іван"),
            playerRow("A", "p3", "Олег"),
            playerRow("B", "p2", "Марія", null, "FEMALE"),
            playerRow("B", "p4", "Олена", null, "FEMALE"),
          ],
        })}
      />,
    );
    expect(screen.getByText("Знялися з матчу")).toBeInTheDocument();
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

describe("MatchSummary (bracket-randomizer placeholder slots)", () => {
  it("shows a plain '?' for an empty side with no MatchAdvancement row", () => {
    render(<MatchSummary match={buildMatch({ round: "1/2", players: [playerRow("A", "p1", "Іван")] })} />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("shows the group-rank winner label for an empty GROUP_RANK side", () => {
    render(
      <MatchSummary
        match={buildMatch({
          round: "1/2",
          players: [playerRow("A", "p1", "Іван")],
          advancementsAsTarget: [
            { side: "B", source: "GROUP_RANK", sourceGroup: 2, sourceRank: 1, outcome: null, sourceMatch: null },
          ],
        })}
      />,
    );
    expect(screen.getByText("Переможець Групи B")).toBeInTheDocument();
  });

  it("shows the match-result label for an empty MATCH_RESULT side", () => {
    render(
      <MatchSummary
        match={buildMatch({
          round: "Фінал",
          players: [],
          advancementsAsTarget: [
            {
              side: "A",
              source: "MATCH_RESULT",
              sourceGroup: null,
              sourceRank: null,
              outcome: "WINNER",
              sourceMatch: { round: "1/2" },
            },
            {
              side: "B",
              source: "MATCH_RESULT",
              sourceGroup: null,
              sourceRank: null,
              outcome: "WINNER",
              sourceMatch: { round: "Півфінал за 5-8" },
            },
          ],
        })}
      />,
    );
    expect(screen.getByText("Переможець 1/2")).toBeInTheDocument();
    expect(screen.getByText("Переможець Півфінал за 5-8")).toBeInTheDocument();
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

  it("says 'фаворитка' for a female favorite and 'фаворити' for a pair in the live caption too", () => {
    const { rerender } = render(
      <MatchSummary
        match={buildMatch({ players: [playerRow("A", "p1", "Марія", null, "FEMALE"), playerRow("B", "p2", "Петро")] })}
        preview={preview}
      />,
    );
    expect(screen.getByText(/за поточним рейтингом/)).toHaveTextContent("Марія — фаворитка за поточним рейтингом (70%)");

    rerender(
      <MatchSummary
        match={buildMatch({
          matchType: "DOUBLES",
          players: [
            playerRow("A", "p1", "Іван"),
            playerRow("A", "p3", "Олег"),
            playerRow("B", "p2", "Петро"),
            playerRow("B", "p4", "Женя"),
          ],
        })}
        preview={preview}
      />,
    );
    expect(screen.getByText(/за поточним рейтингом/)).toHaveTextContent("Іван / Олег — фаворити за поточним рейтингом (70%)");
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

describe("MatchSummary (past-tense prediction on a completed match)", () => {
  const completed = (overrides: Partial<MatchWithDetails> = {}) =>
    buildMatch({ status: "COMPLETED", winnerSide: "A", preMatchWinProbA: 0.7, ...overrides });

  const caption = () => screen.getByText(/^Перед матчем/);

  it("shows the frozen pre-match prediction and that the favorite won", () => {
    render(
      <MatchSummary
        match={completed({ players: [playerRow("A", "p1", "Іван", null, "MALE"), playerRow("B", "p2", "Петро", null, "MALE")] })}
      />,
    );
    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(caption()).toHaveTextContent("Перед матчем Іван був фаворитом (70%) — і переміг");
  });

  it("agrees every word with a female favorite and a female underdog", () => {
    const women = [playerRow("A", "p1", "Марія", null, "FEMALE"), playerRow("B", "p2", "Олена", null, "FEMALE")];
    const { rerender } = render(<MatchSummary match={completed({ preMatchWinProbA: 0.8, players: women })} />);
    expect(caption()).toHaveTextContent("Перед матчем Марія була явною фавориткою (80%) — і перемогла");

    rerender(<MatchSummary match={completed({ preMatchWinProbA: 0.8, winnerSide: "B", players: women })} />);
    expect(caption()).toHaveTextContent("Перед матчем Марія була явною фавориткою (80%), але перемогла Олена");
  });

  it("names the underdog who won, with their own gender, and falls back to masculine when gender is unknown", () => {
    render(
      <MatchSummary
        match={completed({
          winnerSide: "B",
          players: [playerRow("A", "p1", "Марія", null, "FEMALE"), playerRow("B", "p2", "Сашко")],
        })}
      />,
    );
    expect(caption()).toHaveTextContent("Перед матчем Марія була фавориткою (70%), але переміг Сашко");
  });

  it("uses plural forms for a doubles pair", () => {
    render(
      <MatchSummary
        match={completed({
          winnerSide: "B",
          preMatchWinProbA: 0.95,
          matchType: "DOUBLES",
          players: [
            playerRow("A", "p1", "Іван"),
            playerRow("A", "p3", "Олена", null, "FEMALE"),
            playerRow("B", "p2", "Петро"),
            playerRow("B", "p4", "Женя"),
          ],
        })}
      />,
    );
    expect(caption()).toHaveTextContent(
      "Перед матчем Іван / Олена були безумовними фаворитами (95%), але перемогли Петро / Женя",
    );
  });

  it("names side B as the favorite when it had the higher probability", () => {
    render(<MatchSummary match={completed({ preMatchWinProbA: 0.2, winnerSide: "B" })} />);
    expect(caption()).toHaveTextContent("Перед матчем Петро був явним фаворитом (80%) — і переміг");
  });

  it("tells no outcome for a near coin flip", () => {
    render(
      <MatchSummary
        match={completed({
          preMatchWinProbA: 0.52,
          players: [playerRow("A", "p1", "Марія", null, "FEMALE"), playerRow("B", "p2", "Олена", null, "FEMALE")],
        })}
      />,
    );
    expect(caption()).toHaveTextContent("Перед матчем шанси були майже рівні — Марія була трохи попереду (52%)");
    expect(caption()).not.toHaveTextContent("перемогла");
  });

  it("shows nothing for a completed match without a frozen prediction, or for a walkover", () => {
    const { rerender } = render(<MatchSummary match={completed({ preMatchWinProbA: null })} />);
    expect(screen.queryByText(/Перед матчем/)).not.toBeInTheDocument();

    rerender(<MatchSummary match={completed({ walkover: true })} />);
    expect(screen.queryByText(/Перед матчем/)).not.toBeInTheDocument();
  });

  it("does not show the frozen value on a match that is scheduled again", () => {
    render(<MatchSummary match={buildMatch({ status: "SCHEDULED", preMatchWinProbA: 0.7 })} />);
    expect(screen.queryByText(/Перед матчем/)).not.toBeInTheDocument();
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

  it("links every player's name to their tennis profile by default, and to their padel profile for PADEL", () => {
    const doubles = buildMatch({
      matchType: "DOUBLES",
      players: [
        playerRow("A", "p1", "Іван"),
        playerRow("A", "p3", "Олег"),
        playerRow("B", "p2", "Петро"),
        playerRow("B", "p4", "Данилюк Євген", "Женя"),
      ],
    });
    const { rerender } = render(<MatchSummary match={doubles} doublesRankById={{ p1: 3 }} />);
    expect(screen.getByRole("link", { name: "Іван" })).toHaveAttribute("href", "/players/p1");
    expect(screen.getByRole("link", { name: "Олег" })).toHaveAttribute("href", "/players/p3");
    expect(screen.getByRole("link", { name: "Петро" })).toHaveAttribute("href", "/players/p2");
    // The nickname is what's shown, so that's the link's name; the rank annotation stays outside the link.
    expect(screen.getByRole("link", { name: "Женя" })).toHaveAttribute("href", "/players/p4");
    expect(screen.getByText("(#3)").closest("a")).toBeNull();

    rerender(<MatchSummary match={doubles} sport="PADEL" />);
    expect(screen.getByRole("link", { name: "Іван" })).toHaveAttribute("href", "/padel/players/p1");
    expect(screen.getByRole("link", { name: "Женя" })).toHaveAttribute("href", "/padel/players/p4");
  });

  it("links to the tournament by default, and can be suppressed", () => {
    const { rerender } = render(<MatchSummary match={buildMatch()} />);
    expect(screen.getByRole("link", { name: "Літній кубок" })).toHaveAttribute("href", "/tournaments/t1");

    rerender(<MatchSummary match={buildMatch()} showTournament={false} />);
    expect(screen.queryByRole("link", { name: "Літній кубок" })).not.toBeInTheDocument();
  });

  // Regression test: MatchSummary is reused unchanged for Padel matches
  // (structural typing) - without `sport`, the tournament link and the
  // share-card route both silently pointed at the Tennis-only routes.
  it("links to the Padel tournament route when sport is PADEL", () => {
    render(<MatchSummary match={buildMatch()} sport="PADEL" />);
    expect(screen.getByRole("link", { name: "Літній кубок" })).toHaveAttribute(
      "href",
      "/padel/tournaments/t1",
    );
  });
});

describe("MatchSummary (share-card route, sport-specific)", () => {
  it("uses the Tennis share route by default for a completed match", async () => {
    const user = userEvent.setup();
    render(<MatchSummary match={buildMatch({ status: "COMPLETED", winnerSide: "A" })} />);
    await user.click(screen.getByRole("button", { name: "Поділитися" }));
    expect(screen.getByRole("img", { name: "Поділитися результатом матчу" })).toHaveAttribute(
      "src",
      "/api/share/match/m1",
    );
  });

  it("uses the Padel share route when sport is PADEL", async () => {
    const user = userEvent.setup();
    render(<MatchSummary match={buildMatch({ status: "COMPLETED", winnerSide: "A" })} sport="PADEL" />);
    await user.click(screen.getByRole("button", { name: "Поділитися" }));
    expect(screen.getByRole("img", { name: "Поділитися результатом матчу" })).toHaveAttribute(
      "src",
      "/api/share/padel-match/m1",
    );
  });
});

describe("matchShareCaption", () => {
  it("builds a winner-first sentence with the score and tournament name", () => {
    const match = buildMatch({
      winnerSide: "A",
      sets: [
        { id: "s1", matchId: "m1", setNumber: 1, sideAGames: 6, sideBGames: 4, tiebreakSideAPoints: null, tiebreakSideBPoints: null },
        { id: "s2", matchId: "m1", setNumber: 2, sideAGames: 6, sideBGames: 3, tiebreakSideAPoints: null, tiebreakSideBPoints: null },
      ],
    });

    expect(matchShareCaption(match, "Іван", "Петро")).toBe("Іван переміг Петро 6:4, 6:3 (Літній кубок)");
  });

  it("appends the tiebreak points (winner's first) for a 7-6 set", () => {
    const match = buildMatch({
      winnerSide: "B",
      sets: [
        { id: "s1", matchId: "m1", setNumber: 1, sideAGames: 6, sideBGames: 7, tiebreakSideAPoints: 5, tiebreakSideBPoints: 7 },
      ],
    });

    expect(matchShareCaption(match, "Іван", "Петро")).toBe("Петро переміг Іван 7:6(7:5) (Літній кубок)");
  });

  it("uses the plural verb for a winning doubles pair", () => {
    const match = buildMatch({
      winnerSide: "A",
      matchType: "DOUBLES",
      players: [
        playerRow("A", "p1", "Іван"),
        playerRow("A", "p3", "Олег"),
        playerRow("B", "p2", "Петро"),
        playerRow("B", "p4", "Женя"),
      ],
      sets: [
        { id: "s1", matchId: "m1", setNumber: 1, sideAGames: 6, sideBGames: 2, tiebreakSideAPoints: null, tiebreakSideBPoints: null },
      ],
    });

    expect(matchShareCaption(match, "Іван / Олег", "Петро / Женя")).toBe(
      "Іван / Олег перемогли Петро / Женя 6:2 (Літній кубок)",
    );
  });

  it("agrees with the winner's gender the same way retiredLabel does", () => {
    const match = buildMatch({
      winnerSide: "B",
      players: [playerRow("A", "p1", "Іван"), playerRow("B", "p2", "Марія", null, "FEMALE")],
      sets: [{ id: "s1", matchId: "m1", setNumber: 1, sideAGames: 4, sideBGames: 6, tiebreakSideAPoints: null, tiebreakSideBPoints: null }],
    });

    expect(matchShareCaption(match, "Іван", "Марія")).toBe("Марія перемогла Іван 6:4 (Літній кубок)");
  });

  it("falls back to a plain 'A — B' sentence when there's no decided winner", () => {
    const match = buildMatch({ winnerSide: null });
    expect(matchShareCaption(match, "Іван", "Петро")).toBe("Іван — Петро (Літній кубок)");
  });
});
