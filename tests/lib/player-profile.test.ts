import { describe, expect, it } from "vitest";

import { buildProfileView, matchResultForPlayer, matchYear, playedAgainst } from "@/lib/player-profile";
import type { ProfileMatch } from "@/lib/player-profile";

function person(id: string, name: string) {
  return { playerId: id, player: { name, nickname: null, user: { image: null } } };
}

function match(overrides: Partial<ProfileMatch> & { id: string }): ProfileMatch & { id: string } {
  return {
    winnerSide: "A",
    walkover: false,
    status: "COMPLETED",
    matchType: "SINGLES",
    scheduledDate: new Date("2026-03-01T00:00:00.000Z"),
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    sets: [{ sideAGames: 6, sideBGames: 3 }],
    tournament: { id: "t1", name: "Весна" },
    players: [
      { ...person("me", "Я"), side: "A" },
      { ...person("opp", "Суперник"), side: "B" },
    ],
    ...overrides,
  };
}

const win = match({ id: "m1" });
const loss = match({ id: "m2", winnerSide: "B", tournament: { id: "t2", name: "Літо" }, scheduledDate: new Date("2025-07-01T00:00:00.000Z") });
const doublesWin = match({
  id: "m3",
  matchType: "DOUBLES",
  players: [
    { ...person("me", "Я"), side: "A" },
    { ...person("mate", "Партнер"), side: "A" },
    { ...person("opp", "Суперник"), side: "B" },
    { ...person("opp2", "Інший"), side: "B" },
  ],
});
const matches = [win, loss, doublesWin];

describe("player-profile helpers", () => {
  it("playedAgainst is true for an opponent and false for a teammate or a stranger", () => {
    expect(playedAgainst(doublesWin, "me", "opp")).toBe(true);
    expect(playedAgainst(doublesWin, "me", "mate")).toBe(false);
    expect(playedAgainst(doublesWin, "me", "nobody")).toBe(false);
  });

  it("matchResultForPlayer is walkover-aware: the withdrawn side has no result", () => {
    expect(matchResultForPlayer(win, "me")).toBe("win");
    expect(matchResultForPlayer(loss, "me")).toBe("loss");
    const walkover = match({ id: "w", walkover: true });
    expect(matchResultForPlayer(walkover, "me")).toBe("win");
    expect(matchResultForPlayer(walkover, "opp")).toBeNull();
    expect(matchResultForPlayer(match({ id: "u", winnerSide: null }), "me")).toBeNull();
  });

  it("matchYear prefers scheduledDate, falls back to createdAt", () => {
    expect(matchYear(loss)).toBe(2025);
    expect(matchYear(match({ id: "x", scheduledDate: null, createdAt: new Date("2024-02-02T00:00:00.000Z") }))).toBe(2024);
  });
});

describe("buildProfileView", () => {
  it("lists distinct opponents (not teammates) and tournaments, recency order kept", () => {
    const view = buildProfileView(matches, "me", {}, "/players/me");
    expect(view.opponents.map((o) => o.id).sort()).toEqual(["opp", "opp2"]);
    expect(view.tournaments.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(view.visibleMatches).toHaveLength(3);
  });

  it("filters by result, then format, and only offers years from the player's decided matches", () => {
    const view = buildProfileView(matches, "me", { result: "win", type: "DOUBLES" }, "/players/me");
    expect(view.selectedResult).toBe("win");
    expect(view.visibleMatches.map((m) => (m as { id: string }).id)).toEqual(["m3"]);
    expect(view.resultYears).toEqual([2026, 2025]);
  });

  it("ignores unknown filter values and a year with no matches", () => {
    const view = buildProfileView(matches, "me", { result: "draw", type: "MIXED", year: "1999" }, "/players/me");
    expect(view.selectedResult).toBeUndefined();
    expect(view.selectedType).toBeUndefined();
    expect(view.activeYear).toBeUndefined();
    expect(view.visibleMatches).toHaveLength(3);
  });

  it("builds a head-to-head summary against the selected opponent, regardless of the result filter", () => {
    const view = buildProfileView(matches, "me", { opponent: "opp", result: "win" }, "/players/me");
    expect(view.selectedOpponent?.id).toBe("opp");
    // win, loss and the doubles win all had "opp" on the other side -> 2-1, even though the list is wins-only.
    expect(view.h2hStats).toMatchObject({ wins: 2, losses: 1, matchesPlayed: 3 });
    expect(view.recentH2HResults).toEqual(["win", "loss", "win"]);
    expect(view.visibleMatches).toHaveLength(2);
  });

  it("profileHref keeps the active filters, lets overrides replace or clear them, and uses the given base path", () => {
    const view = buildProfileView(matches, "me", { opponent: "opp", result: "win" }, "/padel/players/me");
    expect(view.profileHref()).toBe("/padel/players/me?opponent=opp&result=win");
    expect(view.profileHref({ result: undefined })).toBe("/padel/players/me?opponent=opp");
    expect(view.profileHref({ result: "loss", type: "SINGLES" })).toBe(
      "/padel/players/me?opponent=opp&result=loss&type=SINGLES",
    );
    expect(buildProfileView(matches, "me", {}, "/players/me").profileHref()).toBe("/players/me");
  });
});
