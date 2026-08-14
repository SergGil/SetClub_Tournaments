import { describe, expect, it } from "vitest";

import { excerpt } from "@/lib/text-excerpt";

describe("excerpt", () => {
  it("returns short text unchanged", () => {
    expect(excerpt("Коротка новина.")).toBe("Коротка новина.");
  });

  it("collapses newlines/repeated whitespace into single spaces", () => {
    expect(excerpt("Рядок один\n\nРядок два   з  пробілами")).toBe("Рядок один Рядок два з пробілами");
  });

  it("trims leading/trailing whitespace", () => {
    expect(excerpt("  зайві пробіли  ")).toBe("зайві пробіли");
  });

  it("cuts to max length and appends an ellipsis only when actually truncated", () => {
    const long = "а".repeat(200);
    const result = excerpt(long);
    expect(result.length).toBe(160);
    expect(result.endsWith("…")).toBe(true);
    expect(result.slice(0, -1)).toBe("а".repeat(159));
  });

  it("does not append an ellipsis when the text exactly fits max", () => {
    const exact = "б".repeat(160);
    expect(excerpt(exact)).toBe(exact);
  });

  it("respects a custom max", () => {
    expect(excerpt("абвгдежзиклмноп", 5)).toBe("абвг…");
  });

  it("returns an empty string for empty/whitespace-only input", () => {
    expect(excerpt("")).toBe("");
    expect(excerpt("   \n\n  ")).toBe("");
  });
});
