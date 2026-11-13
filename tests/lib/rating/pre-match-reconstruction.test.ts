import { describe, expect, it } from "vitest";

import { computeDoublesRatings, computeSinglesRatings } from "@/lib/rating/engine";
import type { RatingMatchRow } from "@/lib/rating/engine";
import { matchWinProbability } from "@/lib/rating/match-preview";
import { reconstructPreMatchWinProbs } from "@/lib/rating/pre-match-reconstruction";
import type { ReconstructionRow } from "@/lib/rating/pre-match-reconstruction";

function row(
  id: string,
  tournamentId: string,
  tournamentStartDate: number,
  completedAt: number,
  sideA: string[],
  sideB: string[],
  winnerSide: "A" | "B" = "A",
): ReconstructionRow {
  return {
    id,
    tournamentId,
    tournamentStartDate,
    completedAt,
    createdAt: completedAt,
    winnerSide,
    round: null,
    tournamentParticipantCount: 4,
    players: [
      ...sideA.map((playerId) => ({ side: "A" as const, playerId, seeded: false })),
      ...sideB.map((playerId) => ({ side: "B" as const, playerId, seeded: false })),
    ],
    sets: [winnerSide === "A" ? { sideAGames: 6, sideBGames: 2 } : { sideAGames: 2, sideBGames: 6 }],
  };
}

/** What the live preview would compute from exactly these already-completed rows. */
function expectedSingles(history: RatingMatchRow[], match: ReconstructionRow) {
  const ratings = new Map([...computeSinglesRatings(history).values()].map((r) => [r.playerId, r.rating]));
  return matchWinProbability({ matchType: "SINGLES", players: match.players }, ratings, new Map())?.probA ?? null;
}

describe("reconstructPreMatchWinProbs", () => {
  it("has no prediction for a match where a player had never played this format", () => {
    const first = row("m1", "t1", 100, 1000, ["p1"], ["p2"]);
    expect(reconstructPreMatchWinProbs([first], "SINGLES", null).get("m1")).toBeNull();
  });

  it("predicts a later tournament's match from everything played in earlier tournaments", () => {
    const t1 = [row("m1", "t1", 100, 1000, ["p1"], ["p2"]), row("m2", "t1", 100, 1001, ["p1"], ["p2"])];
    const rematch = row("m3", "t2", 200, 2000, ["p1"], ["p2"]);
    const probs = reconstructPreMatchWinProbs([...t1, rematch], "SINGLES", null);

    expect(probs.get("m3")).toBeCloseTo(expectedSingles(t1, rematch)!, 10);
    expect(probs.get("m3")).toBeGreaterThan(0.5);
  });

  it("within a tournament counts only matches completed before this one - a tie on completedAt doesn't count", () => {
    const t1 = [row("m1", "t1", 100, 1000, ["p1"], ["p2"])];
    const m2 = row("m2", "t2", 200, 10, ["p1"], ["p3"]);
    const m3 = row("m3", "t2", 200, 20, ["p2"], ["p3"], "B");
    const m4 = row("m4", "t2", 200, 20, ["p1"], ["p2"]);
    const probs = reconstructPreMatchWinProbs([...t1, m2, m3, m4], "SINGLES", null);

    // p3's first match - no rating yet.
    expect(probs.get("m2")).toBeNull();
    // m3 sees m2 (completed earlier) but not m4 (same completedAt), and vice versa.
    expect(probs.get("m3")).toBeCloseTo(expectedSingles([...t1, m2], m3)!, 10);
    expect(probs.get("m4")).toBeCloseTo(expectedSingles([...t1, m2], m4)!, 10);
  });

  it("orders tournaments by start date, not by when their results were typed in", () => {
    // The older tournament's results were entered AFTER the newer one's
    // (retroactive import) - it must still count as earlier history.
    const older = row("old", "t-2024", 100, 9000, ["p1"], ["p2"]);
    const newer = row("new", "t-2025", 200, 5000, ["p1"], ["p2"]);
    const probs = reconstructPreMatchWinProbs([newer, older], "SINGLES", null);

    expect(probs.get("old")).toBeNull();
    expect(probs.get("new")).toBeCloseTo(expectedSingles([older], newer)!, 10);
  });

  it("hides players outside eligibleIds, like the women's pool's live ratings do", () => {
    const t1 = [row("m1", "t1", 100, 1000, ["p1"], ["p2"])];
    const rematch = row("m2", "t2", 200, 2000, ["p1"], ["p2"]);

    expect(reconstructPreMatchWinProbs([...t1, rematch], "SINGLES", new Set(["p1", "p2"])).get("m2")).not.toBeNull();
    expect(reconstructPreMatchWinProbs([...t1, rematch], "SINGLES", new Set(["p1"])).get("m2")).toBeNull();
  });

  it("uses the doubles (OpenSkill) ratings for a doubles pool", () => {
    const t1 = [row("d1", "t1", 100, 1000, ["p1", "p2"], ["p3", "p4"])];
    const rematch = row("d2", "t2", 200, 2000, ["p1", "p2"], ["p3", "p4"]);
    const probs = reconstructPreMatchWinProbs([...t1, rematch], "DOUBLES", null);

    const ratings = new Map([...computeDoublesRatings(t1).values()].map((r) => [r.playerId, r.rating]));
    const expected = matchWinProbability({ matchType: "DOUBLES", players: rematch.players }, new Map(), ratings);
    expect(probs.get("d1")).toBeNull();
    expect(probs.get("d2")).toBeCloseTo(expected!.probA, 10);
    expect(probs.get("d2")).toBeGreaterThan(0.5);
  });
});

