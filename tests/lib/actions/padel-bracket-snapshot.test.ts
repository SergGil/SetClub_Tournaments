import { describe, expect, it, vi } from "vitest";

import { buildPadelBracketSnapshot, CascadeResetPendingError } from "@/lib/actions/padel-bracket-snapshot";

function txMock(overrides: {
  matches?: unknown[];
  advancements?: unknown[];
  participants?: unknown[];
}) {
  return {
    padelMatch: { findMany: vi.fn().mockResolvedValue(overrides.matches ?? []) },
    padelMatchAdvancement: { findMany: vi.fn().mockResolvedValue(overrides.advancements ?? []) },
    padelTournamentParticipant: { findMany: vi.fn().mockResolvedValue(overrides.participants ?? []) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("buildPadelBracketSnapshot", () => {
  it("queries all three Padel tables scoped to the tournament", async () => {
    const tx = txMock({});
    await buildPadelBracketSnapshot(tx, "t1");

    expect(tx.padelMatch.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tournamentId: "t1" } }));
    expect(tx.padelMatchAdvancement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tournamentId: "t1" } }),
    );
    expect(tx.padelTournamentParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tournamentId: "t1" } }),
    );
  });

  it("passes matches through as-is", async () => {
    const match = { id: "m1", round: "Фінал", status: "COMPLETED", winnerSide: "A", players: [], sets: [], walkover: false };
    const tx = txMock({ matches: [match] });
    const snapshot = await buildPadelBracketSnapshot(tx, "t1");
    expect(snapshot.matches).toEqual([match]);
  });

  it("maps a GROUP_RANK advancement to its own shape, dropping MATCH_RESULT-only fields", async () => {
    const tx = txMock({
      advancements: [
        {
          matchId: "m2",
          side: "A",
          source: "GROUP_RANK",
          sourceGroup: 1,
          sourceRank: 1,
          sourceMatchId: null,
          outcome: null,
        },
      ],
    });
    const snapshot = await buildPadelBracketSnapshot(tx, "t1");
    expect(snapshot.advancements).toEqual([
      { matchId: "m2", side: "A", source: "GROUP_RANK", sourceGroup: 1, sourceRank: 1 },
    ]);
  });

  it("maps a MATCH_RESULT advancement to its own shape, dropping GROUP_RANK-only fields", async () => {
    const tx = txMock({
      advancements: [
        {
          matchId: "m3",
          side: "B",
          source: "MATCH_RESULT",
          sourceGroup: null,
          sourceRank: null,
          sourceMatchId: "m1",
          outcome: "WINNER",
        },
      ],
    });
    const snapshot = await buildPadelBracketSnapshot(tx, "t1");
    expect(snapshot.advancements).toEqual([
      { matchId: "m3", side: "B", source: "MATCH_RESULT", sourceMatchId: "m1", outcome: "WINNER" },
    ]);
  });

  it("maps each participant's withdrawnAt to an ISO string, or null if still active", async () => {
    const tx = txMock({
      participants: [
        { playerId: "p1", group: 1, withdrawnAt: new Date("2026-01-01T00:00:00.000Z"), player: { name: "Іван" } },
        { playerId: "p2", group: null, withdrawnAt: null, player: { name: "Петро" } },
      ],
    });
    const snapshot = await buildPadelBracketSnapshot(tx, "t1");
    expect(snapshot.participants).toEqual([
      { playerId: "p1", name: "Іван", group: 1, withdrawnAt: "2026-01-01T00:00:00.000Z" },
      { playerId: "p2", name: "Петро", group: null, withdrawnAt: null },
    ]);
  });
});

describe("CascadeResetPendingError", () => {
  it("carries the pending resets on the error instance", () => {
    const resets = [{ matchId: "m1", round: "1/2", sideALabel: "Іван", sideBLabel: "Петро" }];
    const error = new CascadeResetPendingError(resets);
    expect(error.resets).toBe(resets);
    expect(error).toBeInstanceOf(Error);
  });
});
