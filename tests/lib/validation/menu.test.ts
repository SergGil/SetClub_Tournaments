import { describe, expect, it } from "vitest";

import { menuItemFormSchema, menuSectionFormSchema } from "@/lib/validation/menu";

describe("menuSectionFormSchema", () => {
  it("accepts a valid section", () => {
    const result = menuSectionFormSchema.safeParse({
      name: "Кава",
      tagline: "",
      layout: "LIST",
      sortOrder: "10",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "Кава", tagline: null, layout: "LIST", sortOrder: 10 });
    }
  });

  it("trims name and tagline", () => {
    const result = menuSectionFormSchema.safeParse({
      name: "  Кава  ",
      tagline: "  special drinks  ",
      layout: "CARDS",
      sortOrder: "0",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Кава");
      expect(result.data.tagline).toBe("special drinks");
    }
  });

  it("turns a blank tagline into null", () => {
    const result = menuSectionFormSchema.safeParse({ name: "Кава", tagline: "", layout: "LIST", sortOrder: "0" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tagline).toBeNull();
  });

  it("defaults sortOrder to 0 when omitted", () => {
    const result = menuSectionFormSchema.safeParse({ name: "Кава", layout: "LIST" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sortOrder).toBe(0);
  });

  it("rejects a blank name", () => {
    expect(menuSectionFormSchema.safeParse({ name: "   ", layout: "LIST" }).success).toBe(false);
  });

  it("rejects a name over 60 characters", () => {
    expect(menuSectionFormSchema.safeParse({ name: "a".repeat(61), layout: "LIST" }).success).toBe(false);
  });

  it("rejects a tagline over 80 characters", () => {
    const result = menuSectionFormSchema.safeParse({ name: "Кава", tagline: "a".repeat(81), layout: "LIST" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid layout value", () => {
    expect(menuSectionFormSchema.safeParse({ name: "Кава", layout: "GRID" }).success).toBe(false);
  });
});

describe("menuItemFormSchema", () => {
  const valid = { sectionId: "s1", name: "Латте", price: "95", description: "", sortOrder: "0" };

  it("accepts a valid item", () => {
    const result = menuItemFormSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ sectionId: "s1", name: "Латте", price: 95, description: null, sortOrder: 0 });
    }
  });

  it("trims name and description", () => {
    const result = menuItemFormSchema.safeParse({ ...valid, description: "  вершковий смак  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBe("вершковий смак");
  });

  it("rejects a blank sectionId", () => {
    expect(menuItemFormSchema.safeParse({ ...valid, sectionId: "" }).success).toBe(false);
  });

  it("rejects a blank name", () => {
    expect(menuItemFormSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
  });

  it("rejects a name over 80 characters", () => {
    expect(menuItemFormSchema.safeParse({ ...valid, name: "a".repeat(81) }).success).toBe(false);
  });

  it("rejects a negative price", () => {
    expect(menuItemFormSchema.safeParse({ ...valid, price: "-1" }).success).toBe(false);
  });

  it("rejects a price over 100000", () => {
    expect(menuItemFormSchema.safeParse({ ...valid, price: "100001" }).success).toBe(false);
  });

  it("rejects a non-numeric price", () => {
    expect(menuItemFormSchema.safeParse({ ...valid, price: "not-a-number" }).success).toBe(false);
  });

  it("rejects a description over 200 characters", () => {
    expect(menuItemFormSchema.safeParse({ ...valid, description: "a".repeat(201) }).success).toBe(false);
  });
});
