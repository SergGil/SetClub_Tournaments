import { describe, expect, it } from "vitest";

import {
  isForeignKeyError,
  isRecordNotFoundError,
  isUniqueConstraintError,
  uniqueConstraintTarget,
} from "@/lib/prisma-errors";

describe("isUniqueConstraintError", () => {
  it("is true for a P2002 error", () => {
    expect(isUniqueConstraintError({ code: "P2002" })).toBe(true);
  });

  it("is false for a non-P2002 error", () => {
    expect(isUniqueConstraintError({ code: "P2025" })).toBe(false);
  });

  it("is false for values without a code", () => {
    expect(isUniqueConstraintError(new Error("boom"))).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
    expect(isUniqueConstraintError("P2002")).toBe(false);
  });

  it("is false when code is present but not a string", () => {
    expect(isUniqueConstraintError({ code: 2002 })).toBe(false);
  });
});

describe("isRecordNotFoundError", () => {
  it("is true only for P2025", () => {
    expect(isRecordNotFoundError({ code: "P2025" })).toBe(true);
    expect(isRecordNotFoundError({ code: "P2002" })).toBe(false);
  });
});

describe("isForeignKeyError", () => {
  it("is true only for P2003", () => {
    expect(isForeignKeyError({ code: "P2003" })).toBe(true);
    expect(isForeignKeyError({ code: "P2002" })).toBe(false);
  });
});

describe("uniqueConstraintTarget", () => {
  it("returns null for a non-unique-constraint error", () => {
    expect(uniqueConstraintTarget({ code: "P2025" })).toBeNull();
  });

  it("returns an empty array when the error has no meta at all", () => {
    expect(uniqueConstraintTarget({ code: "P2002" })).toEqual([]);
  });

  it("reads the classic query-engine meta.target shape", () => {
    expect(uniqueConstraintTarget({ code: "P2002", meta: { target: ["email"] } })).toEqual(["email"]);
  });

  it("falls back to the driver-adapter shape, stripping double quotes from field names", () => {
    const error = {
      code: "P2002",
      meta: {
        driverAdapterError: { cause: { constraint: { fields: ['"tournamentId"', "playerId"] } } },
      },
    };
    expect(uniqueConstraintTarget(error)).toEqual(["tournamentId", "playerId"]);
  });

  it("returns an empty array when meta matches neither known shape", () => {
    expect(uniqueConstraintTarget({ code: "P2002", meta: { somethingElse: true } })).toEqual([]);
  });
});
