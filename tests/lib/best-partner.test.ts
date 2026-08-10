import { describe, expect, it } from "vitest";

import { findBestPartner } from "@/lib/best-partner";
import type { MatchWithDetails } from "@/lib/queries/matches";

function playerRow(side: "A" | "B", id: string, name: string) {
  return { id: `${side}-${id}`, matchId: "m", side, playerId: id, player: { id, name, nickname: null, gender: null } };
}

function buildMatch(overrides: Partial<MatchWithDetails> = {}): MatchWithDetails {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "m1",
    tournamentId: "t1",
    matchType: "DOUBLES",
    round: null,
    scheduledDate: null,
    status: "COMPLETED",
    winnerSide: "A",
    retired: false,
    walkover: false,
    completedAt: now,
    createdAt: now,
    updatedAt: now,
    tournament: { id: "t1", name: "Турнір" },
    sets: [],
    players: [
      playerRow("A", "me", "Я"),
      playerRow("A", "partner1", "Партнер1"),
      playerRow("B", "opp1", "Суперник1"),
      playerRow("B", "opp2", "Суперник2"),
    ],
    ...overrides,
  } as MatchWithDetails;
}

describe("findBestPartner", () => {
  it("returns null when the player has no doubles matches at all", () => {
    const singlesOnly = [
      buildMatch({
        matchType: "SINGLES",
        players: [playerRow("A", "me", "Я"), playerRow("B", "opp1", "Суперник1")],
      }),
    ];
    expect(findBestPartner(singlesOnly, "me")).toBeNull();
  });

  it("ignores matches the player wasn't part of, and singles matches", () => {
    const matches = [
      buildMatch({ players: [playerRow("A", "x", "Х"), playerRow("A", "y", "Y"), playerRow("B", "z", "Z"), playerRow("B", "w", "W")] }),
      buildMatch({ matchType: "SINGLES", players: [playerRow("A", "me", "Я"), playerRow("B", "opp1", "Суперник1")] }),
    ];
    expect(findBestPartner(matches, "me")).toBeNull();
  });

  it("picks the partner with the higher win% over one with more total matches", () => {
    const withPartner1 = (winnerSide: "A" | "B") =>
      buildMatch({
        winnerSide,
        players: [playerRow("A", "me", "Я"), playerRow("A", "partner1", "Партнер1"), playerRow("B", "o1", "О1"), playerRow("B", "o2", "О2")],
      });
    const withPartner2 = (winnerSide: "A" | "B") =>
      buildMatch({
        winnerSide,
        players: [playerRow("A", "me", "Я"), playerRow("A", "partner2", "Партнер2"), playerRow("B", "o1", "О1"), playerRow("B", "o2", "О2")],
      });

    // partner1: 2-0 (100%), partner2: 3-1 (75%) - fewer total matches but better win%.
    const matches = [withPartner1("A"), withPartner1("A"), withPartner2("A"), withPartner2("A"), withPartner2("A"), withPartner2("B")];

    const best = findBestPartner(matches, "me");
    expect(best).toEqual({ partnerId: "partner1", name: "Партнер1", wins: 2, losses: 0 });
  });

  it("breaks a tied win% by whoever played more matches together", () => {
    const withPartner1 = buildMatch({
      winnerSide: "A",
      players: [playerRow("A", "me", "Я"), playerRow("A", "partner1", "Партнер1"), playerRow("B", "o1", "О1"), playerRow("B", "o2", "О2")],
    });
    const withPartner2 = buildMatch({
      winnerSide: "A",
      players: [playerRow("A", "me", "Я"), playerRow("A", "partner2", "Партнер2"), playerRow("B", "o1", "О1"), playerRow("B", "o2", "О2")],
    });

    // Both 100% win rate - partner2 has 2 matches together vs partner1's 1.
    const best = findBestPartner([withPartner1, withPartner2, withPartner2], "me");
    expect(best).toEqual({ partnerId: "partner2", name: "Партнер2", wins: 2, losses: 0 });
  });

  it("doesn't charge a personal loss for a walkover the player didn't play", () => {
    const walkoverLoss = buildMatch({ winnerSide: "B", walkover: true, sets: [] });
    const best = findBestPartner([walkoverLoss], "me");
    expect(best).toBeNull();
  });

  it("ignores an undecided (SCHEDULED) match", () => {
    const scheduled = buildMatch({ status: "SCHEDULED", winnerSide: null });
    expect(findBestPartner([scheduled], "me")).toBeNull();
  });
});
