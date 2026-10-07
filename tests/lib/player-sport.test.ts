import { describe, expect, it } from "vitest";

import { playsSport, sportsMatching } from "@/lib/player-sport";

describe("player-sport", () => {
  it("sportsMatching includes the sport itself and BOTH", () => {
    expect(sportsMatching("TENNIS")).toEqual(["TENNIS", "BOTH"]);
    expect(sportsMatching("PADEL")).toEqual(["PADEL", "BOTH"]);
  });

  it("playsSport is true for the matching sport and for BOTH, false otherwise", () => {
    expect(playsSport({ sports: "TENNIS" }, "TENNIS")).toBe(true);
    expect(playsSport({ sports: "TENNIS" }, "PADEL")).toBe(false);
    expect(playsSport({ sports: "PADEL" }, "PADEL")).toBe(true);
    expect(playsSport({ sports: "PADEL" }, "TENNIS")).toBe(false);
    expect(playsSport({ sports: "BOTH" }, "TENNIS")).toBe(true);
    expect(playsSport({ sports: "BOTH" }, "PADEL")).toBe(true);
  });
});
