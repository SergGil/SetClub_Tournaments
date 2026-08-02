import { rate } from "openskill";
import { describe, expect, it } from "vitest";

import { conservativeOrdinal, displayRating, OPENSKILL_DEFAULT, updateDoublesMatch } from "./openskill";
import type { OpenSkillRating } from "./openskill";

// No seed signal (both false) - exercises the sigma-proportional fallback split.
const NO_SEED: [boolean, boolean] = [false, false];

describe("updateDoublesMatch", () => {
  it("matches the library's own unmodified rate() when the score gap is within the margin", () => {
    const teamA: [OpenSkillRating, OpenSkillRating] = [OPENSKILL_DEFAULT, OPENSKILL_DEFAULT];
    const teamB: [OpenSkillRating, OpenSkillRating] = [OPENSKILL_DEFAULT, OPENSKILL_DEFAULT];

    const result = updateDoublesMatch(teamA, teamB, "A", 7, 6, NO_SEED, NO_SEED);
    const [baselineA, baselineB] = rate([teamA, teamB], { rank: [0, 1] });

    expect(result.teamA[0].mu).toBeCloseTo(baselineA[0].mu, 8);
    expect(result.teamA[0].sigma).toBeCloseTo(baselineA[0].sigma, 8);
    expect(result.teamB[0].mu).toBeCloseTo(baselineB[0].mu, 8);
  });

  it("gives a bigger mu swing for a shutout than for a squeaker", () => {
    const teamA: [OpenSkillRating, OpenSkillRating] = [OPENSKILL_DEFAULT, OPENSKILL_DEFAULT];
    const teamB: [OpenSkillRating, OpenSkillRating] = [OPENSKILL_DEFAULT, OPENSKILL_DEFAULT];

    const squeaker = updateDoublesMatch(teamA, teamB, "A", 7, 6, NO_SEED, NO_SEED);
    const shutout = updateDoublesMatch(teamA, teamB, "A", 6, 0, NO_SEED, NO_SEED);

    const squeakerDelta = squeaker.teamA[0].mu - OPENSKILL_DEFAULT.mu;
    const shutoutDelta = shutout.teamA[0].mu - OPENSKILL_DEFAULT.mu;
    expect(shutoutDelta).toBeGreaterThan(squeakerDelta);
  });

  it("moves equally-uncertain partners by the identical mu delta when seed status doesn't differentiate them", () => {
    const teamA: [OpenSkillRating, OpenSkillRating] = [OPENSKILL_DEFAULT, OPENSKILL_DEFAULT];
    const teamB: [OpenSkillRating, OpenSkillRating] = [OPENSKILL_DEFAULT, OPENSKILL_DEFAULT];

    const result = updateDoublesMatch(teamA, teamB, "B", 2, 6, NO_SEED, NO_SEED);
    const deltaA0 = result.teamA[0].mu - teamA[0].mu;
    const deltaA1 = result.teamA[1].mu - teamA[1].mu;
    expect(deltaA0).toBeCloseTo(deltaA1, 8);
  });

  it("gives the less-certain (higher-sigma) partner a bigger share when seed status doesn't differentiate them", () => {
    const uncertain: OpenSkillRating = { mu: 25, sigma: 25 / 3 };
    const established: OpenSkillRating = { mu: 25, sigma: 2 };
    const teamA: [OpenSkillRating, OpenSkillRating] = [uncertain, established];
    const teamB: [OpenSkillRating, OpenSkillRating] = [OPENSKILL_DEFAULT, OPENSKILL_DEFAULT];

    const result = updateDoublesMatch(teamA, teamB, "A", 6, 0, NO_SEED, NO_SEED);
    const deltaUncertain = Math.abs(result.teamA[0].mu - uncertain.mu);
    const deltaEstablished = Math.abs(result.teamA[1].mu - established.mu);
    expect(deltaUncertain).toBeGreaterThan(deltaEstablished);
  });

  it("gives the seeded partner 60% of the team's total mu delta when seed status differentiates them", () => {
    // Equal, low sigma so the library's own sigma-based split would otherwise be ~50/50,
    // isolating the seed-based redistribution's effect.
    const established: OpenSkillRating = { mu: 25, sigma: 2 };
    const teamA: [OpenSkillRating, OpenSkillRating] = [established, established];
    const teamB: [OpenSkillRating, OpenSkillRating] = [OPENSKILL_DEFAULT, OPENSKILL_DEFAULT];

    const result = updateDoublesMatch(teamA, teamB, "A", 6, 0, [true, false], NO_SEED);
    const deltaSeeded = result.teamA[0].mu - established.mu;
    const deltaUnseeded = result.teamA[1].mu - established.mu;
    const total = deltaSeeded + deltaUnseeded;

    expect(deltaSeeded).toBeCloseTo(0.6 * total, 8);
    expect(deltaUnseeded).toBeCloseTo(0.4 * total, 8);
    // Sigma stays whatever the library computed - unaffected by the seed redistribution.
    const libraryResult = rate([teamA, teamB], { rank: [0, 1], score: [6, 0], margin: 1 });
    expect(result.teamA[0].sigma).toBeCloseTo(libraryResult[0][0].sigma, 8);
  });

  it("conserves the team's total mu delta regardless of how it's redistributed", () => {
    const teamA: [OpenSkillRating, OpenSkillRating] = [OPENSKILL_DEFAULT, { mu: 30, sigma: 5 }];
    const teamB: [OpenSkillRating, OpenSkillRating] = [OPENSKILL_DEFAULT, OPENSKILL_DEFAULT];

    const withoutSeed = updateDoublesMatch(teamA, teamB, "A", 6, 2, NO_SEED, NO_SEED);
    const withSeed = updateDoublesMatch(teamA, teamB, "A", 6, 2, [true, false], NO_SEED);

    const totalWithoutSeed =
      withoutSeed.teamA[0].mu - teamA[0].mu + (withoutSeed.teamA[1].mu - teamA[1].mu);
    const totalWithSeed = withSeed.teamA[0].mu - teamA[0].mu + (withSeed.teamA[1].mu - teamA[1].mu);
    expect(totalWithSeed).toBeCloseTo(totalWithoutSeed, 8);
  });
});

describe("display scale", () => {
  it("maps the default OpenSkill rating close to the Glicko-2 baseline of 1500", () => {
    expect(displayRating(OPENSKILL_DEFAULT.mu)).toBeCloseTo(1500, 5);
  });

  it("conservativeOrdinal is below displayRating(mu) for an uncertain (high-sigma) rating", () => {
    const uncertain: OpenSkillRating = { mu: 25, sigma: 25 / 3 };
    expect(conservativeOrdinal(uncertain)).toBeLessThan(displayRating(uncertain.mu));
  });
});
