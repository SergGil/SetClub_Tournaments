import { describe, expect, it } from "vitest";

import { bucketByMonth, monthsBetween } from "@/lib/activity-trend";

describe("monthsBetween", () => {
  it("returns an empty list when there are no dates", () => {
    expect(monthsBetween([[], []])).toEqual([]);
  });

  it("spans from the earliest date across all sets through the current month", () => {
    const months = monthsBetween([[new Date("2026-05-15T00:00:00Z")], [new Date("2026-06-01T00:00:00Z")]]);
    expect(months[0]).toBe("2026-05");
    expect(months).toContain("2026-06");
  });

  it("rolls over into the next year", () => {
    const start = new Date("2025-11-10T00:00:00Z");
    const months = monthsBetween([[start]]);
    expect(months.slice(0, 3)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
});

describe("bucketByMonth", () => {
  it("zero-fills months with no matching dates", () => {
    const months = ["2026-05", "2026-06", "2026-07"];
    const result = bucketByMonth([new Date("2026-05-10T00:00:00Z")], months);
    expect(result).toEqual([
      { key: "2026-05", label: "Тра 2026", count: 1 },
      { key: "2026-06", label: "Чер 2026", count: 0 },
      { key: "2026-07", label: "Лип 2026", count: 0 },
    ]);
  });

  it("counts multiple dates in the same month together", () => {
    const months = ["2026-08"];
    const result = bucketByMonth(
      [new Date("2026-08-01T00:00:00Z"), new Date("2026-08-31T23:00:00Z")],
      months,
    );
    expect(result).toEqual([{ key: "2026-08", label: "Сер 2026", count: 2 }]);
  });
});
