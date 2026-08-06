// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTransition } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TournamentMatches } from "@/components/admin/tournament-matches";
import type { MatchWithDetails } from "@/lib/queries/matches";

vi.mock("@/components/match-summary", () => ({
  MatchSummary: ({ match }: { match: MatchWithDetails }) => (
    <div>{match.players.map((p) => p.player.name).join(" / ")}</div>
  ),
}));

// The create-mode trigger and the per-match edit-mode trigger share this same
// mocked component - "simulate create" only renders when there's no `match`
// prop (create mode), matching MatchDialog's own real behavior.
vi.mock("@/components/admin/create-match-dialog", () => ({
  MatchDialog: ({
    trigger,
    match,
    onOptimisticCreate,
  }: {
    trigger: React.ReactNode;
    match?: unknown;
    onOptimisticCreate?: (input: {
      matchType: "SINGLES";
      round: string | null;
      scheduledDate: string | null;
      sideAPlayerIds: string[];
      sideBPlayerIds: string[];
    }) => void;
  }) => {
    const [, startCreateTransition] = useTransition();
    return (
      <div>
        {trigger}
        {!match && (
          <button
            onClick={() =>
              // useOptimistic only shows the optimistic value while its
              // surrounding transition is genuinely pending - it reverts to the
              // real `matches` prop the instant the transition settles. This
              // test never simulates the server round-trip that would actually
              // update that prop, so the transition is kept deliberately
              // pending (never resolved) to observe the optimistic entry
              // without racing its own reversion.
              startCreateTransition(async () => {
                onOptimisticCreate?.({
                  matchType: "SINGLES",
                  round: null,
                  scheduledDate: null,
                  sideAPlayerIds: ["p1"],
                  sideBPlayerIds: ["p2"],
                });
                await new Promise(() => {});
              })
            }
          >
            simulate-create
          </button>
        )}
      </div>
    );
  },
}));
vi.mock("@/components/admin/delete-match-button", () => ({
  DeleteMatchButton: () => <button>stub-delete</button>,
}));
vi.mock("@/components/admin/randomize-matches-button", () => ({
  RandomizeMatchesButton: () => <div>stub-doubles-randomizer</div>,
}));
vi.mock("@/components/admin/singles-randomize-button", () => ({
  SinglesRandomizeButton: () => <div>stub-singles-randomizer</div>,
}));
vi.mock("@/components/admin/score-dialog", () => ({
  ScoreDialog: ({ trigger }: { trigger: React.ReactNode }) => <div>{trigger}</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const roster = [
  { id: "p1", name: "Іван" },
  { id: "p2", name: "Петро" },
  { id: "p3", name: "Марко" },
  { id: "p4", name: "Богдан" },
];

function buildMatch(overrides: Partial<MatchWithDetails> & { id: string }): MatchWithDetails {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    tournamentId: "t1",
    matchType: "SINGLES",
    round: null,
    scheduledDate: now,
    status: "SCHEDULED",
    winnerSide: null,
    retired: false,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    tournament: { id: "t1", name: "Кубок" },
    sets: [],
    players: [],
    ...overrides,
  } as MatchWithDetails;
}

function playerRow(matchId: string, side: "A" | "B", player: { id: string; name: string }) {
  return { id: `${matchId}-${side}`, matchId, side, playerId: player.id, player };
}

const commonProps = {
  tournamentId: "t1",
  roster,
  hasSeededPlayer: true,
  seededCount: 2,
  unseededCount: 2,
  groupCounts: {},
  customGroupNames: new Map(),
  previewByMatchId: {},
  singlesRatingSnapshots: {},
  singlesRankById: {},
  doublesRankById: {},
};

describe("TournamentMatches (filtering)", () => {
  const matches = [
    buildMatch({
      id: "m1",
      status: "SCHEDULED",
      players: [playerRow("m1", "A", roster[0]), playerRow("m1", "B", roster[1])],
    }),
    buildMatch({
      id: "m2",
      status: "COMPLETED",
      winnerSide: "A",
      players: [playerRow("m2", "A", roster[2]), playerRow("m2", "B", roster[3])],
    }),
  ];

  it("shows every match with no filter applied", () => {
    render(<TournamentMatches {...commonProps} format="SINGLES" matches={matches} />);
    expect(screen.getByText("Іван / Петро")).toBeInTheDocument();
    expect(screen.getByText("Марко / Богдан")).toBeInTheDocument();
  });

  it("filters by player name", async () => {
    const user = userEvent.setup();
    render(<TournamentMatches {...commonProps} format="SINGLES" matches={matches} />);
    await user.type(screen.getByPlaceholderText("Пошук за гравцем"), "Марко");
    expect(screen.queryByText("Іван / Петро")).not.toBeInTheDocument();
    expect(screen.getByText("Марко / Богдан")).toBeInTheDocument();
  });

  it("filters by status", async () => {
    const user = userEvent.setup();
    render(<TournamentMatches {...commonProps} format="SINGLES" matches={matches} />);
    await user.click(screen.getByRole("combobox", { name: "Фільтр за статусом" }));
    await user.click(await screen.findByRole("option", { name: "Завершені" }));
    expect(screen.queryByText("Іван / Петро")).not.toBeInTheDocument();
    expect(screen.getByText("Марко / Богдан")).toBeInTheDocument();
  });

  it("shows a distinct message when a filter matches nothing", async () => {
    const user = userEvent.setup();
    render(<TournamentMatches {...commonProps} format="SINGLES" matches={matches} />);
    await user.type(screen.getByPlaceholderText("Пошук за гравцем"), "Немає такого");
    expect(screen.getByText("Немає матчів за цим фільтром.")).toBeInTheDocument();
  });

  it("shows the empty-tournament message with no matches at all", () => {
    render(<TournamentMatches {...commonProps} format="SINGLES" matches={[]} />);
    expect(screen.getByText("Матчів ще не створено.")).toBeInTheDocument();
  });
});

describe("TournamentMatches (format-specific randomizer)", () => {
  it("shows the doubles randomizer for a DOUBLES tournament", () => {
    render(<TournamentMatches {...commonProps} format="DOUBLES" matches={[]} />);
    expect(screen.getByText("stub-doubles-randomizer")).toBeInTheDocument();
    expect(screen.queryByText("stub-singles-randomizer")).not.toBeInTheDocument();
  });

  it("shows the singles randomizer for a SINGLES tournament", () => {
    render(<TournamentMatches {...commonProps} format="SINGLES" matches={[]} />);
    expect(screen.getByText("stub-singles-randomizer")).toBeInTheDocument();
    expect(screen.queryByText("stub-doubles-randomizer")).not.toBeInTheDocument();
  });
});

describe("TournamentMatches (optimistic create)", () => {
  it("shows a freshly submitted match immediately, with its actions disabled until it's real", async () => {
    const user = userEvent.setup();
    render(<TournamentMatches {...commonProps} format="SINGLES" matches={[]} />);

    await user.click(screen.getByRole("button", { name: "simulate-create" }));

    expect(await screen.findByText("Іван / Петро")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Рахунок/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Редагувати" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Видалити" })).toBeDisabled();
    expect(screen.queryByText("stub-delete")).not.toBeInTheDocument();
  });
});
