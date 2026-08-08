import { describe, expect, it } from "vitest";

import {
  formatDateKyiv,
  formatDateTimeKyiv,
  formatDateUTC,
  formatTimeKyiv,
  toIsoDateKyiv,
} from "@/lib/date-format";

// All assertions below pin an exact UTC instant and check the Kyiv-local
// result - the whole point of these helpers is to be correct regardless of
// the machine/CI runner's own TZ (typically UTC), which is exactly the class
// of bug this test file exists to catch (see docs/CODE_REVIEW_2026-08-08.md).
describe("formatDateUTC", () => {
  it("reads the UTC calendar day regardless of time-of-day", () => {
    expect(formatDateUTC(new Date("2026-03-01T00:00:00.000Z"))).toBe("01.03.2026");
    expect(formatDateUTC(new Date("2026-03-01T23:59:00.000Z"))).toBe("01.03.2026");
  });
});

describe("formatDateKyiv / toIsoDateKyiv", () => {
  it("shifts a late-UTC timestamp into the next Kyiv calendar day (summer, UTC+3)", () => {
    // 2026-06-15 23:30 UTC = 2026-06-16 02:30 Kyiv (EEST, UTC+3)
    const date = new Date("2026-06-15T23:30:00.000Z");
    expect(formatDateKyiv(date)).toBe("16.06.2026");
    expect(toIsoDateKyiv(date)).toBe("2026-06-16");
  });

  it("keeps the same Kyiv calendar day in winter (UTC+2)", () => {
    // 2026-01-15 20:00 UTC = 2026-01-15 22:00 Kyiv (EET, UTC+2)
    const date = new Date("2026-01-15T20:00:00.000Z");
    expect(formatDateKyiv(date)).toBe("15.01.2026");
    expect(toIsoDateKyiv(date)).toBe("2026-01-15");
  });
});

describe("formatTimeKyiv", () => {
  it("renders a genuine timestamp as Kyiv wall-clock time, not UTC", () => {
    // 2026-08-08 12:05 UTC = 2026-08-08 15:05 Kyiv (EEST, UTC+3) - if this
    // ever regresses to a bare toLocaleTimeString on a UTC-hosted server, it
    // would print 12:05 instead.
    expect(formatTimeKyiv(new Date("2026-08-08T12:05:00.000Z"))).toBe("15:05");
  });
});

describe("formatDateTimeKyiv", () => {
  it("renders both date and time in Kyiv timezone", () => {
    expect(formatDateTimeKyiv(new Date("2026-08-08T12:05:00.000Z"))).toBe("08.08.2026, 15:05");
  });
});
