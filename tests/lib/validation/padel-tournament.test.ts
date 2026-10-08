import { describe, expect, it } from "vitest";

import { padelTournamentFormSchema } from "@/lib/validation/padel-tournament";

const validInput = {
  name: "Літній кубок",
  description: "",
  format: "DOUBLES" as const,
  status: "UPCOMING" as const,
  startDate: "2026-06-01",
  endDate: "2026-06-02",
};

describe("padelTournamentFormSchema.isWomensOnly", () => {
  it("defaults to false when absent or null (older mobile clients, FormData.get on a missing key)", () => {
    for (const isWomensOnly of [undefined, null]) {
      const result = padelTournamentFormSchema.safeParse({ ...validInput, isWomensOnly });
      expect(result.success && result.data.isWomensOnly).toBe(false);
    }
  });

  it("accepts a boolean (JSON body) and the web form's \"true\"/\"false\" strings", () => {
    const parse = (isWomensOnly: unknown) => {
      const result = padelTournamentFormSchema.safeParse({ ...validInput, isWomensOnly });
      return result.success ? result.data.isWomensOnly : "invalid";
    };
    expect(parse(true)).toBe(true);
    expect(parse(false)).toBe(false);
    expect(parse("true")).toBe(true);
    expect(parse("false")).toBe(false);
  });

  it("rejects an unrecognized value", () => {
    expect(padelTournamentFormSchema.safeParse({ ...validInput, isWomensOnly: "yes" }).success).toBe(false);
  });
});
