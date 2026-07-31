import { describe, expect, it } from "vitest";

import { parseShowParam } from "@/lib/load-more";

describe("parseShowParam", () => {
  it("defaults to pageSize when the param is missing", () => {
    expect(parseShowParam(undefined, 20)).toBe(20);
  });

  it("defaults to pageSize when the param isn't a number", () => {
    expect(parseShowParam("abc", 20)).toBe(20);
  });

  it("accepts a value larger than pageSize", () => {
    expect(parseShowParam("40", 20)).toBe(40);
  });

  it("clamps a value smaller than pageSize back up to pageSize", () => {
    expect(parseShowParam("5", 20)).toBe(20);
  });

  it("clamps a negative or zero value up to pageSize", () => {
    expect(parseShowParam("-10", 20)).toBe(20);
    expect(parseShowParam("0", 20)).toBe(20);
  });

  it("truncates a fractional value", () => {
    expect(parseShowParam("45.9", 20)).toBe(45);
  });
});
