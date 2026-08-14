// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TieCard } from "@/components/tie-card";
import type { MatchWithDetails } from "@/lib/queries/matches";

const { deleteTieActionMock, rubberActionMock } = vi.hoisted(() => ({
  deleteTieActionMock: vi.fn(async () => ({})),
  rubberActionMock: vi.fn(async () => ({})),
}));

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock } }));

beforeEach(() => {
  vi.clearAllMocks();
});

function playerRow(side: "A" | "B", id: string, name: string) {
  return { id: `${side}-${id}`, matchId: "m1", side, playerId: id, player: { id, name, nickname: null, gender: null, user: null } };
}

function rubber(overrides: Partial<MatchWithDetails> = {}): MatchWithDetails {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "m1",
    tournamentId: "t1",
    matchType: "SINGLES",
    round: null,
    tieId: "tie1",
    scheduledDate: null,
    status: "SCHEDULED",
    winnerSide: null,
    retired: false,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    tournament: { id: "t1", name: "Мікс-турнір" },
    sets: [],
    players: [playerRow("A", "a1", "Іван"), playerRow("B", "b1", "Олег")],
    ...overrides,
  } as MatchWithDetails;
}

const teamA = { id: "teamA", name: "Команда А", members: [{ id: "a1", name: "Іван", nickname: null }] };
const teamB = { id: "teamB", name: "Команда Б", members: [{ id: "b1", name: "Олег", nickname: null }] };

describe("TieCard", () => {
  it("shows the empty state with no rubbers yet", () => {
    render(<TieCard tournamentId="t1" tieId="tie1" label={null} teamA={teamA} teamB={teamB} rubbers={[]} />);
    expect(screen.getByText("Рабберів ще не додано.")).toBeInTheDocument();
  });

  it("tallies only completed rubbers toward the score", () => {
    render(
      <TieCard
        tournamentId="t1"
        tieId="tie1"
        label="Тур 1"
        teamA={teamA}
        teamB={teamB}
        rubbers={[
          rubber({ id: "m1", status: "COMPLETED", winnerSide: "A" }),
          rubber({ id: "m2", status: "COMPLETED", winnerSide: "A" }),
          rubber({ id: "m3", status: "COMPLETED", winnerSide: "B" }),
          rubber({ id: "m4", status: "SCHEDULED", winnerSide: null }),
        ]}
      />,
    );
    expect(screen.getByText("Тур 1")).toBeInTheDocument();
    expect(screen.getByText("2 — 1")).toBeInTheDocument();
  });

  it("hides manage affordances (add rubber, delete tie) unless canManage is set", () => {
    const { rerender } = render(
      <TieCard tournamentId="t1" tieId="tie1" label={null} teamA={teamA} teamB={teamB} rubbers={[]} />,
    );
    expect(screen.queryByRole("button", { name: "Додати раббер" })).not.toBeInTheDocument();

    rerender(
      <TieCard
        tournamentId="t1"
        tieId="tie1"
        label={null}
        teamA={teamA}
        teamB={teamB}
        rubbers={[]}
        canManage
        deleteTieAction={deleteTieActionMock}
        rubberAction={rubberActionMock}
      />,
    );
    expect(screen.getByRole("button", { name: "Додати раббер" })).toBeInTheDocument();
  });

  it("hides manage affordances even with canManage set if the sport-specific actions weren't passed", () => {
    render(<TieCard tournamentId="t1" tieId="tie1" label={null} teamA={teamA} teamB={teamB} rubbers={[]} canManage />);
    expect(screen.queryByRole("button", { name: "Додати раббер" })).not.toBeInTheDocument();
  });

  // Regression test: TieCard is reused unchanged on the Padel MIXED-tournament
  // page - without forwarding `sport` down to MatchSummary, a rubber's share
  // button silently pointed at the Tennis-only route.
  it("forwards sport down to each rubber's share button", async () => {
    const user = userEvent.setup();
    render(
      <TieCard
        tournamentId="t1"
        tieId="tie1"
        label={null}
        teamA={teamA}
        teamB={teamB}
        rubbers={[rubber({ id: "m1", status: "COMPLETED", winnerSide: "A" })]}
        sport="PADEL"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Поділитися" }));
    expect(screen.getByRole("img", { name: "Поділитися результатом матчу" })).toHaveAttribute(
      "src",
      "/api/share/padel-match/m1",
    );
  });

  it("deletes the tie after confirming, via the provided deleteTieAction", async () => {
    const user = userEvent.setup();
    render(
      <TieCard
        tournamentId="t1"
        tieId="tie1"
        label="Тур 1"
        teamA={teamA}
        teamB={teamB}
        rubbers={[]}
        canManage
        deleteTieAction={deleteTieActionMock}
        rubberAction={rubberActionMock}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Видалити зустріч «Тур 1»" }));
    await user.click(screen.getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(deleteTieActionMock).toHaveBeenCalledWith("t1", "tie1"));
  });
});
