// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TournamentBracket } from "@/components/tournament-bracket";
import type { BracketNode, BracketTree } from "@/lib/playoff-bracket-tree";
import type { MatchWithDetails } from "@/lib/queries/matches";

// Multi-round trees: connector lines, vertical centering, bronze box and champion badge
// (tournament-bracket.test.tsx covers the single-box cases).

function playerRow(matchId: string, side: "A" | "B", id: string, name: string) {
  return {
    id: `${matchId}-${side}-${id}`,
    matchId,
    side,
    playerId: id,
    player: { id, name, nickname: null, gender: null, user: null },
  };
}

function match(
  id: string,
  round: string,
  a: [string, string] | null,
  b: [string, string] | null,
  overrides: Partial<MatchWithDetails> = {},
): MatchWithDetails {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id,
    tournamentId: "t1",
    matchType: "SINGLES",
    round,
    scheduledDate: null,
    status: "COMPLETED",
    winnerSide: "A",
    retired: false,
    walkover: false,
    completedAt: now,
    createdAt: now,
    updatedAt: now,
    tournament: { id: "t1", name: "Літній кубок" },
    sets: [{ id: `${id}-1`, matchId: id, setNumber: 1, sideAGames: 6, sideBGames: 2, tiebreakSideAPoints: null, tiebreakSideBPoints: null }],
    players: [
      ...(a ? [playerRow(id, "A", a[0], a[1])] : []),
      ...(b ? [playerRow(id, "B", b[0], b[1])] : []),
    ],
    ...overrides,
  } as MatchWithDetails;
}

function node(m: MatchWithDetails, sideA: BracketNode | null = null, sideB: BracketNode | null = null): BracketNode {
  return {
    match: m,
    round: m.round ?? "",
    sideA: { playerIds: [], source: sideA },
    sideB: { playerIds: [], source: sideB },
  } as BracketNode;
}

function semisAndFinal(finalOverrides: Partial<MatchWithDetails> = {}, withBronze = false): BracketTree {
  const semi1 = node(match("s1", "1/2", ["p1", "Іван"], ["p2", "Петро"]));
  const semi2 = node(match("s2", "1/2", ["p3", "Олег"], ["p4", "Данило"]));
  const final = node(match("f", "Фінал", ["p1", "Іван"], ["p3", "Олег"], finalOverrides), semi1, semi2);
  return {
    columns: [
      { round: "1/2", nodes: [semi1, semi2] },
      { round: "Фінал", nodes: [final] },
    ],
    bronze: withBronze ? match("b", "За 3 місце", ["p2", "Петро"], ["p4", "Данило"]) : null,
  } as BracketTree;
}

