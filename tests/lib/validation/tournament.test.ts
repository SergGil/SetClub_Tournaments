import { describe, expect, it } from "vitest";

import { tournamentFormSchema } from "@/lib/validation/tournament";

const validInput = {
  name: "Весняний кубок",
  description: "",
  format: "SINGLES" as const,
  status: "UPCOMING" as const,
  surface: "HARD" as const,
  startDate: "2026-04-01",
  endDate: "2026-04-10",
};

describe("tournamentFormSchema", () => {
  it("accepts a valid tournament and normalizes an empty description to null", () => {
    const result = tournamentFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeNull();
    }
  });

  it("keeps a non-empty description as-is", () => {
    const result = tournamentFormSchema.safeParse({ ...validInput, description: "Опис турніру" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("Опис турніру");
    }
  });

  it("rejects a blank name", () => {
    const result = tournamentFormSchema.safeParse({ ...validInput, name: "  " });
    expect(result.success).toBe(false);
  });

  it("rejects an end date before the start date", () => {
    const result = tournamentFormSchema.safeParse({
      ...validInput,
      startDate: "2026-04-10",
      endDate: "2026-04-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["endDate"]);
    }
  });

  it("accepts an end date equal to the start date", () => {
    const result = tournamentFormSchema.safeParse({
      ...validInput,
      startDate: "2026-04-10",
      endDate: "2026-04-10",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown format, status, or surface", () => {
    expect(tournamentFormSchema.safeParse({ ...validInput, format: "ROUND_ROBIN" }).success).toBe(
      false,
    );
    expect(tournamentFormSchema.safeParse({ ...validInput, status: "ARCHIVED" }).success).toBe(
      false,
    );
    expect(tournamentFormSchema.safeParse({ ...validInput, surface: "CARPET" }).success).toBe(
      false,
    );
  });
});
