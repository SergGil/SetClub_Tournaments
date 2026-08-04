import { describe, expect, it } from "vitest";

import {
  BRACKET_ROUND_PICKER_OPTIONS,
  canonicalizeRound,
  groupPlayoffMatches,
  isPlayoffRound,
} from "./playoff-rounds";

describe("isPlayoffRound", () => {
  it("accepts each of the 9 curated round strings", () => {
    const rounds = [
      "1/8",
      "1/4",
      "1/2",
      "Фінал",
      "За 11 місце",
      "За 9 місце",
      "За 7 місце",
      "За 5 місце",
      "За 3 місце",
    ];
    for (const round of rounds) expect(isPlayoffRound(round)).toBe(true);
  });

  it("rejects null, empty, legacy, and custom round text", () => {
    expect(isPlayoffRound(null)).toBe(false);
    expect(isPlayoffRound(undefined)).toBe(false);
    expect(isPlayoffRound("")).toBe(false);
    expect(isPlayoffRound("Сіяні")).toBe(false);
    expect(isPlayoffRound("Несіяні")).toBe(false);
    expect(isPlayoffRound("Товариський матч")).toBe(false);
  });

  it("is case-sensitive - only the exact literal strings match", () => {
    expect(isPlayoffRound("фінал")).toBe(false);
    expect(isPlayoffRound("ФІНАЛ")).toBe(false);
  });
});

describe("groupPlayoffMatches", () => {
  type Row = { id: string; round: string | null };

  it("orders every stage present in the fixed display order, skipping empty ones", () => {
    const matches: Row[] = [
      { id: "a", round: "1/4" },
      { id: "b", round: "Фінал" },
      { id: "c", round: "1/2" },
      { id: "d", round: "За 3 місце" },
    ];
    const groups = groupPlayoffMatches(matches);
    expect(groups.map((g) => g.round)).toEqual(["Фінал", "За 3 місце", "1/2", "1/4"]);
  });

  it("orders strictly Фінал -> За 3 -> 1/2 -> За 5 -> За 7 -> 1/4 -> За 9 -> За 11 -> 1/8 regardless of input order", () => {
    const matches: Row[] = [
      { id: "a", round: "1/8" },
      { id: "b", round: "За 11 місце" },
      { id: "c", round: "За 9 місце" },
      { id: "d", round: "1/4" },
      { id: "e", round: "За 7 місце" },
      { id: "f", round: "За 5 місце" },
      { id: "g", round: "1/2" },
      { id: "h", round: "За 3 місце" },
      { id: "i", round: "Фінал" },
    ];
    const groups = groupPlayoffMatches(matches);
    expect(groups.map((g) => g.round)).toEqual([
      "Фінал",
      "За 3 місце",
      "1/2",
      "За 5 місце",
      "За 7 місце",
      "1/4",
      "За 9 місце",
      "За 11 місце",
      "1/8",
    ]);
  });

  it("groups multiple matches sharing a round together, preserving input order", () => {
    const matches: Row[] = [
      { id: "a", round: "1/4" },
      { id: "b", round: "1/4" },
      { id: "c", round: "1/2" },
    ];
    const groups = groupPlayoffMatches(matches);
    expect(groups).toEqual([
      { round: "1/2", matches: [{ id: "c", round: "1/2" }] },
      { round: "1/4", matches: [{ id: "a", round: "1/4" }, { id: "b", round: "1/4" }] },
    ]);
  });
});

describe("canonicalizeRound", () => {
  it("passes an already-canonical round through unchanged", () => {
    expect(canonicalizeRound("Фінал")).toBe("Фінал");
    expect(canonicalizeRound("За 3 місце")).toBe("За 3 місце");
  });

  it("snaps a wrong-case match to the canonical spelling", () => {
    expect(canonicalizeRound("фінал")).toBe("Фінал");
    expect(canonicalizeRound("ФІНАЛ")).toBe("Фінал");
    expect(canonicalizeRound("за 3 місце")).toBe("За 3 місце");
  });

  it("trims surrounding whitespace before and after matching", () => {
    expect(canonicalizeRound("  Фінал  ")).toBe("Фінал");
    expect(canonicalizeRound(" фінал ")).toBe("Фінал");
  });

  it("leaves genuinely custom text alone (trimmed, not matched)", () => {
    expect(canonicalizeRound("  Товариський матч  ")).toBe("Товариський матч");
  });

  it("maps null and blank/whitespace-only input to null", () => {
    expect(canonicalizeRound(null)).toBeNull();
    expect(canonicalizeRound("")).toBeNull();
    expect(canonicalizeRound("   ")).toBeNull();
  });
});

describe("BRACKET_ROUND_PICKER_OPTIONS", () => {
  it("includes the bronze-medal match between the semifinal and the final", () => {
    expect(BRACKET_ROUND_PICKER_OPTIONS).toEqual(["1/8", "1/4", "1/2", "За 3 місце", "Фінал"]);
  });
});
