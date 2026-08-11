import { describe, expect, it } from "vitest";

import { rubberFormSchema } from "@/lib/validation/rubber";

describe("rubberFormSchema", () => {
  const base = { tieId: "tie1", scheduledDate: "" };

  it("accepts a valid singles rubber", () => {
    const result = rubberFormSchema.safeParse({
      ...base,
      matchType: "SINGLES",
      sideAPlayerIds: ["p1"],
      sideBPlayerIds: ["p2"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scheduledDate).toBeNull();
    }
  });

  it("accepts a valid doubles rubber", () => {
    const result = rubberFormSchema.safeParse({
      ...base,
      matchType: "DOUBLES",
      sideAPlayerIds: ["p1", "p2"],
      sideBPlayerIds: ["p3", "p4"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty side - unlike matchFormSchema, a rubber's lineup is never a bracket placeholder", () => {
    const result = rubberFormSchema.safeParse({
      ...base,
      matchType: "SINGLES",
      sideAPlayerIds: [],
      sideBPlayerIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a singles rubber with two players on a side", () => {
    const result = rubberFormSchema.safeParse({
      ...base,
      matchType: "SINGLES",
      sideAPlayerIds: ["p1", "p2"],
      sideBPlayerIds: ["p3"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a doubles rubber with only one player on a side", () => {
    const result = rubberFormSchema.safeParse({
      ...base,
      matchType: "DOUBLES",
      sideAPlayerIds: ["p1"],
      sideBPlayerIds: ["p2", "p3"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched player counts between sides", () => {
    const result = rubberFormSchema.safeParse({
      ...base,
      matchType: "DOUBLES",
      sideAPlayerIds: ["p1", "p2"],
      sideBPlayerIds: ["p3"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a player appearing on both sides", () => {
    const result = rubberFormSchema.safeParse({
      ...base,
      matchType: "SINGLES",
      sideAPlayerIds: ["p1"],
      sideBPlayerIds: ["p1"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing tieId", () => {
    const result = rubberFormSchema.safeParse({
      tieId: "",
      scheduledDate: "",
      matchType: "SINGLES",
      sideAPlayerIds: ["p1"],
      sideBPlayerIds: ["p2"],
    });
    expect(result.success).toBe(false);
  });
});
