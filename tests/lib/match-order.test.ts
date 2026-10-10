import { describe, expect, it } from "vitest";

import { compareMatchesNewestFirst, loadNewestFirst, sortMatchesNewestFirst } from "@/lib/match-order";

const at = (iso: string) => new Date(iso);

function match(
  id: string,
  overrides: { scheduledDate?: string | null; createdAt?: string; completedAt?: string | null },
) {
  return {
    id,
    scheduledDate: overrides.scheduledDate ? at(overrides.scheduledDate) : null,
    createdAt: at(overrides.createdAt ?? "2026-01-01T00:00:00.000Z"),
    completedAt: overrides.completedAt ? at(overrides.completedAt) : null,
  };
}

describe("sortMatchesNewestFirst", () => {
  it("orders one tournament day by finish time even though the playoff placeholders' scheduledDate is staggered by seconds the other way", () => {
    // Real case from the player profile: 1/4 13:38, 1/2 14:37, Фінал 16:22, then two group matches.
    // The placeholders' scheduledDate offsets (1/4 +5s, 1/2 +3s, Фінал +1s, group 0s) used to win.
    const day = "2026-10-10T00:00:00.000Z";
    const plusSeconds = (s: number) => new Date(at(day).getTime() + s * 1000).toISOString();
    const sorted = sortMatchesNewestFirst([
      match("quarter", { scheduledDate: plusSeconds(5), completedAt: "2026-10-10T10:38:00.000Z" }),
      match("semi", { scheduledDate: plusSeconds(3), completedAt: "2026-10-10T11:37:00.000Z" }),
      match("final", { scheduledDate: plusSeconds(1), completedAt: "2026-10-10T13:22:00.000Z" }),
      match("group-d-2", { scheduledDate: day, completedAt: "2026-10-10T09:06:00.000Z" }),
      match("group-d-1", { scheduledDate: day, completedAt: "2026-10-10T07:45:00.000Z" }),
    ]);
    expect(sorted.map((m) => m.id)).toEqual(["final", "semi", "quarter", "group-d-2", "group-d-1"]);
  });

  it("puts a later day above an earlier one regardless of when each was completed (a backfilled old match doesn't jump to the top)", () => {
    const sorted = sortMatchesNewestFirst([
      match("old-backfilled", { scheduledDate: "2026-03-01T00:00:00.000Z", completedAt: "2026-10-10T20:00:00.000Z" }),
      match("recent", { scheduledDate: "2026-10-04T00:00:00.000Z", completedAt: "2026-10-04T14:07:00.000Z" }),
    ]);
    expect(sorted.map((m) => m.id)).toEqual(["recent", "old-backfilled"]);
  });

  it("uses createdAt as the day for a match with no scheduledDate, same as the day headers and date filter", () => {
    const sorted = sortMatchesNewestFirst([
      match("unscheduled-old", { scheduledDate: null, createdAt: "2026-05-01T08:00:00.000Z" }),
      match("scheduled-newer", { scheduledDate: "2026-06-01T00:00:00.000Z" }),
      match("unscheduled-newest", { scheduledDate: null, createdAt: "2026-07-01T08:00:00.000Z" }),
    ]);
    expect(sorted.map((m) => m.id)).toEqual(["unscheduled-newest", "scheduled-newer", "unscheduled-old"]);
  });

  it("lists a not-yet-played match above the finished ones of the same day", () => {
    const sorted = sortMatchesNewestFirst([
      match("played", { scheduledDate: "2026-10-10T00:00:00.000Z", completedAt: "2026-10-10T16:00:00.000Z" }),
      match("upcoming", { scheduledDate: "2026-10-10T00:00:00.000Z", completedAt: null }),
    ]);
    expect(sorted.map((m) => m.id)).toEqual(["upcoming", "played"]);
  });

  it("falls back to scheduledDate and then createdAt for matches that tie on the day and have no finish time", () => {
    const sorted = sortMatchesNewestFirst([
      match("a", { scheduledDate: "2026-10-10T00:00:01.000Z", createdAt: "2026-10-01T00:00:00.000Z" }),
      match("b", { scheduledDate: "2026-10-10T00:00:03.000Z", createdAt: "2026-10-01T00:00:00.000Z" }),
      match("c", { scheduledDate: "2026-10-10T00:00:03.000Z", createdAt: "2026-10-02T00:00:00.000Z" }),
    ]);
    expect(sorted.map((m) => m.id)).toEqual(["c", "b", "a"]);
  });

  it("doesn't mutate its input", () => {
    const input = [
      match("x", { scheduledDate: "2026-01-01T00:00:00.000Z" }),
      match("y", { scheduledDate: "2026-02-01T00:00:00.000Z" }),
    ];
    sortMatchesNewestFirst(input);
    expect(input.map((m) => m.id)).toEqual(["x", "y"]);
  });

  it("treats identical keys as equal", () => {
    const a = match("a", { scheduledDate: "2026-10-10T00:00:00.000Z", completedAt: "2026-10-10T10:00:00.000Z" });
    expect(compareMatchesNewestFirst(a, { ...a })).toBe(0);
  });
});

describe("loadNewestFirst", () => {
  const keys = [
    match("early", { scheduledDate: "2026-10-10T00:00:00.000Z", completedAt: "2026-10-10T10:00:00.000Z" }),
    match("late", { scheduledDate: "2026-10-10T00:00:00.000Z", completedAt: "2026-10-10T16:00:00.000Z" }),
    match("mid", { scheduledDate: "2026-10-10T00:00:00.000Z", completedAt: "2026-10-10T13:00:00.000Z" }),
  ];

  it("loads rows only for the newest `limit` ids and returns them in newest-first order whatever order the loader answers in", async () => {
    let requested: string[] = [];
    const rows = await loadNewestFirst(keys, 2, async (ids) => {
      requested = ids;
      return [{ id: "mid" }, { id: "late" }];
    });
    expect(requested).toEqual(["late", "mid"]);
    expect(rows).toEqual([{ id: "late" }, { id: "mid" }]);
  });

  it("returns everything when no limit is given", async () => {
    const rows = await loadNewestFirst(keys, undefined, async (ids) => ids.map((id) => ({ id })));
    expect(rows.map((r) => r.id)).toEqual(["late", "mid", "early"]);
  });

  it("skips the loader entirely when there is nothing to load", async () => {
    let called = false;
    const rows = await loadNewestFirst([], 5, async () => {
      called = true;
      return [];
    });
    expect(rows).toEqual([]);
    expect(called).toBe(false);
  });

  it("drops an id the loader no longer returns (row deleted in between) instead of leaving a hole", async () => {
    const rows = await loadNewestFirst(keys, 3, async () => [{ id: "late" }, { id: "early" }]);
    expect(rows.map((r) => r.id)).toEqual(["late", "early"]);
  });
});
