import { beforeEach, describe, expect, it, vi } from "vitest";

const { tournamentFindMany, padelFindMany, tennisStandings, padelStandings } = vi.hoisted(() => ({
  tournamentFindMany: vi.fn(),
  padelFindMany: vi.fn(),
  tennisStandings: vi.fn(),
  padelStandings: vi.fn(),
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: (...args: unknown[]) => unknown) => fn }));
vi.mock("@/lib/db", () => ({
  prisma: {
    tournament: { findMany: tournamentFindMany },
    padelTournament: { findMany: padelFindMany },
  },
}));
vi.mock("@/lib/stats", () => ({ STATS_CACHE_TAG: "match-stats" }));
vi.mock("@/lib/padel-stats", () => ({ PADEL_STATS_CACHE_TAG: "padel-match-stats" }));
vi.mock("@/lib/tournament-standings", () => ({ getTournamentStandingsRows: tennisStandings }));
vi.mock("@/lib/padel-tournament-standings", () => ({ getPadelTournamentStandingsRows: padelStandings }));

import { buildRoundRobinTitles, getPadelRoundRobinTitles, getRoundRobinTitles } from "@/lib/tournament-titles";
import type { RoundRobinStandings, RoundRobinTitleCandidate } from "@/lib/tournament-titles";

function day(n: number, hour = 0): Date {
  return new Date(2026, 10, n, hour);
}

function candidate(overrides: Partial<RoundRobinTitleCandidate> = {}): RoundRobinTitleCandidate {
  return {
    id: "t1",
    format: "DOUBLES",
    status: "COMPLETED",
    participants: [],
    matches: [{ scheduledDate: day(8), completedAt: day(8, 15), createdAt: day(1) }],
    ...overrides,
  };
}

const individual = (rows: { key: string; wins: number }[], roundRobinDone = true): RoundRobinStandings => ({
  mode: "individual",
  rows,
  roundRobinDone,
});
const GROUPED: RoundRobinStandings = { mode: "grouped" };

describe("buildRoundRobinTitles", () => {
  it("names both players of the winning doubles pair, from the team row key (a+b)", async () => {
    const titles = await buildRoundRobinTitles([candidate()], async () =>
      individual([
        { key: "eugene+hanna", wins: 5 },
        { key: "a+b", wins: 3 },
      ]),
    );
    expect(titles).toEqual([
      { tournamentId: "t1", matchType: "DOUBLES", winnerIds: ["eugene", "hanna"], decidedAt: day(8).getTime() },
    ]);
  });

  it("names the single winner of a singles round robin", async () => {
    const titles = await buildRoundRobinTitles([candidate({ format: "SINGLES" })], async () =>
      individual([{ key: "p1", wins: 4 }]),
    );
    expect(titles).toEqual([{ tournamentId: "t1", matchType: "SINGLES", winnerIds: ["p1"], decidedAt: day(8).getTime() }]);
  });

  it("dates the title to the latest decided match, preferring each match's scheduledDate like playedAt does", async () => {
    const titles = await buildRoundRobinTitles(
      [
        candidate({
          matches: [
            // scheduledDate wins over a later completedAt...
            { scheduledDate: day(8), completedAt: day(10), createdAt: day(1) },
            // ...and a match with no scheduledDate falls back to completedAt, the latest here.
            { scheduledDate: null, completedAt: day(9), createdAt: day(1) },
            { scheduledDate: null, completedAt: null, createdAt: day(2) },
          ],
        }),
      ],
      async () => individual([{ key: "a+b", wins: 1 }]),
    );
    expect(titles[0]?.decidedAt).toBe(day(9).getTime());
  });

  it("awards nothing for a grouped tournament (one trophy per group, no overall winner)", async () => {
    expect(await buildRoundRobinTitles([candidate()], async () => GROUPED)).toEqual([]);
  });

  it("awards nothing when the top row has no win yet", async () => {
    expect(await buildRoundRobinTitles([candidate()], async () => individual([{ key: "a+b", wins: 0 }]))).toEqual([]);
  });

  it("awards nothing for an empty table", async () => {
    expect(await buildRoundRobinTitles([candidate()], async () => individual([]))).toEqual([]);
  });

  it("for a tournament not yet COMPLETED, awards only once the round robin is fully played out - the page's own trophy rule", async () => {
    const ongoing = candidate({ status: "ONGOING" });
    expect(await buildRoundRobinTitles([ongoing], async () => individual([{ key: "a+b", wins: 2 }], false))).toEqual([]);
    expect(await buildRoundRobinTitles([ongoing], async () => individual([{ key: "a+b", wins: 2 }], true))).toHaveLength(1);
    // COMPLETED by the admin counts even if a match was never played.
    expect(await buildRoundRobinTitles([candidate()], async () => individual([{ key: "a+b", wins: 2 }], false))).toHaveLength(1);
  });

  it("skips a tournament with no decided match, and MIXED tournaments, without computing their standings", async () => {
    const standingsFor = vi.fn(async () => individual([{ key: "a+b", wins: 2 }]));
    const titles = await buildRoundRobinTitles(
      [candidate({ id: "empty", matches: [] }), candidate({ id: "team", format: "MIXED" })],
      standingsFor,
    );
    expect(titles).toEqual([]);
    expect(standingsFor).not.toHaveBeenCalled();
  });

  it("handles several candidates at once, keeping only the ones with a winner", async () => {
    const byId: Record<string, RoundRobinStandings> = {
      rr: individual([{ key: "p1", wins: 3 }]),
      groups: GROUPED,
      fresh: individual([{ key: "p2", wins: 0 }]),
    };
    const titles = await buildRoundRobinTitles(
      [
        candidate({ id: "rr", format: "SINGLES" }),
        candidate({ id: "groups", format: "SINGLES" }),
        candidate({ id: "fresh", format: "SINGLES" }),
      ],
      async (c) => byId[c.id],
    );
    expect(titles.map((t) => t.tournamentId)).toEqual(["rr"]);
  });
});