describe("TournamentBracket (multi-round)", () => {
  it("labels every round column", () => {
    render(<TournamentBracket tree={semisAndFinal()} />);
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("Фінал")).toBeInTheDocument();
  });

  it("draws one connector per feeder match, from each semi's box into the final", () => {
    const { container } = render(<TournamentBracket tree={semisAndFinal()} />);
    const paths = Array.from(container.querySelectorAll("svg > g > path")).map((p) => p.getAttribute("d"));
    // box 176 wide, 40 column gap, 56 tall boxes with a 20 row gap and a 28 label row above:
    // semis centre at y=28+28 and 104+28; the final sits halfway (66+28) between them.
    expect(paths).toEqual(["M176,56 H196 V94 H216", "M176,132 H196 V94 H216"]);
  });

  it("centres the final's box between the two semis it is fed by", () => {
    const { container } = render(<TournamentBracket tree={semisAndFinal()} />);
    const positioned = Array.from(container.querySelectorAll<HTMLElement>("div.absolute[style*='top']"));
    const topOf = (name: string) =>
      Number(positioned.find((el) => el.textContent?.includes(name))?.style.top.replace("px", ""));
    const semiTops = [topOf("Іван"), topOf("Олег")];
    // both semis contain their own first player; the final box also contains "Іван" first, so
    // compare via the layout maths instead: final top = average semi centre - half box + label.
    expect(semiTops.every((t) => Number.isFinite(t))).toBe(true);
    const tops = positioned.map((el) => Number(el.style.top.replace("px", ""))).sort((a, b) => a - b);
    expect(tops).toContain(28); // first semi: centre 28 - 28 + label 28
    expect(tops).toContain(104); // second semi
    expect(tops).toContain(66); // final: centre 66 - 28 + label 28
  });

  it("crowns the winner of a completed final with a trophy badge", () => {
    const { container } = render(<TournamentBracket tree={semisAndFinal({ winnerSide: "B" })} />);
    const badge = container.querySelector("div[title='Олег']");
    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent("Олег");
    expect(badge!.querySelector("svg")).toBeInTheDocument(); // the trophy
  });

  it("shows no champion while the final isn't completed", () => {
    const { container } = render(
      <TournamentBracket tree={semisAndFinal({ status: "SCHEDULED", winnerSide: null, sets: [] })} />,
    );
    expect(container.querySelector("div[title]")).toBeNull();
  });

  it("renders the bronze match in its own labelled box", () => {
    render(<TournamentBracket tree={semisAndFinal({}, true)} />);
    expect(screen.getByText("За 3 місце")).toBeInTheDocument();
    expect(screen.getAllByText("Петро").length).toBeGreaterThan(0);
  });

  it("has no bronze label when there is no bronze match", () => {
    render(<TournamentBracket tree={semisAndFinal()} />);
    expect(screen.queryByText("За 3 місце")).not.toBeInTheDocument();
  });

  it("shows '?' for a side whose player isn't decided yet", () => {
    const pending = node(match("f", "Фінал", ["p1", "Іван"], null, { status: "SCHEDULED", winnerSide: null, sets: [] }));
    render(<TournamentBracket tree={{ columns: [{ round: "Фінал", nodes: [pending] }], bronze: null } as BracketTree} />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("lists every set's games per side, space-separated, and nothing before the match starts", () => {
    const played = node(
      match("f", "Фінал", ["p1", "Іван"], ["p2", "Петро"], {
        sets: [
          { id: "s1", matchId: "f", setNumber: 1, sideAGames: 6, sideBGames: 4, tiebreakSideAPoints: null, tiebreakSideBPoints: null },
          { id: "s2", matchId: "f", setNumber: 2, sideAGames: 3, sideBGames: 6, tiebreakSideAPoints: null, tiebreakSideBPoints: null },
        ],
      }),
    );
    const { unmount } = render(<TournamentBracket tree={{ columns: [{ round: "Фінал", nodes: [played] }], bronze: null } as BracketTree} />);
    expect(screen.getByText("6 3")).toBeInTheDocument();
    expect(screen.getByText("4 6")).toBeInTheDocument();
    unmount();

    const upcoming = node(match("f2", "Фінал", ["p1", "Іван"], ["p2", "Петро"], { status: "SCHEDULED", winnerSide: null, sets: [] }));
    const { container } = render(<TournamentBracket tree={{ columns: [{ round: "Фінал", nodes: [upcoming] }], bronze: null } as BracketTree} />);
    expect(container.textContent).not.toMatch(/\d \d/);
  });

  it("widens the diagram to fit a long doubles-pair champion past the last column", () => {
    const longName = "Іваненко-Петренко Олександр / Шевченко-Коваленко Богдан";
    const tree = semisAndFinal();
    tree.columns[1].nodes[0].match = match("f", "Фінал", ["p1", longName], ["p3", "Олег"]);
    const { container } = render(<TournamentBracket tree={tree} />);
    const canvas = container.querySelector<HTMLElement>("div.relative")!;
    // two columns: last column right edge = 216 + 176 = 392; the badge needs more than one box width
    expect(Number(canvas.style.width.replace("px", ""))).toBeGreaterThan(392 + 24 + 176);
  });
});
