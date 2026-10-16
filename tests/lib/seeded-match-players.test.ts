import { describe, expect, it, vi } from "vitest";

import { seededFirstMatches } from "@/lib/seeded-match-players";

type TestMatch = { id: string; tournamentId: string; players: { side: "A" | "B"; playerId: string }[] };

const doubles = (id: string, tournamentId = "t1"): TestMatch => ({
  id,
  tournamentId,
  players: [
    { side: "A", playerId: "p1" },
    { side: "A", playerId: "p2" },
    { side: "B", playerId: "p3" },
    { side: "B", playerId: "p4" },
  ],
});

const sidePlayers = (match: TestMatch, side: "A" | "B") =>
  match.players.filter((p) => p.side === side).map((p) => p.playerId);

describe("seededFirstMatches", () => {
  it("puts the seeded player first on each side, without moving anyone to the other side", async () => {
    const loadSeeded = vi.fn().mockResolvedValue([
      { tournamentId: "t1", playerId: "p2" },
      { tournamentId: "t1", playerId: "p4" },
    ]);

    const [result] = await seededFirstMatches([doubles("m1")], loadSeeded);

    expect(sidePlayers(result, "A")).toEqual(["p2", "p1"]);
    expect(sidePlayers(result, "B")).toEqual(["p4", "p3"]);
    // The A block still comes before the B block.
    expect(result.players.map((p) => p.side)).toEqual(["A", "A", "B", "B"]);
  });

  it("looks seeds up once for all the matches' tournaments, and only applies a tournament's own seeds", async () => {
    const loadSeeded = vi.fn().mockResolvedValue([{ tournamentId: "t2", playerId: "p2" }]);

    const [inT1, inT2] = await seededFirstMatches([doubles("m1", "t1"), doubles("m2", "t2")], loadSeeded);

    expect(loadSeeded).toHaveBeenCalledTimes(1);
    expect(loadSeeded).toHaveBeenCalledWith(["t1", "t2"]);
    expect(sidePlayers(inT1, "A")).toEqual(["p1", "p2"]); // p2 is only seeded in t2
    expect(sidePlayers(inT2, "A")).toEqual(["p2", "p1"]);
  });

  it("leaves a pair with no seed (or two seeds) as it was", async () => {
    const loadSeeded = vi.fn().mockResolvedValue([
      { tournamentId: "t1", playerId: "p3" },
      { tournamentId: "t1", playerId: "p4" },
    ]);

    const [result] = await seededFirstMatches([doubles("m1")], loadSeeded);

    expect(sidePlayers(result, "A")).toEqual(["p1", "p2"]);
    expect(sidePlayers(result, "B")).toEqual(["p3", "p4"]);
  });

  it("skips the lookup entirely when every match is singles", async () => {
    const loadSeeded = vi.fn();
    const singles: TestMatch = {
      id: "m1",
      tournamentId: "t1",
      players: [
        { side: "A", playerId: "p1" },
        { side: "B", playerId: "p2" },
      ],
    };

    const result = await seededFirstMatches([singles], loadSeeded);

    expect(loadSeeded).not.toHaveBeenCalled();
    expect(result).toEqual([singles]);
  });

  it("does not mutate the matches it was given", async () => {
    const match = doubles("m1");
    const loadSeeded = vi.fn().mockResolvedValue([{ tournamentId: "t1", playerId: "p2" }]);

    await seededFirstMatches([match], loadSeeded);

    expect(sidePlayers(match, "A")).toEqual(["p1", "p2"]);
  });
});
