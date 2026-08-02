import { rate } from "openskill";
import { describe, expect, it } from "vitest";

import { conservativeOrdinal, displayRating, OPENSKILL_DEFAULT, updateDoublesMatch } from "./openskill";
import type { OpenSkillRating } from "./openskill";

describe("updateDoublesMatch", () => {
  it("matches the library's own unmodified rate() when the score gap is within the margin", () => {
    const teamA: [OpenSkillRating, OpenSkillRating] = [OPENSKILL_DEFAULT, OPENSKILL_DEFAULT];
    const teamB: [OpenSkillRating, OpenSkillRating] = [OPENSKILL_DEFAULT, OPENSKILL_DEFAULT];

    const result = updateDoublesMatch(teamA, teamB, "A", 7, 6);
    const [baselineA, baselineB] = rate([teamA, teamB], { rank: [0, 1] });

    expect(result.teamA[0].mu).toBeCloseTo(baselineA[0].mu, 8);
    expect(result.teamA[0].sigma).toBeCloseTo(baselineA[0].sigma, 8);
    expect(result.teamB[0].mu).toBeCloseTo(baselineB[0].mu, 8);
  });

  it("gives a bigger mu swing for a shutout than for a squeaker", () => {
    const teamA: [OpenSkillRating, OpenSkillRating] = [OPENSKILL_DEFAULT, OPENSKILL_DEFAULT];
    const teamB: [OpenSkillRating, OpenSkillRating] = [OPENSKILL_DEFAULT, OPENSKILL_DEFAULT];

    const squeaker = updateDoublesMatch(teamA, teamB, "A", 7, 6);
    const shutout = updateDoublesMatch(teamA, teamB, "A", 6, 0);

    const squeakerDelta = squeaker.teamA[0].mu - OPENSKILL_DEFAULT.mu;
    const shutoutDelta = shutout.teamA[0].mu - OPENSKILL_DEFAULT.mu;
    expect(shutoutDelta).toBeGreaterThan(squeakerDelta);
  });

  it("moves equally-uncertain partners by the identical mu delta", () => {
    const teamA: [OpenSkillRating, OpenSkillRating] = [OPENSKILL_DEFAULT, OPENSKILL_DEFAULT];
    const teamB: [OpenSkillRating, OpenSkillRating] = [OPENSKILL_DEFAULT, OPENSKILL_DEFAULT];

    const result = updateDoublesMatch(teamA, teamB, "B", 2, 6);
    const deltaA0 = result.teamA[0].mu - teamA[0].mu;
    const deltaA1 = result.teamA[1].mu - teamA[1].mu;
    expect(deltaA0).toBeCloseTo(deltaA1, 8);
  });

  it("gives the less-certain (higher-sigma) partner a bigger share of the team's mu delta", () => {
    const uncertain: OpenSkillRating = { mu: 25, sigma: 25 / 3 };
    const established: OpenSkillRating = { mu: 25, sigma: 2 };
    const teamA: [OpenSkillRating, OpenSkillRating] = [uncertain, established];
    const teamB: [OpenSkillRating, OpenSkillRating] = [OPENSKILL_DEFAULT, OPENSKILL_DEFAULT];

    const result = updateDoublesMatch(teamA, teamB, "A", 6, 0);
    const deltaUncertain = Math.abs(result.teamA[0].mu - uncertain.mu);
    const deltaEstablished = Math.abs(result.teamA[1].mu - established.mu);
    expect(deltaUncertain).toBeGreaterThan(deltaEstablished);
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