describe("reconstructPreMatchWinProbs - incremental replay matches a full replay per match", () => {
  // Deterministic pseudo-random history: 5 tournaments (two sharing a start
  // date), 8 players, repeated completedAt values (bulk-import ties), both
  // results directions, and players who sit out whole tournaments.
  function seededRandom(seed: number) {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
    };
  }

  function history(format: "SINGLES" | "DOUBLES"): ReconstructionRow[] {
    const random = seededRandom(format === "SINGLES" ? 7 : 11);
    const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
    const starts = [100, 200, 200, 300, 400];
    const rows: ReconstructionRow[] = [];
    starts.forEach((start, t) => {
      for (let i = 0; i < 9; i++) {
        const shuffled = [...players].sort(() => random() - 0.5);
        const size = format === "SINGLES" ? 1 : 2;
        const completedAt = 1000 * t + Math.floor(i / 2) * 10; // pairs of matches share a timestamp
        rows.push(
          row(
            `${format}-t${t}-m${i}`,
            `t${t}`,
            start,
            completedAt,
            shuffled.slice(0, size),
            shuffled.slice(size, 2 * size),
            random() < 0.5 ? "A" : "B",
          ),
        );
      }
    });
    return rows;
  }

  /** The straightforward definition: replay all of history from scratch for every match. */
  function naive(rows: ReconstructionRow[], format: "SINGLES" | "DOUBLES", eligibleIds: Set<string> | null) {
    const tournaments = [...new Set(rows.map((r) => r.tournamentId))].sort((a, b) => {
      const sa = rows.find((r) => r.tournamentId === a)!.tournamentStartDate;
      const sb = rows.find((r) => r.tournamentId === b)!.tournamentStartDate;
      return sa - sb || a.localeCompare(b);
    });
    const result = new Map<string, number | null>();
    tournaments.forEach((tournamentId, index) => {
      const earlier = rows.filter((r) => tournaments.indexOf(r.tournamentId) < index);
      for (const match of rows.filter((r) => r.tournamentId === tournamentId)) {
        const replay = [
          ...earlier,
          ...rows.filter((r) => r.tournamentId === tournamentId && r.completedAt < match.completedAt),
        ];
        const keep = (id: string) => !eligibleIds || eligibleIds.has(id);
        const probability =
          format === "SINGLES"
            ? matchWinProbability(
                { matchType: format, players: match.players },
                new Map([...computeSinglesRatings(replay).values()].filter((r) => keep(r.playerId)).map((r) => [r.playerId, r.rating])),
                new Map(),
              )
            : matchWinProbability(
                { matchType: format, players: match.players },
                new Map(),
                new Map([...computeDoublesRatings(replay).values()].filter((r) => keep(r.playerId)).map((r) => [r.playerId, r.rating])),
              );
        result.set(match.id, probability?.probA ?? null);
      }
    });
    return result;
  }

  for (const format of ["SINGLES", "DOUBLES"] as const) {
    for (const eligibleIds of [null, new Set(["p1", "p2", "p3", "p4", "p5", "p6", "p7"])]) {
      it(`${format}, ${eligibleIds ? "with" : "without"} an eligibility filter`, () => {
        const rows = history(format);
        const expected = naive(rows, format, eligibleIds);
        const actual = reconstructPreMatchWinProbs(rows, format, eligibleIds);

        expect(actual.size).toBe(rows.length);
        // Enough real predictions that the comparison below means something.
        expect([...expected.values()].filter((p) => p != null).length).toBeGreaterThan(10);
        for (const [id, probability] of expected) {
          if (probability == null) expect(actual.get(id)).toBeNull();
          else expect(actual.get(id)).toBeCloseTo(probability, 12);
        }
      });
    }
  }
});