describe("getRoundRobinTitles / getPadelRoundRobinTitles", () => {
  const participants = [
    { playerId: "p1", seed: null, group: null, withdrawnAt: null, player: { id: "p1", name: "P1", nickname: null } },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    tournamentFindMany.mockResolvedValue([]);
    padelFindMany.mockResolvedValue([]);
  });

  it("looks only at SINGLES/DOUBLES tournaments with no Фінал match of any status, and ranks each with the tennis standings builder", async () => {
    tournamentFindMany.mockResolvedValue([candidate({ format: "SINGLES", participants })]);
    tennisStandings.mockResolvedValue(individual([{ key: "p1", wins: 3 }]));

    const titles = await getRoundRobinTitles();

    expect(tournamentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { format: { in: ["SINGLES", "DOUBLES"] }, matches: { none: { round: "Фінал" } } },
      }),
    );
    expect(tennisStandings).toHaveBeenCalledWith("t1", "SINGLES", participants);
    expect(padelFindMany).not.toHaveBeenCalled();
    expect(padelStandings).not.toHaveBeenCalled();
    expect(titles).toEqual([{ tournamentId: "t1", matchType: "SINGLES", winnerIds: ["p1"], decidedAt: day(8).getTime() }]);
  });

  it("fetches only decided matches for each candidate (status COMPLETED with a winner), with the roster the standings builder needs", async () => {
    await getRoundRobinTitles();
    const select = tournamentFindMany.mock.calls[0][0].select;
    expect(select.matches.where).toEqual({ status: "COMPLETED", winnerSide: { not: null } });
    expect(select.participants.select.player.select).toEqual({ id: true, name: true, nickname: true });
  });

  it("is mirrored for padel with padel's own tables and standings builder", async () => {
    padelFindMany.mockResolvedValue([candidate({ id: "pt1", participants })]);
    padelStandings.mockResolvedValue(individual([{ key: "a+b", wins: 2 }]));

    const titles = await getPadelRoundRobinTitles();

    expect(padelFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ matches: { none: { round: "Фінал" } } }) }),
    );
    expect(padelStandings).toHaveBeenCalledWith("pt1", "DOUBLES", participants);
    expect(tournamentFindMany).not.toHaveBeenCalled();
    expect(titles).toEqual([{ tournamentId: "pt1", matchType: "DOUBLES", winnerIds: ["a", "b"], decidedAt: day(8).getTime() }]);
  });
});
