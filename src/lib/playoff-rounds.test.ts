import { describe, expect, it } from "vitest";

import {
  BRACKET_ROUND_PICKER_OPTIONS,
  detectPlayoffMode,
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

describe("detectPlayoffMode", () => {
  it("returns null for an empty list", () => {
    expect(detectPlayoffMode([])).toBeNull();
  });

  it("returns null when no round is a curated playoff round", () => {
    expect(detectPlayoffMode([null, "Сіяні", "Несіяні", "Товариський"])).toBeNull();
  });

  it("returns bracket when any bracket-exclusive round is present", () => {
    expect(detectPlayoffMode(["1/2", "1/2", null])).toBe("bracket");
    expect(detectPlayoffMode(["1/8"])).toBe("bracket");
    expect(detectPlayoffMode(["1/4"])).toBe("bracket");
  });

  it("returns list when only placement-exclusive rounds are present", () => {
    expect(detectPlayoffMode(["За 5 місце"])).toBe("list");
    expect(detectPlayoffMode(["Фінал", "За 3 місце"])).toBe("list");
    expect(detectPlayoffMode(["За 11 місце"])).toBe("list");
    expect(detectPlayoffMode(["За 9 місце"])).toBe("list");
  });

  it("defaults to bracket when only 'Фінал' is present (tie-break)", () => {
    expect(detectPlayoffMode(["Фінал"])).toBe("bracket");
  });

  it("prefers bracket when both bracket- and placement-exclusive rounds are present", () => {
    expect(detectPlayoffMode(["Фінал", "1/2"])).toBe("bracket");
    expect(detectPlayoffMode(["1/2", "За 3 місце"])).toBe("bracket");
  });

  it("ignores non-playoff entries mixed in", () => {
    expect(detectPlayoffMode(["Фінал", null, "Сіяні"])).toBe("bracket");
  });
});

describe("groupPlayoffMatches", () => {
  type Row = { id: string; round: string | null };

  it("skips empty bracket stages and orders the remaining ones by bracket order", () => {
    const matches: Row[] = [
      { id: "a", round: "Фінал" },
      { id: "b", round: "1/2" },
    ];
    const groups = groupPlayoffMatches(matches, "bracket");
    expect(groups.map((g) => g.round)).toEqual(["1/2", "Фінал"]);
  });

  it("appends placement-exclusive rounds after the bracket stages when both are present", () => {
    const matches: Row[] = [
      { id: "a", round: "За 3 місце" },
      { id: "b", round: "1/2" },
      { id: "c", round: "Фінал" },
    ];
    const groups = groupPlayoffMatches(matches, "bracket");
    expect(groups.map((g) => g.round)).toEqual(["1/2", "Фінал", "За 3 місце"]);
  });

  it("orders list mode strictly За 11 -> За 9 -> За 7 -> За 5 -> За 3 -> Фінал regardless of input order", () => {
    const matches: Row[] = [
      { id: "a", round: "За 3 місце" },
      { id: "b", round: "За 7 місце" },
      { id: "c", round: "За 11 місце" },
    ];
    const groups = groupPlayoffMatches(matches, "list");
    expect(groups.map((g) => g.round)).toEqual(["За 11 місце", "За 7 місце", "За 3 місце"]);
  });

  it("appends За 9/11 місце after the bracket stages too, when run alongside a bracket", () => {
    const matches: Row[] = [
      { id: "a", round: "За 11 місце" },
      { id: "b", round: "1/2" },
      { id: "c", round: "Фінал" },
    ];
    const groups = groupPlayoffMatches(matches, "bracket");
    expect(groups.map((g) => g.round)).toEqual(["1/2", "Фінал", "За 11 місце"]);
  });

  it("groups multiple matches sharing a round together, preserving input order", () => {
    const matches: Row[] = [
      { id: "a", round: "1/4" },
      { id: "b", round: "1/4" },
      { id: "c", round: "1/2" },
    ];
    const groups = groupPlayoffMatches(matches, "bracket");
    expect(groups).toEqual([
      { round: "1/4", matches: [{ id: "a", round: "1/4" }, { id: "b", round: "1/4" }] },
      { round: "1/2", matches: [{ id: "c", round: "1/2" }] },
    ]);
  });
});

describe("BRACKET_ROUND_PICKER_OPTIONS", () => {
  it("includes the bronze-medal match between the semifinal and the final", () => {
    expect(BRACKET_ROUND_PICKER_OPTIONS).toEqual(["1/8", "1/4", "1/2", "За 3 місце", "Фінал"]);
  });
});
