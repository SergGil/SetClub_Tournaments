import { describe, expect, it } from "vitest";

import { playerFormSchema } from "@/lib/validation/player";

describe("playerFormSchema", () => {
  it("accepts a name-only player and normalizes empty email to null", () => {
    const result = playerFormSchema.safeParse({ name: "Іван Петренко", email: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBeNull();
    }
  });

  it("trims the name", () => {
    const result = playerFormSchema.safeParse({ name: "  Іван  ", email: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Іван");
    }
  });

  it("rejects a blank name", () => {
    expect(playerFormSchema.safeParse({ name: "   ", email: "" }).success).toBe(false);
  });

  it("lowercases a valid email", () => {
    const result = playerFormSchema.safeParse({ name: "Іван", email: "Ivan@Example.COM" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ivan@example.com");
    }
  });

  it("rejects an invalid email", () => {
    expect(playerFormSchema.safeParse({ name: "Іван", email: "not-an-email" }).success).toBe(
      false,
    );
  });

  it("normalizes an unrecognized gender value to null", () => {
    const result = playerFormSchema.safeParse({ name: "Іван", email: "", gender: "OTHER" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gender).toBeNull();
    }
  });

  it("keeps a valid gender value", () => {
    const result = playerFormSchema.safeParse({ name: "Ірина", email: "", gender: "FEMALE" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gender).toBe("FEMALE");
    }
  });
});
